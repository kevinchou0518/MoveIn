import base64
import json
from io import BytesIO
import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from PIL import Image
from app.db.store import LocalStore
from app.services.room_image import RoomImageService
from app.services.route_optimizer import MapProvider
from support import create_app

REQUEST = {'categories': ['tv', 'tv_stand', 'desk', 'chair'], 'budget': 300, 'buyer_has_car': False, 'buyer_location': {'lat': 40.443, 'lng': -79.943}, 'ranking': 'balanced'}


def png_b64():
    out = BytesIO(); Image.new('RGB', (24, 18), (200, 180, 150)).save(out, format='PNG')
    return base64.b64encode(out.getvalue()).decode()


def service(status=200, calls=None, payload=None):
    def respond(request):
        if calls is not None: calls.append((request.url.path, json.loads(request.content)))
        if status != 200: return httpx.Response(status, text='secret provider text')
        return httpx.Response(200, json=payload or {'data': [{'b64_json': png_b64(), 'mime_type': 'image/png'}]})
    return RoomImageService('test-secret', transport=httpx.MockTransport(respond))


@pytest.fixture
def api(tmp_path):
    calls = []
    store = LocalStore(tmp_path / 'db.json')
    with TestClient(create_app(store, MapProvider(), tmp_path / 'uploads', room_image=service(calls=calls))) as client:
        yield client, store, calls, tmp_path / 'uploads'


def set_photos(store, uploads, url):
    if url: Image.new('RGB', (20, 20)).save(uploads / 'test.jpg')
    store.atomic(lambda d: [l.update(image_url=url) for l in d['listings'].values()])


def test_room_preview_is_generated_once_from_listing_photos(api):
    client, store, calls, uploads = api
    set_photos(store, uploads, '/uploads/test.jpg')
    bundle = client.post('/bundles/generate', json=REQUEST).json()['bundles'][0]
    response = client.post(f"/bundles/{bundle['id']}/room-image")
    assert response.status_code == 200, response.text
    url = response.json()['room_image_url']
    assert url == f"/uploads/rooms/{bundle['id']}.jpg" and (uploads / 'rooms' / f"{bundle['id']}.jpg").is_file()
    path, body = calls[0]
    assert path == '/v1/images/edits' and body['model'] == 'grok-imagine-image-2.0' and body['n'] == 1
    assert body['response_format'] == 'b64_json' and body['aspect_ratio'] == '4:3'
    assert len(body['images']) == min(5, len(bundle['listings'])) and all(i['url'].startswith('data:image/jpeg;base64,') for i in body['images'])
    assert '<IMAGE_0>' in body['prompt'] and all(item['title'] in body['prompt'] for item in bundle['listings'])
    assert store.get_bundle(bundle['id'])['room_image_url'] == url
    assert client.get(f"/bundles/{bundle['id']}").json()['room_image_url'] == url
    assert client.get(url).status_code == 200
    with Image.open(BytesIO(client.get(url).content)) as saved: assert saved.format == 'JPEG'
    assert client.post(f"/bundles/{bundle['id']}/room-image").json()['room_image_url'] == url and len(calls) == 1


def test_room_preview_falls_back_to_text_generation_without_photos(api):
    client, store, calls, uploads = api
    set_photos(store, uploads, '')
    bundle = client.post('/bundles/generate', json=REQUEST).json()['bundles'][0]
    assert client.post(f"/bundles/{bundle['id']}/room-image").status_code == 200
    path, body = calls[0]
    assert path == '/v1/images/generations' and 'images' not in body and '(no photo)' in body['prompt']


def test_room_preview_requires_bundle_ownership(api):
    client, store, calls, uploads = api
    bundle = client.post('/bundles/generate', json=REQUEST).json()['bundles'][0]
    store.atomic(lambda d: d['bundles'][bundle['id']].update(buyer_id='someone-else'))
    assert client.post(f"/bundles/{bundle['id']}/room-image").status_code == 404 and calls == []


@pytest.mark.parametrize('status,expected', [(401, 503), (403, 503), (429, 503), (400, 503), (404, 503), (500, 502)])
def test_provider_errors_are_sanitized(tmp_path, status, expected):
    with pytest.raises(HTTPException) as error:
        service(status).render({'listings': [{'title': 'Chair', 'category': 'chair', 'condition': 'good', 'image_url': ''}]}, tmp_path)
    assert error.value.status_code == expected and 'secret' not in error.value.detail


def test_timeout_bad_payload_and_missing_key(tmp_path):
    def timeout(request): raise httpx.ReadTimeout('secret')
    with pytest.raises(HTTPException) as error:
        RoomImageService('test-secret', transport=httpx.MockTransport(timeout)).render({'listings': []}, tmp_path)
    assert error.value.status_code == 504
    with pytest.raises(HTTPException) as error:
        service(payload={'data': [{'b64_json': base64.b64encode(b'not an image').decode()}]}).render({'listings': []}, tmp_path)
    assert error.value.status_code == 502
    with pytest.raises(HTTPException) as error:
        RoomImageService().render({'listings': []}, tmp_path)
    assert error.value.status_code == 503


@pytest.mark.parametrize('url,expected', [('/uploads/../secret.jpg', None), ('/uploads/x.png', None), ('/etc/passwd', None), ('https://example.com/photo.jpg', 'https://example.com/photo.jpg'), ('', None), ('/uploads/missing.jpg', None)])
def test_only_app_photos_or_https_urls_are_sent(tmp_path, url, expected):
    assert RoomImageService.photo(url, tmp_path) == expected
