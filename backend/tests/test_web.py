from fastapi.testclient import TestClient
from app.db.store import LocalStore
from app.main import create_app
from app.web import create_web_app


def test_single_service_routes_api_photos_and_spa_without_hiding_errors(tmp_path):
    static = tmp_path / 'dist'
    static.mkdir()
    (static / 'index.html').write_text('<html>MoveIn app</html>')
    (static / 'assets').mkdir()
    (static / 'assets/main.js').write_text('console.log("MoveIn")')
    uploads = tmp_path / 'uploads'
    api = create_app(store=LocalStore(tmp_path / 'data.json'), uploads_dir=uploads)
    with TestClient(create_web_app(static, uploads, api)) as client:
        assert client.get('/api/health').status_code == 200
        assert len(client.get('/api/me').json()['sellers']) == 1
        for path in ('/', '/buyer', '/account', '/orders/example', '/bundles/example', '/seller/maya/listings'):
            assert client.get(path).text == '<html>MoveIn app</html>'
        assert client.get('/assets/main.js').headers['content-type'].startswith('text/javascript')
        assert client.get('/uploads/demo/chair-04.jpg').headers['content-type'] == 'image/jpeg'
        assert client.get('/images/demo/chair-04.jpg').content == client.get('/uploads/demo/chair-04.jpg').content
        for path in ('/api/not-a-route', '/uploads/missing.jpg', '/assets/missing.js'):
            assert client.get(path).status_code == 404
            assert 'MoveIn app' not in client.get(path).text
