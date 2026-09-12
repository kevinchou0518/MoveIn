"""AI room preview: composes a bundle's listing photos into one furnished room via xAI image edits."""
import base64
from io import BytesIO
from pathlib import Path
import httpx
from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError
from app.catalog import builtin_categories

MAX_PHOTOS = 5  # xAI multi-image editing accepts up to five source images.


def normalize(data: bytes) -> bytes:
    """Store previews like uploads: EXIF-free RGB JPEG, at most 1600 px."""
    with Image.open(BytesIO(data)) as source:
        photo = ImageOps.exif_transpose(source).convert('RGB')
        photo.thumbnail((1600, 1600))
        out = BytesIO()
        photo.save(out, format='JPEG', quality=85)
        return out.getvalue()


class RoomImageService:
    def __init__(self, key='', model='grok-imagine-image-2.0', transport=None):
        self.key, self.model, self.transport = key, model, transport

    @staticmethod
    def photo(image_url: str, uploads: Path):
        """Inline a photo uploaded through this app as a data URI; HTTPS URLs pass through; anything else is skipped."""
        if not image_url:
            return None
        if image_url.startswith('https://'):
            return image_url
        if not image_url.startswith('/uploads/'):
            return None
        name = image_url.removeprefix('/uploads/')
        if '\\' in name or '..' in name.split('/') or not name.endswith('.jpg'):
            return None
        path = (uploads / name).resolve()
        try:
            if uploads.resolve() not in path.parents or not path.is_file():
                return None
            return 'data:image/jpeg;base64,' + base64.b64encode(path.read_bytes()).decode('ascii')
        except OSError:
            return None

    def render(self, bundle: dict, uploads: Path, categories=None) -> bytes:
        if not self.key:
            raise HTTPException(503, 'Room preview is not configured.')
        categories = categories if categories is not None else builtin_categories()
        names = {c['id']: c['name'] for c in categories}
        images, lines = [], []
        for item in bundle.get('listings', []):
            label = f"{item.get('title', '')} ({names.get(item.get('category'), item.get('category') or 'furniture')}, {item.get('condition') or 'used'} condition)"
            uri = self.photo(item.get('image_url', ''), uploads) if len(images) < MAX_PHOTOS else None
            if uri:
                lines.append(f'<IMAGE_{len(images)}>: {label}')
                images.append({'url': uri})
            else:
                lines.append(f'(no photo) {label}')
        prompt = ('Photorealistic interior photo of one small apartment living and work space furnished with exactly these '
                  'secondhand pieces and nothing else: ' + '; '.join(lines) + '. Arrange them naturally in a single room with '
                  'warm daylight, eye-level view, no people, no text or labels. Keep each pictured item\'s real shape, color, and wear.')
        body = {'model': self.model, 'prompt': prompt, 'n': 1, 'aspect_ratio': '4:3', 'resolution': '1k', 'response_format': 'b64_json'}
        endpoint = 'https://api.x.ai/v1/images/generations'
        if images:
            body['images'], endpoint = images, 'https://api.x.ai/v1/images/edits'
        try:
            with httpx.Client(timeout=90, transport=self.transport) as client:
                response = client.post(endpoint, headers={'Authorization': f'Bearer {self.key}'}, json=body)
            if response.status_code in (401, 403):
                raise HTTPException(503, 'AI credentials were rejected. Room previews are unavailable.')
            if response.status_code == 429:
                raise HTTPException(503, 'AI is busy or its quota is exhausted. Room previews are unavailable right now.')
            if response.status_code in (400, 404):
                raise HTTPException(503, 'AI image model or request configuration is unsupported. Check GROK_IMAGE_MODEL.')
            response.raise_for_status()
            return normalize(base64.b64decode(response.json()['data'][0]['b64_json']))
        except httpx.TimeoutException:
            raise HTTPException(504, 'Room preview timed out.') from None
        except (httpx.HTTPError, ValueError, KeyError, TypeError, AttributeError, IndexError, UnidentifiedImageError, OSError, Image.DecompressionBombError):
            raise HTTPException(502, 'AI could not produce a room preview.') from None
