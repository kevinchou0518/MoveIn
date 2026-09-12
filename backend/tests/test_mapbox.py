import httpx
from app.schemas import Location
from app.services.route_optimizer import MapProvider


def test_mapbox_matrix_and_geometry_contract(monkeypatch):
    calls=[]
    def get(url,params,timeout):
        calls.append((url,params,timeout))
        payload = {'code':'Ok','distances':[[0,1000],[1100,0]],'durations':[[0,120],[150,0]]} if 'matrix' in url else {'routes':[{'geometry':{'coordinates':[[-79.943,40.443],[-79.922,40.432]]}}]}
        return httpx.Response(200,json=payload,request=httpx.Request('GET',url))
    monkeypatch.setattr(httpx,'get',get)
    points=[Location(lat=40.443,lng=-79.943),Location(lat=40.432,lng=-79.922)]
    provider=MapProvider('test-token')
    matrix=provider.matrix(points)
    assert matrix.source=='mapbox' and matrix.distances[1][0]==1100 and matrix.durations[0][1]==120
    assert provider.geometry(points)==[[-79.943,40.443],[-79.922,40.432]]
    assert calls[0][0].endswith('-79.943,40.443;-79.922,40.432')
    assert calls[0][1]['annotations']=='distance,duration'
    assert calls[1][1]['geometries']=='geojson'


def test_mapbox_failure_is_labeled_fallback(monkeypatch):
    monkeypatch.setattr(httpx,'get',lambda *a,**k: httpx.Response(401,request=httpx.Request('GET','https://example.test')))
    points=[Location(lat=40.443,lng=-79.943),Location(lat=40.432,lng=-79.922)]
    matrix=MapProvider('test-token').matrix(points)
    assert matrix.source=='estimated'
    assert 'unavailable' in matrix.warning
    assert matrix.distances[0][1]>0
    assert MapProvider('test-token').geometry(points) is None


def test_mapbox_unreachable_is_preserved(monkeypatch):
    monkeypatch.setattr(httpx,'get',lambda *a,**k: httpx.Response(200,json={'code':'Ok','distances':[[0,None],[None,0]],'durations':[[0,None],[None,0]]},request=httpx.Request('GET','https://example.test')))
    points=[Location(lat=40.443,lng=-79.943),Location(lat=40.432,lng=-79.922)]
    matrix=MapProvider('test-token').matrix(points)
    assert matrix.source=='mapbox'
    assert matrix.durations[0][1] is None
