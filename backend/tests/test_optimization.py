from datetime import date
from decimal import Decimal
from itertools import permutations
import pytest
from app.schemas import BundleRequest, Listing, Seller
from app.seed import seed_data
from app.services.bundle_service import generate_bundles, delivery_fee
from app.services.route_optimizer import MapProvider, Matrix, RouteUnavailable, solve_order


@pytest.fixture
def request_data():
    return BundleRequest(categories=['tv','tv_stand','desk','chair'],budget=300,buyer_has_car=False,buyer_location={'lat':40.443,'lng':-79.943})


def run(req, listings=None, sellers=None):
    seeded_sellers, seeded_listings = seed_data()
    return generate_bundles(listings if listings is not None else seeded_listings,
                            {s.id:s for s in (sellers if sellers is not None else seeded_sellers)}, req, MapProvider())


def test_seed_returns_three_distinct_valid_bundles(request_data):
    result = run(request_data)
    assert len(result['bundles']) == 3
    identities = set()
    for b in result['bundles']:
        ids = tuple(sorted(i['id'] for i in b['listings']))
        identities.add(ids)
        assert len(ids) == len(set(ids)) == 4
        assert {i['category'] for i in b['listings']} == set(request_data.categories)
        assert sum(Decimal(str(i['price'])) for i in b['listings']) <= request_data.budget
        assert all(i['available'] and i['available_date'] <= date.today().isoformat() for i in b['listings'])
        assert b['driver']['can_drive']
        assert b['driver']['id'] in {i['seller_id'] for i in b['listings']}
        assert b['total_size'] <= b['driver']['vehicle_capacity']
        assert b['route']['stops'][0]['seller_id'] == b['driver']['id']
        assert b['route']['stops'][-1]['kind'] == 'buyer'
        assert {s['seller_id'] for s in b['route']['stops'] if s['kind']=='seller'} == {i['seller_id'] for i in b['listings']}
        assert len(b['route']['stops']) == b['seller_count']+1
        assert b['total'] == round(b['item_total']+b['delivery_fee'],2)
    assert len(identities) == 3
    assert result['diagnostics']['filtered_out']['unavailable'] == 2
    assert result['diagnostics']['filtered_out']['price'] == 1
    assert result['diagnostics']['filtered_out']['distance'] == 1


def test_deterministic_ranking(request_data):
    first, second = run(request_data), run(request_data)
    summarize = lambda r: [(tuple(i['id'] for i in b['listings']), b['driver']['id'], b['route'], b['final_score']) for b in r['bundles']]
    assert summarize(first) == summarize(second)


def test_no_driver_rejected_but_self_pickup_works(request_data):
    sellers, items = seed_data()
    sellers = [s.model_copy(update={'can_drive':False,'vehicle_type':None}) for s in sellers]
    assert run(request_data, items, sellers)['bundles'] == []
    result = run(request_data.model_copy(update={'buyer_has_car':True}), items, sellers)
    assert len(result['bundles']) == 3
    for b in result['bundles']:
        assert b['driver'] is None and b['delivery_fee'] == 0
        assert b['route']['stops'][0]['kind'] == b['route']['stops'][-1]['kind'] == 'buyer'
        assert len(b['route']['stops']) == b['seller_count']+2


def test_insufficient_capacity_and_unselected_driver_rejected(request_data):
    sellers, items = seed_data()
    sellers = [s.model_copy(update={'can_drive':True,'vehicle_type':'sedan'}) for s in sellers]
    assert run(request_data, items, sellers)['bundles'] == []
    sellers, items = seed_data()
    items = [i for i in items if i.seller_id in ('maya','sam')]
    assert run(request_data, items, sellers)['bundles'] == []


def test_budget_and_missing_category(request_data):
    assert run(request_data.model_copy(update={'budget':Decimal('1')}))['bundles'] == []
    sellers, items = seed_data()
    result = run(request_data, [i for i in items if i.category!='chair'], sellers)
    assert result['bundles'] == []
    assert result['diagnostics']['solver_status'] == 'missing_category'


def test_exact_budget_and_capacity_boundary():
    seller = Seller(id='one',name='One',can_drive=True,vehicle_type='sedan',location={'lat':40.44,'lng':-79.94})
    items = [Listing(id=str(n),seller_id='one',title='Item',category=c,price='10.01',condition_score=8,item_size=2,
                     location=seller.location,available_date=date(2020,1,1)) for n,c in enumerate(['tv','chair'])]
    req = BundleRequest(categories=['tv','chair'],budget='20.02',buyer_has_car=False,buyer_location={'lat':40.443,'lng':-79.943})
    assert len(run(req,items,[seller])['bundles']) == 1
    assert run(req.model_copy(update={'budget':Decimal('20.01')}),items,[seller])['bundles'] == []
    items[0] = items[0].model_copy(update={'item_size':3})
    assert run(req,items,[seller])['bundles'] == []


def test_route_order_matches_exhaustive_small_fixture():
    d = [[0,9,1,8],[9,0,7,1],[1,7,0,9],[8,1,9,0]]
    matrix = Matrix(d,d)
    for start,end in [(0,0),(1,0)]:
        result = solve_order(matrix,start,end)
        cost = lambda p: sum(d[a][b] for a,b in zip(p,p[1:]))
        middle = [i for i in range(4) if i not in (start,end)]
        best = min(cost([start,*p,end]) for p in permutations(middle))
        assert cost(result) == best
        assert sorted(result[1:-1]) == sorted(middle)


def test_unreachable_road_is_not_silently_estimated():
    matrix = Matrix([[0,None],[None,0]], [[0,None],[None,0]], source='mapbox')
    with pytest.raises(RouteUnavailable):
        solve_order(matrix,1,0)


def test_reward_formula():
    assert delivery_fee(9,3) == 18


def test_demo_rejection_report_reconciles(request_data):
    result=run(request_data)
    report=result['diagnostics']['combination_checks']
    assert report['examined']==result['diagnostics']['possible_combinations']
    assert report['feasible_before_routing'] + sum(report['rejected'].values()) == report['examined']
    assert all(report['rejected'][reason] > 0 for reason in ('budget','no_driver','capacity'))
    pickup=run(request_data.model_copy(update={'buyer_has_car':True}))['diagnostics']['combination_checks']
    assert pickup['rejected']['no_driver']==pickup['rejected']['capacity']==0
