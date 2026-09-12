from contextlib import asynccontextmanager
from io import BytesIO
import os
from pathlib import Path
from uuid import uuid4
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError
from pymongo.errors import PyMongoError
from app.db.store import LocalStore, MongoStore, StoreError
from app.schemas import BundleRequest, Category, Listing, ListingCreate, Seller, SellerCreate, utcnow
from app.services.bundle_service import generate_bundles
from app.services.route_optimizer import MapProvider

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT.parent / '.env')


def create_app(store=None, provider=None, uploads_dir=None):
    uploads = Path(uploads_dir) if uploads_dir else ROOT / 'uploads'
    uploads.mkdir(parents=True, exist_ok=True)

    @asynccontextmanager
    async def lifespan(app):
        app.state.store = store or (MongoStore(os.environ['MONGODB_URI'], os.getenv('MONGODB_DB', 'snackoverflow'))
                                    if os.getenv('MONGODB_URI') else LocalStore(Path(os.getenv('DEMO_DATA_PATH', ROOT/'data/demo.json'))))
        app.state.provider = provider or MapProvider(os.getenv('MAPBOX_ACCESS_TOKEN', ''))
        yield
        app.state.store.close()

    app = FastAPI(title='SnackOverflow', version='0.1.0', lifespan=lifespan,
                  description='Deterministic, fulfillable secondhand furniture bundles. Demo only; no payments.')
    app.add_middleware(CORSMiddleware, allow_origins=['http://localhost:5173','http://127.0.0.1:5173'],
                       allow_methods=['GET','POST'], allow_headers=['Content-Type'])
    app.mount('/uploads', StaticFiles(directory=uploads), name='uploads')

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

    @app.get('/sellers')
    def sellers(request: Request):
        return [s.public() for s in request.app.state.store.sellers().values()]

    @app.post('/sellers', status_code=201)
    def add_seller(payload: SellerCreate, request: Request):
        seller = Seller(id=str(uuid4()), **payload.model_dump())
        request.app.state.store.add_seller(seller)
        return seller.public()

    @app.get('/listings')
    def listings(request: Request, category: Category | None = None, available: bool | None = None):
        items = request.app.state.store.listings()
        return [i.public() for i in items if (category is None or i.category == category)
                and (available is None or (i.available and i.available_date <= utcnow().date()) == available)]

    @app.post('/listings', status_code=201)
    def add_listing(payload: ListingCreate, request: Request):
        seller = request.app.state.store.sellers().get(payload.seller_id)
        if not seller:
            raise HTTPException(404, 'Seller not found. Choose or create a seller profile.')
        listing = Listing(id=str(uuid4()), location=seller.location, **payload.model_dump())
        request.app.state.store.add_listing(listing)
        return listing.public()

    @app.post('/uploads', status_code=201)
    def upload(file: UploadFile):
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
        return {'image_url':f'/uploads/{filename}'}

    @app.post('/listings/analyze')
    def analyze():
        raise HTTPException(503, 'AI analysis is planned for P1. You can enter and publish all listing details manually.')

    @app.post('/bundles/generate')
    def generate(payload: BundleRequest, request: Request):
        db = request.app.state.store
        result = generate_bundles(db.listings(), db.sellers(), payload, request.app.state.provider)
        db.save_bundles(result['bundles'])
        return result

    @app.post('/bundles/{bundle_id}/checkout', status_code=201)
    def checkout(bundle_id: str, request: Request):
        return request.app.state.store.checkout(bundle_id)

    @app.get('/deliveries/{seller_id}')
    def deliveries(seller_id: str, request: Request):
        if seller_id not in request.app.state.store.sellers():
            raise HTTPException(404, 'Seller not found.')
        return request.app.state.store.deliveries(seller_id)

    return app


app = create_app()
