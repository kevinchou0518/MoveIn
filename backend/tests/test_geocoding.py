import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.services.geocoding import Geocoder
from support import create_app
from app.db.store import LocalStore
from app.services.route_optimizer import MapProvider


def test_address_results_and_storage_mode(tmp_path):
    def respond(request):
        assert request.url.params['permanent']=='true'
        assert request.url.params['autocomplete']=='false'
        assert request.url.params['q']=='5000 Forbes Avenue'
        return httpx.Response(200,json={'features':[{'properties':{'full_address':'5000 Forbes Avenue, Pittsburgh, PA'},'geometry':{'coordinates':[-79.942,40.444]}}]})
    geocoder=Geocoder('secret',httpx.MockTransport(respond))
    with TestClient(create_app(LocalStore(tmp_path/'data.json'),MapProvider(),tmp_path/'uploads',geocoder=geocoder)) as client:
        r=client.get('/locations/search',params={'q':'5000 Forbes Avenue'})
        assert r.status_code==200
        assert r.json()==[{'lat':40.444,'lng':-79.942,'label':'5000 Forbes Avenue, Pittsburgh, PA'}]
        for q in ('ab','   ','a'*201):
            assert client.get('/locations/search',params={'q':q}).status_code==422


def test_empty_results():
    g=Geocoder('secret',httpx.MockTransport(lambda r:httpx.Response(200,json={'features':[]})))
    assert g.search('unknown')==[]


@pytest.mark.parametrize('code,payload',[(403,{}),(429,{}),(500,{}),(200,{'features':[{'geometry':{'coordinates':[999,99]},'properties':{'name':'Invalid'}}]})])
def test_provider_failures(code,payload):
    g=Geocoder('secret',httpx.MockTransport(lambda r:httpx.Response(code,json=payload)))
    with pytest.raises(HTTPException) as e:g.search('address')
    assert e.value.status_code==503 and 'secret' not in e.value.detail
