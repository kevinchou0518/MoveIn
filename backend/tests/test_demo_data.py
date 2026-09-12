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


def test_address_migration_preserves_orders_inventory_and_custom_locations():
    from copy import deepcopy
    current = demo.prepare({})
    old = {'lat': 40.4512, 'lng': -79.9321, 'label': 'Shadyside'}
    current['sellers']['maya']['location'] = deepcopy(old)
    item = current['listings']['tv-01']
    item.update(location=deepcopy(old), available=False, revision=5, reserved_order_id='order')
    current['orders']['order'] = {'id': 'order', 'status': 'reserved', 'bundle': {'listings': [deepcopy(item)]}}
    current['bundles']['quote'] = {'id': 'quote', 'listings': [deepcopy(item)]}
    custom = {'lat': 40.44, 'lng': -79.95, 'label': 'My custom address'}
    current['sellers']['jordan']['location'] = custom
    before = deepcopy(current)
    updated = demo.migrate_addresses(current)
    assert current == before
    assert updated['sellers']['maya']['location']['label'] == '5436 Walnut Street, Pittsburgh, PA 15232'
    assert updated['sellers']['maya']['revision'] == before['sellers']['maya']['revision'] + 1
    assert updated['listings']['tv-01']['location'] == updated['sellers']['maya']['location']
    assert updated['listings']['tv-01']['revision'] == 6
    assert not updated['listings']['tv-01']['available']
    assert updated['listings']['tv-01']['reserved_order_id'] == 'order'
    for collection in ('orders', 'bundles', 'accounts', 'uploads'):
        assert updated[collection] == before[collection]
    assert updated['sellers']['jordan'] == before['sellers']['jordan']
    assert demo.migrate_addresses(updated) == updated


def test_seed_addresses_are_complete_and_listings_share_them():
    from app.seed import seed_data
    sellers, listings = seed_data()
    by_id = {s.id: s for s in sellers}
    assert len(sellers) == 7
    assert all(', PA ' in s.location.label and s.location.label[0].isdigit() for s in sellers)
    assert all(item.location == by_id[item.seller_id].location for item in listings)
    assert all(', Pittsburgh, PA ' in s.location.label for s in sellers)


def test_meadville_demo_address_migrates_to_pittsburgh():
    from copy import deepcopy
    current = demo.prepare({})
    old = {'lat': 41.639778, 'lng': -80.149919, 'label': '848 North Main Street, Meadville, PA 16335'}
    current['sellers']['distant']['location'] = deepcopy(old)
    current['listings']['chair-far'].update(location=deepcopy(old), title='Out-of-area chair')
    updated = demo.migrate_addresses(current)
    assert updated['sellers']['distant']['location']['label'] == '7101 Hamilton Avenue, Pittsburgh, PA 15208'
    assert updated['listings']['chair-far']['location'] == updated['sellers']['distant']['location']
    assert updated['listings']['chair-far']['title'] == 'Compact accent chair'
    assert demo.migrate_addresses(updated) == updated
    assert current['sellers']['distant']['location'] == old
