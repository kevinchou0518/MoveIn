import importlib.util
from pathlib import Path

from app.demo_photos import PHOTO_LISTINGS

spec = importlib.util.spec_from_file_location('demo_data', Path(__file__).parents[2] / 'scripts/demo_data.py')
demo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(demo)


def test_seed_preserves_custom_data_and_reservations_and_is_idempotent():
    current = demo.prepare({})
    current['listings']['tv-01'].update(available=False, title='Edited', image_url='/images/demo/tv-01.jpg')
    current['listings']['custom'] = {'id': 'custom', 'image_url': '/uploads/custom.jpg'}
    current['orders']['order'] = {'id': 'order', 'status': 'reserved'}
    updated = demo.prepare(current)
    assert not updated['listings']['tv-01']['available']
    assert updated['listings']['tv-01']['title'] == 'Edited'
    assert updated['listings']['tv-01']['image_url'] == '/uploads/demo/tv-01.jpg'
    assert updated['listings']['custom'] == current['listings']['custom']
    assert updated['orders'] == current['orders']
    assert current['listings']['tv-01']['image_url'] == '/images/demo/tv-01.jpg'
    assert demo.prepare(updated) == updated


def test_full_reset_clears_history_and_restores_seed_availability():
    current = demo.prepare({})
    current['listings']['tv-01']['available'] = False
    current['orders']['order'] = {'id': 'order'}
    current['bundles']['bundle'] = {'id': 'bundle'}
    current['listings']['custom'] = {'id': 'custom'}
    current['accounts']['owner'] = {'id': 'owner'}
    current['uploads']['/uploads/custom.jpg'] = {'id': '/uploads/custom.jpg', 'owner_id': 'owner'}
    current['sellers']['maya']['owner_id'] = 'owner'
    reset = demo.prepare(current, reset=True)
    assert reset['orders'] == reset['bundles'] == {}
    assert len(reset['listings']) == 27
    assert reset['listings']['tv-01']['available']
    assert not reset['listings']['tv-sold']['available']
    assert reset['listings']['desk-future']['available_date'] == '2099-01-01'
    assert reset['accounts'] == current['accounts']
    assert reset['uploads'] == current['uploads']
    assert reset['sellers']['maya']['owner_id'] == 'owner'


def test_backend_serves_demo_photos_and_legacy_receipt_urls(tmp_path):
    from fastapi.testclient import TestClient
    from app.main import create_app
    from app.db.store import LocalStore
    with TestClient(create_app(store=LocalStore(tmp_path / 'data.json'), uploads_dir=tmp_path / 'uploads')) as client:
        for lid in PHOTO_LISTINGS:
            response = client.get(f'/uploads/demo/{lid}.jpg')
            assert response.status_code == 200
            assert response.headers['content-type'] == 'image/jpeg'
            assert client.get(f'/images/demo/{lid}.jpg').content == response.content


def test_cli_preview_does_not_write_and_reset_backs_up(tmp_path, monkeypatch):
    import json
    path = tmp_path / 'demo.json'
    original = demo.prepare({})
    original['orders']['saved'] = {'id': 'saved'}
    path.write_text(json.dumps(original))
    monkeypatch.setattr(demo, 'ROOT', tmp_path)
    monkeypatch.setattr(demo, 'install_demo_photos', lambda _: None)
    monkeypatch.setattr('sys.argv', ['demo_data.py', '--local', str(path), '--reset'])
    demo.main()
    assert json.loads(path.read_text()) == original
    assert not (tmp_path / 'backend/data').exists()
    monkeypatch.setattr('sys.argv', ['demo_data.py', '--local', str(path), '--reset', '--apply'])
    demo.main()
    assert json.loads(path.read_text())['orders'] == {}
    backups = list((tmp_path / 'backend/data').glob('demo-backup-*.json'))
    assert len(backups) == 1
    assert json.loads(backups[0].read_text()) == original
