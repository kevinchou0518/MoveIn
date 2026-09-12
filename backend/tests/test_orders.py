from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import importlib.util
from pathlib import Path
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.auth import Authenticator
from app.main import create_app
from app.db.store import LocalStore, StoreError
from app.services.route_optimizer import MapProvider
from app.services import orders

REQUEST = {'categories': ['tv', 'tv_stand', 'desk', 'chair'], 'budget': 300, 'buyer_has_car': False,
           'buyer_location': {'lat': 40.443, 'lng': -79.943}, 'radius_miles': 25}

class FixtureAuth:
    def authenticate(self, authorization):
        if not authorization or not authorization.startswith('Bearer '):
            raise HTTPException(401, 'Sign in')
        return {'id': authorization[7:], 'subject': authorization[7:], 'issuer': 'https://test.invalid/'}

@pytest.fixture
def market(tmp_path):
    store = LocalStore(tmp_path / 'db.json')
    for sid, seller in store.data['sellers'].items():
        seller['owner_id'] = sid
    with TestClient(create_app(store, MapProvider(), tmp_path / 'uploads', authenticator=FixtureAuth())) as client:
        yield client, store

def headers(actor='buyer'):
    return {'Authorization': 'Bearer ' + actor}

@pytest.mark.parametrize('patch', [{'category': []}, {'category': {}}, {'image_url': 123}, {'image_url': []}, {'price': -1}, {'title': None}, {'category': 'unknown_category'}])
def test_invalid_listing_patch_returns_422_without_mutation(market, patch):
    client, store = market
    before = store.snapshot()
    response = client.patch('/listings/tv-01', json=patch, headers=headers('maya'))
    assert response.status_code == 422, response.text
    assert store.snapshot() == before

def test_edit_withdrawn_listing_preserves_withdrawal(market):
    client, _ = market
    client.post('/listings/tv-01/withdraw', headers=headers('maya'))
    response = client.patch('/listings/tv-01', json={'title': 'Updated TV'}, headers=headers('maya'))
    assert response.status_code == 200
    assert response.json()['title'] == 'Updated TV'
    assert response.json()['status'] == 'withdrawn'
    assert response.json()['available'] is False

def reserve(client, pickup=False):
    response = client.post('/bundles/generate', json={**REQUEST, 'buyer_has_car': pickup}, headers=headers())
    assert response.status_code == 200, response.text
    bundle = response.json()['bundles'][0]
    response = client.post(f'/bundles/{bundle["id"]}/checkout', headers=headers())
    assert response.status_code == 201, response.text
    return response.json()

def test_account_and_order_isolation(market):
    client, _ = market
    assert client.get('/me').status_code == 401
    assert client.get('/listings').status_code == 200
    assert client.get('/me', headers=headers('maya')).json()['sellers'][0]['id'] == 'maya'
    order = reserve(client)
    assert client.get('/orders', headers=headers()).json()['total'] == 1
    assert client.get('/orders', headers=headers('stranger')).json()['total'] == 0
    assert client.get('/orders/' + order['id'], headers=headers('stranger')).status_code == 404
    assert client.get('/bundles/' + order['bundle_id'], headers=headers('stranger')).status_code == 404
    assert client.post('/orders/' + order['id'] + '/cancel', json={'reason': 'x'}, headers=headers('stranger')).status_code == 403
    assert client.get('/deliveries/riley', headers=headers('stranger')).status_code == 403

def test_authentication_failure_has_cors_headers(market):
    client, _ = market
    response = client.get('/me', headers={'Origin': 'http://localhost:5173'})
    assert response.status_code == 401
    assert response.headers['access-control-allow-origin'] == 'http://localhost:5173'

def test_owned_profile_updates_available_pickup_locations(market):
    client, store = market
    changed = {'lat':40.45, 'lng':-79.95, 'label':'New pickup'}
    assert client.patch('/sellers/maya', json={'location': changed}, headers=headers('stranger')).status_code == 403
    result = client.patch('/sellers/maya', json={'location': changed}, headers=headers('maya'))
    assert result.status_code == 200
    assert all(i['location'] == changed for i in store.data['listings'].values() if i['seller_id'] == 'maya')

def test_atomic_failure_rolls_back_local_data(market, monkeypatch):
    client, store = market
    order = reserve(client)
    before = store.snapshot()
    def fail(): raise OSError('disk full')
    monkeypatch.setattr(store, '_save', fail)
    with pytest.raises(OSError):
        store.atomic(lambda d: orders.transition(d, order['id'], 'buyer', 'cancel', 'Changed plans'))
    assert store.snapshot() == before

def test_cancel_release_idempotency_and_fresh_checkout(market):
    client, store = market
    order = reserve(client)
    url = '/orders/' + order['id'] + '/cancel'
    assert client.post(url, json={'reason': '  '}, headers=headers()).status_code == 422
    cancelled = client.post(url, json={'reason': 'Plans changed'}, headers=headers()).json()
    assert cancelled['status'] == 'cancelled'
    assert client.post(url, json={'reason': 'Duplicate'}, headers=headers()).json() == cancelled
    assert all(store.data['listings'][i['id']]['available'] for i in order['bundle']['listings'])
    repeated = client.post('/bundles/' + order['bundle_id'] + '/checkout', headers=headers()).json()
    assert repeated['id'] == order['id'] and repeated['status'] == 'cancelled'
    assert reserve(client)['id'] != order['id']

def test_mutation_preserves_selected_seller_context(market):
    client, store = market
    order = reserve(client)
    driver = order['bundle']['driver']['id']
    sid = next(s['id'] for s in order['bundle']['sellers'] if s['id'] != driver)
    for seller in store.data['sellers'].values():
        seller['owner_id'] = 'shared-owner'
    url = '/orders/' + order['id']
    before = store.snapshot()
    assert client.post(url + '/start?seller_id=' + sid, headers=headers('shared-owner')).status_code == 403
    assert client.post(url + '/cancel?seller_id=missing', json={'reason':'Unavailable'}, headers=headers('shared-owner')).status_code in (403,404)
    assert store.snapshot() == before
    response = client.post(url + '/cancel?seller_id=' + sid, json={'reason':'Unavailable'}, headers=headers('shared-owner'))
    assert response.status_code == 200, response.text
    result = response.json()
    assert result['status'] == 'cancelled'
    assert result['viewer_role'] == 'seller'
    assert set(result['bundle']) == {'listings','sellers','driver_name','transportation_mode'}
    assert all(item['seller_id'] == sid for item in result['bundle']['listings'])
    repeated = client.post(url + '/cancel?seller_id=' + sid, json={'reason':'Unavailable'}, headers=headers('shared-owner'))
    assert repeated.json() == result

@pytest.mark.parametrize('pickup', [False, True])
def test_fulfillment_authority_and_inventory(market, pickup):
    client, store = market
    order = reserve(client, pickup)
    prefix = '/orders/' + order['id']
    starter = 'buyer' if pickup else order['bundle']['driver']['id']
    assert client.post(prefix + '/complete', headers=headers()).status_code == 409
    if not pickup:
        assert client.post(prefix + '/start', headers=headers()).status_code == 403
    started = client.post(prefix + '/start', headers=headers(starter))
    assert started.status_code == 200 and started.json()['status'] == 'in_progress'
    assert client.post(prefix + '/cancel', json={'reason': 'late'}, headers=headers()).status_code == 409
    assert client.post(prefix + '/complete', headers=headers('stranger')).status_code == 403
    assert client.post(prefix + '/complete', headers=headers()).json()['status'] == 'completed'
    assert client.post(prefix + '/complete', headers=headers()).json()['status'] == 'completed'
    assert all(store.data['listings'][i['id']]['status'] == 'sold' for i in order['bundle']['listings'])

def test_seller_order_redaction_and_cancellation(market):
    client, _ = market
    order = reserve(client)
    sid = next(s['id'] for s in order['bundle']['sellers'] if s['id'] != order['bundle']['driver']['id'])
    listing = client.get(f'/sellers/{sid}/orders', headers=headers(sid)).json()
    assert listing['total'] == 1
    result = listing['items'][0]
    assert result['viewer_role'] == 'seller'
    assert 'route' not in result['bundle'] and 'request' not in result['bundle']
    assert all(i['seller_id'] == sid for i in result['bundle']['listings'])
    assert client.get(f'/sellers/{sid}/deliveries', headers=headers(sid)).json()['total'] == 0
    assert client.post('/orders/' + order['id'] + '/cancel', json={'reason': 'Item unavailable'}, headers=headers(sid)).json()['status'] == 'cancelled'

def test_listing_and_logistics_guards(market):
    client, store = market
    bundle = client.post('/bundles/generate', json=REQUEST, headers=headers()).json()['bundles'][0]
    item = bundle['listings'][0]
    url = '/listings/' + item['id']
    owner = headers(item['seller_id'])
    assert client.patch(url, json={'title': 'Edited'}, headers=headers()).status_code == 403
    assert client.patch(url, json={'seller_id': 'hijack'}, headers=owner).status_code == 422
    assert client.patch(url, json={'price': -1}, headers=owner).status_code == 422
    assert store.data['listings'][item['id']]['price'] == str(item['price']) or float(store.data['listings'][item['id']]['price']) == item['price']
    assert client.patch(url, json={'title': 'Edited'}, headers=owner).status_code == 200
    assert client.post('/bundles/' + bundle['id'] + '/checkout', headers=headers()).status_code == 409
    assert client.post(url + '/withdraw', headers=owner).json()['status'] == 'withdrawn'
    assert client.post(url + '/publish', headers=owner).json()['available']
    order = reserve(client)
    item = order['bundle']['listings'][0]
    assert client.patch('/listings/' + item['id'], json={'title': 'Too late'}, headers=headers(item['seller_id'])).status_code == 409
    assert client.patch('/sellers/' + item['seller_id'], json={'location': {'lat': 40, 'lng': -79}}, headers=headers(item['seller_id'])).status_code == 409

def test_old_cancel_cannot_release_a_new_hold(market):
    client, store = market
    order = reserve(client)
    lid = order['bundle']['listings'][0]['id']
    store.data['listings'][lid]['reserved_order_id'] = 'new-order'
    assert client.post('/orders/' + order['id'] + '/cancel', json={'reason': 'old'}, headers=headers()).status_code == 200
    assert store.data['listings'][lid]['reserved_order_id'] == 'new-order'
    assert not store.data['listings'][lid]['available']

def test_cancel_racing_with_start_is_atomic(market):
    client, store = market
    order = reserve(client)
    driver = order['bundle']['driver']['id']
    def change(action):
        try:
            return store.atomic(lambda d: orders.transition(d, order['id'], driver if action == 'start' else 'buyer', action, 'Changed plans'))['status']
        except StoreError as exc:
            return exc.status
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(change, ['cancel', 'start']))
    assert 409 in results
    final = store.get_order(order['id'])['status']
    assert final in ('cancelled', 'in_progress')
    assert all(store.data['listings'][i['id']]['available'] == (final == 'cancelled') for i in order['bundle']['listings'])

def test_upload_ownership(market):
    from io import BytesIO
    from PIL import Image
    client, _ = market
    image = BytesIO(); Image.new('RGB', (3,3)).save(image, format='PNG')
    url = client.post('/uploads', headers=headers('maya'), files={'file': ('test.png', image.getvalue(), 'image/png')}).json()['image_url']
    assert client.post('/listings/analyze', json={'image_url': url}, headers=headers('stranger')).status_code == 403
    assert client.patch('/listings/tv-01', json={'image_url': url}, headers=headers('maya')).status_code == 200

def test_demo_identity_selection():
    auth = Authenticator()
    assert auth.authenticate(None)['subject'] == 'maya'
    assert auth.authenticate('Bearer demo-seller')['subject'] == 'riley'
    with pytest.raises(HTTPException):
        auth.authenticate('Bearer unknown')

@pytest.mark.parametrize('subject',['maya','jordan','alex','sam','riley','jamie','distant'])
def test_every_demo_user_can_buy_and_create_selling_profile(tmp_path, subject):
    store=LocalStore(tmp_path / 'demo.json')
    with TestClient(create_app(store, MapProvider(), tmp_path / 'uploads')) as client:
        identity=headers(subject)
        response=client.post('/sellers',headers=identity,json={'name':'My profile','location':{'lat':40.44,'lng':-79.94,'label':'Oakland'},'can_drive':False})
        assert response.status_code == 201
        sid=response.json()['id']
        assert sid in [s['id'] for s in client.get('/me',headers=identity).json()['sellers']]
        bundles=client.post('/bundles/generate',json=REQUEST,headers=identity)
        assert bundles.status_code == 200
        bid=bundles.json()['bundles'][0]['id']
        order=client.post(f'/bundles/{bid}/checkout',headers=identity)
        assert order.status_code == 201
        assert client.get('/orders',headers=identity).json()['total'] == 1

def test_demo_seed_ownership_is_repeatable(tmp_path):
    store = LocalStore(tmp_path / 'demo.json')
    with TestClient(create_app(store, MapProvider(), tmp_path / 'uploads')) as client:
        for subject in ['maya','jordan','alex','sam','riley','jamie','distant']:
            owned = client.get('/me', headers=headers(subject)).json()['sellers']
            assert [seller['id'] for seller in owned] == [subject]
        assert client.patch('/sellers/maya', json={'name':'Wrong'}, headers=headers('jordan')).status_code == 403
        before = store.snapshot()
        from app.auth import initialize_demo_accounts
        store.atomic(initialize_demo_accounts)
        assert store.snapshot() == before

def test_existing_demo_records_migrate_to_individual_users_without_inventory_changes(tmp_path):
    from app.auth import account_id, DEMO_ISSUER, initialize_demo_accounts
    store=LocalStore(tmp_path / 'demo.json')
    old_seller=account_id(DEMO_ISSUER,'demo-seller')
    old_buyer=account_id(DEMO_ISSUER,'demo-buyer')
    for seller in store.data['sellers'].values(): seller['owner_id']=old_seller
    store.data['bundles']['saved']={'id':'saved','buyer_id':old_buyer}
    store.data['orders']['saved']={'id':'saved','buyer_id':old_buyer,'status':'reserved','bundle':{'buyer_id':old_buyer}}
    store.data['uploads']={'photo':{'id':'photo','owner_id':old_seller}}
    inventory=deepcopy(store.data['listings'])
    store.atomic(initialize_demo_accounts)
    assert store.data['orders']['saved']['buyer_id']==account_id(DEMO_ISSUER,'maya')
    assert store.data['orders']['saved']['status']=='reserved'
    assert store.data['uploads']['photo']['owner_id']==account_id(DEMO_ISSUER,'riley')
    assert store.data['listings']==inventory
    for sid,seller in store.data['sellers'].items(): assert seller['owner_id']==account_id(DEMO_ISSUER,sid)
    before=store.snapshot()
    store.atomic(initialize_demo_accounts)
    assert store.snapshot()==before

def test_explicit_account_migration_is_idempotent_and_preserves_history(market):
    client, store = market
    order = reserve(client)
    spec = importlib.util.spec_from_file_location('account_migration', Path(__file__).parents[2] / 'scripts/account_migration.py')
    migration = importlib.util.module_from_spec(spec); spec.loader.exec_module(migration)
    data = deepcopy(store.data)
    old = data['orders'].pop(order['id']); oid = sorted(migration.LEGACY_ORDERS)[0]
    old.update(id=oid, buyer_id=None); data['orders'][oid] = old
    for item in old['bundle']['listings']:
        data['listings'][item['id']].update(available=True, status='available', reserved_order_id=None)
    for seller in data['sellers'].values(): seller['owner_id'] = None
    mapping = {'issuer': 'https://test.invalid/', 'buyer_sub': 'buyer', 'sellers': {'maya': 'seller'}}
    result = migration.assign_accounts(data, mapping)
    assert result['orders'][oid]['status'] == 'cancelled'
    assert result['orders'][oid]['bundle'] == old['bundle']
    assert all(result['listings'][i['id']]['available'] for i in old['bundle']['listings'])
    assert migration.assign_accounts(result, mapping) == result
    assert store.data['orders'][order['id']]['status'] == 'reserved'
    with pytest.raises(ValueError): migration.assign_accounts(result, {**mapping, 'sellers': {'maya': 'different'}})
