from contextlib import asynccontextmanager
from io import BytesIO
import os
from pathlib import Path
from uuid import uuid4
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, UploadFile, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError
from pymongo.errors import PyMongoError
from app.db.store import LocalStore, MongoStore, StoreError
from app.schemas import BundleRequest, Category, Listing, ListingCreate, Seller, SellerCreate, Location, utcnow
from app.services.ai_service import AnalysisRequest, AnalysisResult, GrokService
from app.services.bundle_service import generate_bundles
from app.services.route_optimizer import MapProvider
from app.services.geocoding import Geocoder
from app.catalog import CategoryCreate, ensure_categories
from app.services.discovery_ai import DiscoveryAI, ParseRequest, ResearchRequest
from app.services.swaps import alternatives
from app.schemas import Model
from pydantic import Field, ValidationError
from typing import Literal
from starlette.concurrency import run_in_threadpool
from app.auth import Authenticator, current_account, initialize_demo_accounts
from app.services import orders as workflow

class SwapRequest(Model):
    listing_id: str = Field(min_length=1,max_length=100)

class CancelRequest(Model):
    reason: str = Field(min_length=1, max_length=1000)


ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT.parent / '.env')


def create_app(store=None, provider=None, uploads_dir=None, ai_service=None, geocoder=None, discovery_ai=None, authenticator=None):
    uploads = Path(uploads_dir) if uploads_dir else ROOT / 'uploads'
    uploads.mkdir(parents=True, exist_ok=True)
    from app.demo_photos import install_demo_photos
    install_demo_photos(uploads)

    @asynccontextmanager
    async def lifespan(app):
        uri = os.getenv('MONGODB_URI', '')
        if store is None and uri and not uri.startswith(('mongodb://', 'mongodb+srv://')):
            raise RuntimeError('MONGODB_URI must be a MongoDB database connection string beginning with mongodb:// or mongodb+srv://.')
        app.state.geocoder = geocoder or Geocoder(os.getenv('MAPBOX_ACCESS_TOKEN', ''))
        app.state.auth = authenticator or Authenticator()
        app.state.discovery = discovery_ai or DiscoveryAI(
            os.getenv('GROK_API_KEY', ''),
            os.getenv('GROK_RESEARCH_MODEL') or os.getenv('GROK_MODEL') or 'grok-4.6',
        )
        app.state.ai = ai_service or GrokService(os.getenv('GROK_API_KEY', ''), os.getenv('GROK_MODEL') or 'grok-4.6')
        app.state.store = store or (MongoStore(os.environ['MONGODB_URI'], os.getenv('MONGODB_DB', 'snackoverflow'))
                                    if os.getenv('MONGODB_URI') else LocalStore(Path(os.getenv('DEMO_DATA_PATH', ROOT/'data/demo.json'))))
        if authenticator is None:
            app.state.store.atomic(initialize_demo_accounts)
        app.state.provider = provider or MapProvider(os.getenv('MAPBOX_ACCESS_TOKEN', ''))
        yield
        app.state.store.close()

    app = FastAPI(title='SnackOverflow', version='0.1.0', lifespan=lifespan,
                  description='Deterministic, fulfillable secondhand furniture bundles. Demo only; no payments.')
    app.mount('/uploads', StaticFiles(directory=uploads), name='uploads')
    # Historical order snapshots retain their original photo URLs.
    app.mount('/images/demo', StaticFiles(directory=uploads / 'demo'), name='legacy-demo-photos')

    @app.middleware('http')
    async def authenticate_routes(request, call_next):
        public = request.method == 'GET' and (request.url.path in ('/health', '/sellers', '/listings', '/categories', '/locations/search', '/docs', '/openapi.json', '/docs/oauth2-redirect') or request.url.path.startswith(('/uploads/', '/images/demo/')))
        if not public and request.method != 'OPTIONS':
            try:
                await run_in_threadpool(current_account, request)
            except HTTPException as exc:
                return JSONResponse(status_code=exc.status_code, content={'detail': exc.detail}, headers=exc.headers)
        return await call_next(request)

    @app.exception_handler(ValidationError)
    async def invalid_model(request, exc):
        return JSONResponse(status_code=422, content={'detail': 'Invalid fields. Check the listing or profile values.'})

    def actor(request):
        return current_account(request)['id']

    @app.get('/me')
    def me(request: Request):
        account = current_account(request)
        def save(data):
            data.setdefault('accounts', {}).setdefault(account['id'], {**account, 'created_at': utcnow().isoformat()})
            return {'id': account['id'], 'sellers': [Seller(**s).public() for s in data['sellers'].values() if s.get('owner_id') == account['id']]}
        return request.app.state.store.atomic(save)

    @app.get('/orders')
    def order_list(request: Request, status: Literal['reserved','in_progress','completed','cancelled'] | None = None, limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0)):
        return workflow.list_orders(request.app.state.store.snapshot(), actor(request), status, limit, offset)

    @app.get('/sellers/{seller_id}/orders')
    @app.get('/sellers/{seller_id}/deliveries')
    def seller_orders(seller_id: str, request: Request, status: Literal['reserved','in_progress','completed','cancelled'] | None = None, limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0)):
        return workflow.list_orders(request.app.state.store.snapshot(), actor(request), status, limit, offset, seller_id, request.url.path.endswith('/deliveries'))

    @app.post('/orders/{order_id}/cancel')
    def cancel_order(order_id: str, payload: CancelRequest, request: Request, seller_id: str | None = None):
        return request.app.state.store.atomic(lambda data: workflow.transition(data, order_id, actor(request), 'cancel', payload.reason, seller_id))

    @app.post('/orders/{order_id}/start')
    @app.post('/orders/{order_id}/complete')
    def progress_order(order_id: str, request: Request, seller_id: str | None = None):
        action = request.url.path.rsplit('/', 1)[-1]
        return request.app.state.store.atomic(lambda data: workflow.transition(data, order_id, actor(request), action, seller_id=seller_id))

    @app.patch('/listings/{listing_id}')
    def update_listing(listing_id: str, request: Request, patch: dict = Body(...)):
        if not patch or set(patch) - (set(ListingCreate.model_fields) - {'seller_id'}):
            raise HTTPException(422, 'Choose editable listing fields.')
        def save(data):
            result = workflow.edit_listing(data, listing_id, actor(request), patch=patch)
            ensure_categories([result['category']], request.app.state.store)
            return result
        return request.app.state.store.atomic(save)

    @app.post('/listings/{listing_id}/withdraw')
    @app.post('/listings/{listing_id}/publish')
    def listing_state(listing_id: str, request: Request):
        return request.app.state.store.atomic(lambda data: workflow.edit_listing(data, listing_id, actor(request), action=request.url.path.rsplit('/', 1)[-1]))

    @app.patch('/sellers/{seller_id}')
    def update_seller(seller_id: str, request: Request, patch: dict = Body(...)):
        if not patch or set(patch) - set(SellerCreate.model_fields):
            raise HTTPException(422, 'Choose editable seller fields.')
        return request.app.state.store.atomic(lambda data: workflow.edit_seller(data, seller_id, actor(request), patch))

    @app.exception_handler(StoreError)
    async def store_error(request, exc):
        return JSONResponse(status_code=exc.status, content={'detail':exc.message})

    @app.exception_handler(PyMongoError)
    async def mongo_error(request, exc):
        return JSONResponse(status_code=503, content={'detail':'The database is unavailable. Please try again.'})

    @app.get('/health')
    def health(request: Request):
        return {'status':'ok', 'storage':request.app.state.store.kind,
                'routing':'mapbox' if request.app.state.provider.token else 'estimated'}

    @app.get('/locations/search', response_model=list[Location])
    def search_locations(request: Request, q: str = Query(min_length=3, max_length=200)):
        if len(q.strip()) < 3:
            raise HTTPException(422, 'Enter at least three characters of an address or neighborhood.')
        return request.app.state.geocoder.search(q.strip())

    @app.get('/categories')
    def categories(request: Request):
        return request.app.state.store.categories()

    @app.post('/categories', status_code=201)
    def add_category(payload: CategoryCreate, request: Request):
        return request.app.state.store.add_category(payload.name)

    @app.post('/buyer/parse')
    def parse_buyer(payload: ParseRequest, request: Request):
        return request.app.state.discovery.parse(payload,request.app.state.store.categories())

    @app.post('/listings/research-price')
    def research_price(payload: ResearchRequest, request: Request):
        ensure_categories([payload.category],request.app.state.store)
        return request.app.state.discovery.research(payload)

    @app.get('/bundles/{bundle_id}')
    def get_bundle(bundle_id: str, request: Request):
        store=request.app.state.store
        result=workflow.owned_bundle(store.snapshot(), bundle_id, actor(request))
        order=store.order_for_bundle(bundle_id)
        return {**result,'order_id':order['id'] if order else None}

    @app.get('/orders/{order_id}')
    def get_order(order_id: str, request: Request, seller_id: str | None = None):
        data = request.app.state.store.snapshot()
        order = data.get('orders', {}).get(order_id)
        if not order:
            raise HTTPException(404, 'Order not found.')
        return workflow.order_view(data, order, actor(request), seller_id)

    @app.post('/bundles/{bundle_id}/alternatives')
    def swap(bundle_id: str, payload: SwapRequest, request: Request):
        workflow.owned_bundle(request.app.state.store.snapshot(), bundle_id, actor(request))
        return alternatives(request.app.state.store,bundle_id,payload.listing_id,request.app.state.provider)

    @app.get('/sellers')
    def sellers(request: Request):
        return [s.public() for s in request.app.state.store.sellers().values()]

    @app.post('/sellers', status_code=201)
    def add_seller(payload: SellerCreate, request: Request):
        seller = Seller(id=str(uuid4()), owner_id=actor(request), **payload.model_dump())
        request.app.state.store.atomic(lambda data: data['sellers'].update({seller.id: seller.model_dump(mode='json')}))
        return seller.public()

    @app.get('/listings')
    def listings(request: Request, category: Category | None = None, available: bool | None = None):
        items = request.app.state.store.listings()
        return [i.public() for i in items if (category is None or i.category == category)
                and (available is None or (i.available and i.available_date <= utcnow().date()) == available)]

    @app.post('/listings', status_code=201)
    def add_listing(payload: ListingCreate, request: Request):
        ensure_categories([payload.category],request.app.state.store)
        seller = request.app.state.store.sellers().get(payload.seller_id)
        if not seller:
            raise HTTPException(404, 'Seller not found. Choose or create a seller profile.')
        def save(data):
            current = workflow.owned_seller(data, payload.seller_id, actor(request))
            workflow.check_image(data, payload.image_url, actor(request), payload.seller_id)
            listing = Listing(id=str(uuid4()), location=current['location'], status='available', **payload.model_dump())
            data['listings'][listing.id] = listing.model_dump(mode='json')
            return listing.public()
        return request.app.state.store.atomic(save)

    @app.post('/uploads', status_code=201)
    def upload(request: Request, file: UploadFile):
        contents = file.file.read(8*1024*1024+1)
        if len(contents) > 8*1024*1024:
            raise HTTPException(413, 'Photo must be smaller than 8 MB.')
        try:
            with Image.open(BytesIO(contents)) as source:
                if source.format not in ('JPEG','PNG','WEBP'):
                    raise HTTPException(415, 'Use a JPEG, PNG, or WebP photo.')
                source.verify()
            with Image.open(BytesIO(contents)) as source:
                from PIL import ImageOps
                photo = ImageOps.exif_transpose(source).convert('RGB')
                photo.thumbnail((1600,1600))
                filename = f'{uuid4()}.jpg'
                photo.save(uploads/filename, quality=85)
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError, ValueError):
            raise HTTPException(415, 'This photo could not be read. Use a JPEG, PNG, or WebP image.')
        url = f'/uploads/{filename}'
        try:
            request.app.state.store.atomic(lambda data: data.setdefault('uploads', {}).update({url: {'id': url, 'owner_id': actor(request)}}))
        except Exception:
            (uploads / filename).unlink(missing_ok=True)
            raise
        return {'image_url': url}

    @app.post('/listings/analyze', response_model=AnalysisResult)
    def analyze(payload: AnalysisRequest, request: Request):
        workflow.check_image(request.app.state.store.snapshot(), payload.image_url, actor(request))
        return request.app.state.ai.analyze(payload, uploads, request.app.state.store.categories())

    @app.post('/bundles/generate')
    def generate(payload: BundleRequest, request: Request):
        db = request.app.state.store
        ensure_categories(payload.categories,db)
        result = generate_bundles(db.listings(), db.sellers(), payload, request.app.state.provider)
        for bundle in result['bundles']:
            bundle['buyer_id'] = actor(request)
        db.save_bundles(result['bundles'])
        return result

    @app.post('/bundles/{bundle_id}/checkout', status_code=201)
    def checkout(bundle_id: str, request: Request):
        return request.app.state.store.atomic(lambda data: workflow.checkout(data, bundle_id, actor(request)))

    @app.get('/deliveries/{seller_id}')
    def deliveries(seller_id: str, request: Request):
        return workflow.list_orders(request.app.state.store.snapshot(), actor(request), seller_id=seller_id, deliveries=True)['items']

    # Keep CORS outermost so authentication failures also reach separate-origin clients.
    app.add_middleware(CORSMiddleware, allow_origins=['http://localhost:5173','http://127.0.0.1:5173'],
                       allow_methods=['GET','POST','PATCH'], allow_headers=['Content-Type', 'Authorization'])
    return app


app = create_app()
