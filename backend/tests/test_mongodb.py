"""Opt-in Atlas integration; all writes target a fresh disposable database."""
import os
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
import pytest
from app.db.store import MongoStore, StoreError
from app.schemas import BundleRequest
from app.services.bundle_service import generate_bundles
from app.services.route_optimizer import MapProvider

@pytest.mark.skipif(not os.getenv('MONGODB_TEST_URI'),reason='Requires explicit Atlas test URI')
def test_atlas_persistence_and_atomic_checkout():
    dbname='so_test_'+uuid4().hex[:24]
    store=MongoStore(os.environ['MONGODB_TEST_URI'],dbname)
    try:
        req=BundleRequest(categories=['tv','tv_stand','desk','chair'],budget=300,buyer_has_car=False,buyer_location={'lat':40.443,'lng':-79.943})
        bundles=generate_bundles(store.listings(),store.sellers(),req,MapProvider())['bundles']
        store.save_bundles(bundles)
        clone=MongoStore(os.environ['MONGODB_TEST_URI'],dbname)
        try: assert clone.db.bundles.count_documents({})==3
        finally: clone.close()
        first=bundles[0]
        second=next(b for b in bundles[1:] if {i['id'] for i in b['listings']} & {i['id'] for i in first['listings']})
        def checkout(b):
            try:return store.checkout(b['id'])
            except StoreError as e:return e.status
        with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(checkout,[first,second]))
        orders=[r for r in results if isinstance(r,dict)]
        assert len(orders)==1 and 409 in results
        order=orders[0]
        assert store.checkout(order['bundle_id'])['id']==order['id']
        assert len(store.deliveries(order['bundle']['driver']['id']))==1
        current={i.id:i for i in store.listings()}
        assert all(not current[i['id']].available for i in order['bundle']['listings'])
    finally:
        store.client.drop_database(dbname)
        store.close()
