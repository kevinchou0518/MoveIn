from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import timedelta
import importlib.util
import json
from pathlib import Path
import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.catalog import builtin_categories
from app.db.store import LocalStore
from support import create_app
from app.schemas import BundleRequest, Location, utcnow
from app.services.bundle_service import generate_bundles
from app.services.discovery_ai import DiscoveryAI, ParseRequest, ResearchRequest
from app.services.route_optimizer import MapProvider

REQUEST = {'categories': ['tv', 'tv_stand', 'desk', 'chair'], 'budget': 300, 'buyer_has_car': False, 'buyer_location': {'lat': 40.443, 'lng': -79.943}, 'ranking': 'balanced'}

@pytest.fixture
def api(tmp_path):
    store = LocalStore(tmp_path / 'data.json')
    with TestClient(create_app(store, MapProvider(), tmp_path / 'uploads', discovery_ai=DiscoveryAI())) as client:
        yield client, store

def test_custom_catalog_and_bundle(api):
    client, store = api
    with ThreadPoolExecutor(max_workers=2) as pool:
        rows = list(pool.map(store.add_category, ['Bookcase', '  BOOKCASE  ']))
    assert rows[0]['id'] == rows[1]['id']
    assert store.add_category('tv_stand')['id'] == 'tv_stand'
    assert store.add_category('office chair')['id'] == 'chair'
    assert client.post('/categories', json={'name': '   '}).status_code == 422
    c = rows[0]
    payload = {'seller_id': 'jordan', 'title': 'Bookcase', 'category': c['id'], 'price': 20, 'condition_score': 8, 'item_size': 2}
    listing = client.post('/listings', json=payload).json()
    result = client.post('/bundles/generate', json={**REQUEST, 'categories': [c['id']]}).json()
    assert result['bundles'][0]['listings'][0]['id'] == listing['id']
    assert c in LocalStore(store.path).categories()
    assert client.post('/listings', json={**payload, 'category': 'not_created'}).status_code == 422
    assert client.post('/bundles/generate', json={**REQUEST, 'categories': list('abcdefg')}).status_code == 422

@pytest.mark.parametrize('ranking,key', [('balanced', lambda b: -b['final_score']), ('lowest_cost', lambda b: b['total']), ('best_condition', lambda b: -sum(i['condition_score'] for i in b['listings'])/len(b['listings'])), ('fastest_trip', lambda b: b['duration_minutes'])])
def test_rankings_keep_constraints_and_stable_order(api, ranking, key):
    _, store = api
    req = BundleRequest(**{**REQUEST, 'ranking': ranking})
    def run(): return generate_bundles(store.listings(), store.sellers(), req, MapProvider())['bundles']
    first, second = run(), run()
    assert len(first) == 3
    assert [key(b) for b in first] == sorted(key(b) for b in first)
    assert [[i['id'] for i in b['listings']] for b in first] == [[i['id'] for i in b['listings']] for b in second]
    for b in first:
        assert b['request']['ranking'] == ranking and b['ranking_reason']
        assert b['item_total'] <= 300 and b['total_size'] <= b['driver']['vehicle_capacity']
        assert b['driver']['id'] in {i['seller_id'] for i in b['listings']}


def test_swap_versions_reservation_and_fresh_search(api):
    client, store = api
    b = client.post('/bundles/generate', json=REQUEST).json()['bundles'][0]
    old = deepcopy(b)
    selected = next(i for i in b['listings'] if i['category'] == 'chair')
    response = client.post(f"/bundles/{b['id']}/alternatives", json={'listing_id': selected['id']})
    assert response.status_code == 200
    options = response.json()['bundles']
    assert 1 <= len(options) <= 3
    retained = {i['id'] for i in b['listings']} - {selected['id']}
    for alt in options:
        assert alt['id'] != b['id'] and alt['parent_bundle_id'] == b['id']
        assert retained < {i['id'] for i in alt['listings']}
        assert selected['id'] not in {i['id'] for i in alt['listings']}
        assert alt['item_total'] <= 300 and alt['total_size'] <= alt['driver']['vehicle_capacity']
        assert alt['total_difference'] == round(alt['total'] - b['total'], 2)
    assert store.get_bundle(b['id']) == old
    chosen = options[0]
    order = client.post(f"/bundles/{chosen['id']}/checkout").json()
    assert client.get(f"/orders/{order['id']}").json() == order
    assert client.get(f"/bundles/{chosen['id']}").json()['order_id'] == order['id']
    assert client.post(f"/bundles/{chosen['id']}/alternatives", json={'listing_id': chosen['listings'][0]['id']}).status_code == 409
    new = client.post('/bundles/generate', json=REQUEST).json()['bundles']
    reserved = {i['id'] for i in chosen['listings']}
    assert all(not reserved.intersection(i['id'] for i in option['listings']) for option in new)
    from app.services.orders import order_view
    restored = LocalStore(store.path)
    assert order_view(restored.snapshot(), restored.get_order(order['id']), 'test-account') == order

@pytest.mark.parametrize('failure,expected', [('expired', 410), ('unavailable', 409), ('price', 409), ('legacy', 409), ('wrong_item', 422)])
def test_swap_rechecks_source(api, failure, expected):
    client, store = api
    b = client.post('/bundles/generate', json=REQUEST).json()['bundles'][0]
    bid, item = b['id'], b['listings'][0]['id']
    if failure == 'expired': store.data['bundles'][bid]['created_at'] = (utcnow() - timedelta(minutes=31)).isoformat()
    if failure == 'unavailable': store.data['listings'][item]['available'] = False
    if failure == 'price': store.data['listings'][item]['price'] = '99.00'
    if failure == 'legacy': del store.data['bundles'][bid]['request']
    assert client.post(f'/bundles/{bid}/alternatives', json={'listing_id': 'missing' if failure == 'wrong_item' else item}).status_code == expected
    if failure == 'legacy':
        assert client.get(f'/bundles/{bid}').status_code == 200
        assert client.post(f'/bundles/{bid}/checkout').status_code == 201

@pytest.mark.parametrize('reason', ['no_driver', 'capacity', 'budget', 'radius', 'future'])
def test_unfulfillable_swaps_return_empty(api, reason):
    client, store = api
    b = client.post('/bundles/generate', json={**REQUEST, 'categories': ['chair']}).json()['bundles'][0]
    original = b['listings'][0]
    for i in store.data['listings'].values():
        if i['category'] != 'chair' or i['id'] == original['id']: continue
        if reason == 'budget': i['price'] = '900.00'
        if reason == 'radius': i['location'] = {'lat': 41.5, 'lng': -80.1}
        if reason == 'future': i['available_date'] = '2099-01-01'
        if reason in ('no_driver', 'capacity'):
            s = store.data['sellers'][i['seller_id']]
            if reason == 'no_driver': s.update(can_drive=False, vehicle_type=None)
            else: s.update(can_drive=True, vehicle_type='sedan'); i['item_size'] = 3
    if reason == 'capacity':
        fixed = store.data['listings']['desk-01']; fixed['price'] = '1.00'
        store.data['bundles'][b['id']]['listings'].append(deepcopy(fixed))
        store.data['bundles'][b['id']]['request']['categories'].append('desk')
    response = client.post(f"/bundles/{b['id']}/alternatives", json={'listing_id': original['id']})
    assert response.status_code == 200, response.text
    assert response.json()['bundles'] == []


def ai_response(value, citations=()):
    return httpx.Response(200, json={'output': [{'type': 'message', 'content': [{'type': 'output_text', 'text': json.dumps(value), 'annotations': [{'type': 'url_citation', 'url': c} for c in citations]}]}]})


class FakeGeocoder:
    def __init__(self, found=None, fail=False, matched=None): self.found, self.fail, self.matched, self.queries = found or [], fail, matched, []
    def resolve(self, query):
        self.queries.append(query)
        if self.fail: raise HTTPException(503, 'Address search is unavailable.')
        location = self.found[0] if self.found else None
        return location, (self.matched or location.label) if location else None


def test_buyer_parser_preserves_missing_fields_and_filters_unknowns():
    payload = {'categories': ['chair', 'made_up'], 'budget': 125, 'buyer_has_car': None, 'location_text': 'Oakland', 'ranking': None, 'explanations': []}
    def handler(request):
        data = json.loads(request.content)
        assert data['store'] is False and 'tools' not in data
        assert 'buyer_location' not in data['text']['format']['schema']['properties']
        return ai_response(payload)
    oakland = Location(lat=40.443, lng=-79.943, label='Oakland, Pittsburgh, PA')
    geocoder = FakeGeocoder([oakland, Location(lat=37.8, lng=-122.27, label='Oakland, CA')])
    draft = DiscoveryAI('test', transport=httpx.MockTransport(handler)).parse(ParseRequest(text='chair and something else'), builtin_categories(), geocoder)
    assert draft.categories == ['chair'] and draft.buyer_has_car is None and draft.ranking is None and draft.explanations
    assert geocoder.queries == ['Oakland'] and draft.location_text == 'Oakland' and draft.buyer_location == oakland
    assert draft.explanations == ['Some requested categories are not available in the catalog.']


def test_buyer_parser_drops_notes_about_unmentioned_fields():
    notes = ['Unknown buyer_has_car', 'Unknown ranking preference', 'Budget not specified', 'quantities not specified', 'Location unclear',
             'Quantity greater than one requested for chair', 'monitor is not in the catalog', 'Budget may include delivery']
    payload = {'categories': ['chair'], 'budget': 200, 'buyer_has_car': None, 'location_text': None, 'ranking': None, 'explanations': notes}
    draft = DiscoveryAI('test', transport=httpx.MockTransport(lambda r: ai_response(payload))).parse(ParseRequest(text='two chairs and a monitor for $200'), builtin_categories())
    assert draft.explanations == notes[5:]


def test_buyer_parser_keeps_stated_place_when_map_matches_only_the_street():
    payload = {'categories': ['chair'], 'budget': None, 'buyer_has_car': True, 'location_text': 'Kenmawr, Shady Avenue', 'ranking': None, 'explanations': []}
    street = 'Shady Avenue, Pittsburgh, Pennsylvania 15217, United States'
    geocoder = FakeGeocoder([Location(lat=40.45, lng=-79.92, label='Kenmawr, Shady Avenue, Pittsburgh, Pennsylvania 15217, United States')], matched=street)
    draft = DiscoveryAI('test', transport=httpx.MockTransport(lambda r: ai_response(payload))).parse(ParseRequest(text='chair, I live in Kenmawr, Shady Avenue'), builtin_categories(), geocoder)
    assert draft.buyer_location.label.startswith('Kenmawr, Shady Avenue') and (draft.buyer_location.lat, draft.buyer_location.lng) == (40.45, -79.92)
    assert draft.explanations == [f'The map does not list that place, so its position uses the closest match: {street}. Edit the location if that is wrong.']


@pytest.mark.parametrize('geocoder', [FakeGeocoder(fail=True), FakeGeocoder([]), None])
def test_buyer_parser_falls_back_to_location_text(geocoder):
    payload = {'categories': ['chair'], 'budget': None, 'buyer_has_car': False, 'location_text': 'Nowhere', 'ranking': None, 'explanations': []}
    draft = DiscoveryAI('test', transport=httpx.MockTransport(lambda r: ai_response(payload))).parse(ParseRequest(text='chair near Nowhere'), builtin_categories(), geocoder)
    assert draft.buyer_location is None and draft.location_text == 'Nowhere' and draft.buyer_has_car is False
    assert bool(draft.explanations) == (geocoder is not None)


def test_buyer_parse_endpoint_skips_geocoding_without_location(api):
    client, _ = api
    payload = {'categories': ['desk'], 'budget': 80, 'buyer_has_car': True, 'location_text': None, 'ranking': 'lowest_cost', 'explanations': []}
    client.app.state.discovery = DiscoveryAI('test', transport=httpx.MockTransport(lambda r: ai_response(payload)))
    client.app.state.geocoder = FakeGeocoder(fail=True)
    response = client.post('/buyer/parse', json={'text': 'cheap desk, I have a car'})
    assert response.status_code == 200, response.text
    assert response.json() == {**payload, 'buyer_location': None}
    assert client.app.state.geocoder.queries == []

@pytest.mark.parametrize('used_count', [2, 3])
def test_price_range_requires_three_cited_used_asking_prices(used_count):
    rows = [{'title': f'Chair {i}', 'url': f'https://example.com/{i}', 'price': 20+i*10, 'currency': 'USD', 'kind': 'used_asking' if i < used_count else 'new_retail', 'condition': 'good'} for i in range(4)]
    rows.append({**rows[0], 'url': 'https://uncited.example/1', 'price': 1})
    def handler(request):
        body = json.loads(request.content)
        assert body['max_tool_calls'] == 5 and body['tools'] == [{'type': 'web_search'}]
        return ai_response({'comparables': rows, 'summary': 'Ignored model range'}, [r['url'] for r in rows[:4]])
    result = DiscoveryAI('test', transport=httpx.MockTransport(handler)).research(ResearchRequest(category='chair', title='Chair', condition='good'))
    assert len(result['comparables']) == 4
    assert result['price_min'] == (20 if used_count == 3 else None)
    assert result['price_max'] == (40 if used_count == 3 else None)

@pytest.mark.parametrize('failure,status', [('timeout', 504), ('invalid', 502), ('outage', 502), ('missing_key', 503)])
def test_ai_errors_are_sanitized(failure, status):
    def handler(request):
        if failure == 'timeout': raise httpx.ReadTimeout('secret provider message')
        return httpx.Response(503 if failure == 'outage' else 200, text='secret provider message')
    ai = DiscoveryAI('' if failure == 'missing_key' else 'test', transport=httpx.MockTransport(handler))
    with pytest.raises(HTTPException) as e: ai.parse(ParseRequest(text='chair'), builtin_categories())
    assert e.value.status_code == status and 'secret' not in e.value.detail


def test_photo_migration_preserves_reservations_and_customizations(api):
    _, store = api
    spec = importlib.util.spec_from_file_location('migration', Path(__file__).parents[2] / 'scripts/migrate_demo_photos.py')
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    data = deepcopy(store.data)
    data['listings']['tv-01'].update(title='Samsung 40” LED TV', image_url='/images/tv.svg', available=False)
    data['listings']['chair-05']['title'] = 'Seller customized title'
    del data['listings']['fan-01']
    updates, additions = module.changes(data['listings'])
    assert [g['id'] for g, _ in updates] == ['tv-01']
    for guard, patch in updates: data['listings'][guard['id']].update(patch)
    for item in additions: data['listings'][item['id']] = item
    assert not data['listings']['tv-01']['available']
    assert data['listings']['chair-05']['title'] == 'Seller customized title'
    assert data['orders'] == store.data['orders'] and data['bundles'] == store.data['bundles']
    assert module.changes(data['listings']) == ([], [])
