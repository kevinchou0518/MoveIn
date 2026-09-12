import json
import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.services.ai_service import AnalysisRequest, GrokService
from app.services.bundle_service import delivery_fee
from support import create_app
from app.db.store import LocalStore
from app.services.route_optimizer import MapProvider
from PIL import Image
from io import BytesIO

RESULT = dict(title='Wood chair', description='A wooden chair.', category='office_chair', condition='good', condition_score=8.2, visible_issues=['Scratch on seat'], estimated_product=None, suggested_price_min=30, suggested_price_max=50, confidence=.8)


def service(result=RESULT, status=200):
    def respond(request):
        body=json.loads(request.content)
        assert body['store'] is False
        assert body['input'][1]['content'][0]['image_url'].startswith('data:image/jpeg;base64,')
        assert body['text']['format']['strict']
        return httpx.Response(status, json={'output':[{'type':'message','content':[{'type':'output_text','text':json.dumps(result)}]}]})
    return GrokService('test-secret', transport=httpx.MockTransport(respond))


@pytest.fixture
def photo(tmp_path):
    Image.new('RGB',(20,20)).save(tmp_path/'photo.jpg')
    return tmp_path


def test_suggestions_do_not_publish_and_manual_publish_survives_failure(tmp_path):
    store=LocalStore(tmp_path/'db.json')
    with TestClient(create_app(store, MapProvider(), tmp_path/'uploads', service())) as client:
        data=BytesIO(); Image.new('RGB',(20,20)).save(data,format='PNG')
        image=client.post('/uploads',files={'file':('photo.png',data.getvalue(),'image/png')}).json()['image_url']
        before=client.get('/listings').json()
        response=client.post('/listings/analyze',json={'image_url':image})
        assert response.status_code==200 and response.json()['category']=='chair'
        assert client.get('/listings').json()==before
        client.app.state.ai=GrokService()
        assert client.post('/listings/analyze',json={'image_url':image}).status_code==503
        listing={'seller_id':'jordan','title':'My edited title','category':'chair','price':42,'image_url':image}
        assert client.post('/listings',json=listing).status_code==201


@pytest.mark.parametrize('patch', [{'category':'spaceship'},{'condition_score':11},{'confidence':float('nan')},{'suggested_price_min':60},{'suggested_price_max':None},{'title':'x'*121}])
def test_bad_output(photo,patch):
    with pytest.raises(HTTPException) as error:
        service({**RESULT,**patch}).analyze(AnalysisRequest(image_url='/uploads/photo.jpg'),photo)
    assert error.value.status_code==502


@pytest.mark.parametrize('url,status',[('/uploads/missing.jpg',404),('/uploads/../photo.jpg',422),('https://example.com/photo.jpg',422),('/uploads/..%2Fphoto.jpg',404)])
def test_upload_boundaries(photo,url,status):
    with pytest.raises(HTTPException) as error:
        service().analyze(AnalysisRequest(image_url=url),photo)
    assert error.value.status_code==status


@pytest.mark.parametrize('status,expected',[(401,503),(403,503),(429,503),(400,503),(404,503),(500,502)])
def test_provider_errors(photo,status,expected):
    with pytest.raises(HTTPException) as error:
        service(status=status).analyze(AnalysisRequest(image_url='/uploads/photo.jpg'),photo)
    assert error.value.status_code==expected and 'test-secret' not in error.value.detail


def test_timeout_and_invalid_json(photo):
    def timeout(request): raise httpx.ReadTimeout('secret')
    for transport,expected in [(httpx.MockTransport(timeout),504),(httpx.MockTransport(lambda r:httpx.Response(200,text='broken')),502)]:
        with pytest.raises(HTTPException) as error:
            GrokService('secret',transport=transport).analyze(AnalysisRequest(image_url='/uploads/photo.jpg'),photo)
        assert error.value.status_code==expected


def test_reward_formula():
    assert delivery_fee(9,3)==18
    assert delivery_fee(1.005,1)==6.01
