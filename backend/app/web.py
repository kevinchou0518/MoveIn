"""Single-service deployment: built React UI plus the existing API."""
from contextlib import asynccontextmanager
import os
from pathlib import Path
from fastapi import FastAPI
from starlette.exceptions import HTTPException
from starlette.staticfiles import StaticFiles
from app.main import create_app, ROOT


class FrontendFiles(StaticFiles):
    async def get_response(self, path, scope):
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            # Only client routes receive the SPA shell, never missing assets.
            route = path.strip('/').split('/')[0]
            if exc.status_code == 404 and scope['method'] in ('GET', 'HEAD') and route in ('buyer', 'seller', 'account', 'orders', 'bundles'):
                return await super().get_response('index.html', scope)
            raise


def create_web_app(static_dir=None, uploads_dir=None, api_app=None):
    static = Path(static_dir or os.getenv('FRONTEND_DIST', ROOT.parent / 'frontend/dist'))
    uploads = Path(uploads_dir or os.getenv('UPLOADS_DIR', ROOT / 'uploads'))
    api = api_app or create_app(uploads_dir=uploads)

    @asynccontextmanager
    async def lifespan(app):
        # Mounted sub-apps do not run their lifespan automatically.
        async with api.router.lifespan_context(api):
            yield

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.mount('/api', api)
    app.mount('/uploads', StaticFiles(directory=uploads))
    app.mount('/images/demo', StaticFiles(directory=uploads / 'demo'))
    app.mount('/', FrontendFiles(directory=static, html=True))
    return app
