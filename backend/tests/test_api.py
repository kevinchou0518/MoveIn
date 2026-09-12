from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from io import BytesIO
from PIL import Image
import pytest
from fastapi.testclient import TestClient
from app.db.store import LocalStore
from app.main import create_app
from app.schemas import utcnow
from app.services.route_optimizer import MapProvider

REQUEST = {'categories':['tv','tv_stand','desk','chair'],'budget':300,'buyer_has_car':False,'buyer_location':{'lat':40.443,'lng':-79.943}}


@pytest.fixture
def api(tmp_path):
    store = LocalStore(tmp_path/'data.json')
    with TestClient(create_app(store,MapProvider(),tmp_path/'uploads')) as client:
        yield client,store


def test_end_to_end_checkout_delivery_and_persistence(api):
    client,store=api
    response = client.post('/bundles/generate',json=REQUEST)
    assert response.status_code == 200
    bundles=response.json()['bundles']
    assert len(bundles)==3
    selected=bundles[0]
    reward=selected['reward_breakdown']
    assert round(reward['base']+reward['distance']+reward['stops_fee'],2)==selected['delivery_fee']
    path=f"/bundles/{selected['id']}/checkout"
    order=client.post(path)
    assert order.status_code == 201
    assert client.post(path).json()['id']==order.json()['id']
    delivery=client.get(f"/deliveries/{selected['driver']['id']}").json()
    assert delivery[0]['bundle_id']==selected['id']
    current={i['id']:i for i in client.get('/listings').json()}
    assert all(not current[i['id']]['available'] for i in selected['listings'])
    reloaded=LocalStore(store.path)
    assert reloaded.checkout(selected['id'])['id']==order.json()['id']
    overlapping=next((b for b in bundles[1:] if {i['id'] for i in b['listings']} & {i['id'] for i in selected['listings']}), None)
    if overlapping:
        assert client.post(f"/bundles/{overlapping['id']}/checkout").status_code==409


def test_concurrent_overlapping_checkout_is_atomic(api):
    client,store=api
    a=client.post('/bundles/generate',json=REQUEST).json()['bundles'][0]
    b=client.post('/bundles/generate',json=REQUEST).json()['bundles'][0]
    assert a['id']!=b['id']
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda bid: client.post(f'/bundles/{bid}/checkout').status_code,[a['id'],b['id']]))
    assert sorted(results)==[201,409]
    assert len(store.data['orders'])==1


def test_expired_unknown_and_missing_seller(api):
    client,store=api
    b=client.post('/bundles/generate',json=REQUEST).json()['bundles'][0]
    store.data['bundles'][b['id']]['created_at']=(utcnow()-timedelta(minutes=31)).isoformat()
    assert client.post(f"/bundles/{b['id']}/checkout").status_code==410
    assert client.post('/bundles/not-found/checkout').status_code==404
    assert client.get('/deliveries/not-found').status_code==404


@pytest.mark.parametrize('patch',[
    {'categories':[]},{'categories':['tv','tv']},{'categories':['office_chair','chair']},
    {'budget':-1},{'budget':'1.001'},{'buyer_location':{'lat':95,'lng':0}},
    {'categories':['unknown']},{'radius_miles':0},
])
def test_invalid_input(api,patch):
    client,_=api
    assert client.post('/bundles/generate',json={**REQUEST,**patch}).status_code==422


def test_upload_publish_filter_and_generate(api):
    client,_=api
    photo=BytesIO()
    Image.new('RGB',(50,50),(100,150,110)).save(photo,format='PNG')
    result=client.post('/uploads',files={'file':('chair.png',photo.getvalue(),'image/png')})
    assert result.status_code==201
    image_url=result.json()['image_url']
    assert client.get(image_url).status_code==200
    seller=client.post('/sellers',json={'name':'Demo Seller','location':{'lat':40.443,'lng':-79.943,'label':'Oakland'},'can_drive':True,'vehicle_type':'truck'})
    assert seller.status_code==201 and seller.json()['vehicle_capacity']==12
    item={'seller_id':seller.json()['id'],'title':'New desk','category':'desk','description':'Test upload','price':10,'condition_score':10,'item_size':2,'image_url':image_url}
    result=client.post('/listings',json=item)
    assert result.status_code==201
    listing=result.json()
    assert listing['location']==seller.json()['location']
    filtered=client.get('/listings?category=desk&available=true').json()
    assert listing['id'] in {i['id'] for i in filtered}
    bundles=client.post('/bundles/generate',json={**REQUEST,'categories':['desk']}).json()['bundles']
    assert listing['id'] in {i['id'] for b in bundles for i in b['listings']}
    assert client.post('/uploads',files={'file':('bad.png',b'not an image','image/png')}).status_code==415
    assert client.post('/listings',json={**item,'seller_id':'missing'}).status_code==404
    assert client.post('/sellers',json={'name':'Bad Driver','can_drive':True,'location':{'lat':0,'lng':0}}).status_code==422


def test_health_no_results_and_ai_unavailable(api):
    client,_=api
    assert client.get('/health').json()['storage']=='local_demo'
    result=client.post('/bundles/generate',json={**REQUEST,'budget':1})
    assert result.status_code==200 and result.json()['bundles']==[]
    assert result.json()['message']
    assert client.post('/listings/analyze').status_code==422
