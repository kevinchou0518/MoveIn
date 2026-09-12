"""Small demo repository: atomic local snapshots or MongoDB Atlas transactions.

Local mode deliberately supports one backend process. Atlas supports multiple workers.
"""
from copy import deepcopy
from datetime import datetime, timedelta
import json
from pathlib import Path
from threading import RLock
from uuid import uuid4
from app.schemas import Listing, Seller, utcnow
from app.seed import seed_data
from app.catalog import builtin_categories, category_record


class StoreError(Exception):
    def __init__(self, status: int, message: str):
        self.status, self.message = status, message
        super().__init__(message)


def validate_checkout(bundle, listings):
    if datetime.fromisoformat(bundle['created_at']) + timedelta(minutes=30) < utcnow():
        raise StoreError(410, 'This bundle has expired. Build a fresh bundle to check current availability.')
    for selected in bundle['listings']:
        current = listings.get(selected['id'])
        if not current or not current['available'] or current['available_date'] > utcnow().date().isoformat():
            raise StoreError(409, 'An item in this bundle is no longer available. Build a fresh bundle.')
        if str(current['price']) != str(selected['price']) and float(current['price']) != float(selected['price']):
            raise StoreError(409, 'An item price has changed. Build a fresh bundle.')


def make_order(bundle):
    return {'id': str(uuid4()), 'bundle_id': bundle['id'], 'bundle': deepcopy(bundle),
            'status': 'reserved', 'created_at': utcnow().isoformat()}


class LocalStore:
    kind = 'local_demo'

    def __init__(self, path: Path):
        self.path = path
        self.lock = RLock()
        if path.exists():
            self.data = json.loads(path.read_text())
        else:
            sellers, listings = seed_data()
            self.data = {'sellers': {s.id:s.model_dump(mode='json') for s in sellers},
                         'listings': {i.id:i.model_dump(mode='json') for i in listings}, 'bundles': {}, 'orders': {}}
            self._save()

        if 'categories' not in self.data:
            self.data['categories'] = {c['id']:c for c in builtin_categories()}
            for item in self.data['listings'].values():
                cid=item['category']
                self.data['categories'].setdefault(cid, {'id':cid,'name':cid.replace('_',' ').title(),'normalized_name':cid.replace('_',' ')})
            self._save()

    def categories(self):
        with self.lock:
            return sorted(deepcopy(list(self.data['categories'].values())),key=lambda c:c['name'])

    def add_category(self, name):
        record=category_record(name)
        with self.lock:
            existing=next((c for c in self.data['categories'].values() if c['normalized_name']==record['normalized_name']),None)
            if existing: return deepcopy(existing)
            self.data['categories'][record['id']]=record
            self._save()
            return deepcopy(record)

    def get_bundle(self, bid):
        with self.lock:
            bundle=self.data['bundles'].get(bid)
            if not bundle: raise StoreError(404,'Bundle not found. Start a fresh search.')
            return deepcopy(bundle)

    def get_order(self, oid):
        with self.lock:
            order=self.data['orders'].get(oid)
            if not order: raise StoreError(404,'Reservation not found.')
            return deepcopy(order)

    def order_for_bundle(self,bid):
        with self.lock:
            return deepcopy(next((o for o in self.data['orders'].values() if o['bundle_id']==bid),None))

    def _save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix('.tmp')
        tmp.write_text(json.dumps(self.data, indent=2))
        tmp.replace(self.path)

    def sellers(self):
        with self.lock:
            return {sid:Seller(**s) for sid,s in self.data['sellers'].items()}

    def listings(self):
        with self.lock:
            return [Listing(**i) for i in self.data['listings'].values()]

    def add_seller(self, seller: Seller):
        with self.lock:
            self.data['sellers'][seller.id] = seller.model_dump(mode='json')
            self._save()

    def add_listing(self, listing: Listing):
        with self.lock:
            self.data['listings'][listing.id] = listing.model_dump(mode='json')
            self._save()

    def save_bundles(self, bundles):
        with self.lock:
            cutoff = utcnow()-timedelta(hours=24)
            self.data['bundles'] = {bid:b for bid,b in self.data['bundles'].items() if datetime.fromisoformat(b['created_at'])>cutoff}
            for bundle in bundles:
                self.data['bundles'][bundle['id']] = deepcopy(bundle)
            self._save()

    def checkout(self, bundle_id):
        with self.lock:
            for order in self.data['orders'].values():
                if order['bundle_id'] == bundle_id:
                    return deepcopy(order)
            bundle = self.data['bundles'].get(bundle_id)
            if not bundle:
                raise StoreError(404, 'Bundle not found. Build a fresh bundle.')
            validate_checkout(bundle, self.data['listings'])
            # Roll back memory if the atomic file write fails.
            previous = deepcopy(self.data)
            order = make_order(bundle)
            for item in bundle['listings']:
                self.data['listings'][item['id']]['available'] = False
            self.data['orders'][order['id']] = order
            try:
                self._save()
            except OSError:
                self.data = previous
                raise
            return deepcopy(order)

    def deliveries(self, seller_id):
        with self.lock:
            return [deepcopy(o) for o in self.data['orders'].values() if (o['bundle']['driver'] or {}).get('id') == seller_id]

    def close(self):
        pass


class MongoStore:
    kind = 'mongodb'

    def __init__(self, uri: str, database: str):
        from pymongo import MongoClient
        self.client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        self.client.admin.command('ping')
        self.db = self.client[database]
        for name in ('sellers', 'listings', 'bundles', 'orders', 'categories'):
            self.db[name].create_index('id', unique=True)
        self.db.orders.create_index('bundle_id', unique=True)
        self.db.categories.create_index('normalized_name', unique=True)
        for record in builtin_categories():
            self.db.categories.update_one({'id':record['id']},{'$setOnInsert':record},upsert=True)
        sellers, listings = seed_data()
        # setOnInsert preserves published inventory and checkout state on restarts.
        for seller in sellers:
            self.db.sellers.update_one({'id':seller.id}, {'$setOnInsert':seller.model_dump(mode='json')}, upsert=True)
        for listing in listings:
            self.db.listings.update_one({'id':listing.id}, {'$setOnInsert':listing.model_dump(mode='json')}, upsert=True)

    def categories(self):
        return list(self.db.categories.find({}, {'_id':0}).sort('name',1))

    def add_category(self,name):
        from pymongo.errors import DuplicateKeyError
        record=category_record(name)
        try: self.db.categories.update_one({'normalized_name':record['normalized_name']},{'$setOnInsert':record},upsert=True)
        except DuplicateKeyError: pass
        return self.db.categories.find_one({'normalized_name':record['normalized_name']},{'_id':0})

    def get_bundle(self,bid):
        bundle=self.db.bundles.find_one({'id':bid},{'_id':0})
        if not bundle: raise StoreError(404,'Bundle not found. Start a fresh search.')
        return bundle

    def get_order(self,oid):
        order=self.db.orders.find_one({'id':oid},{'_id':0})
        if not order: raise StoreError(404,'Reservation not found.')
        return order

    def order_for_bundle(self,bid):
        return self.db.orders.find_one({'bundle_id':bid},{'_id':0})

    def sellers(self):
        return {s['id']:Seller(**s) for s in self.db.sellers.find({}, {'_id':0})}

    def listings(self):
        return [Listing(**i) for i in self.db.listings.find({}, {'_id':0})]

    def add_seller(self, seller):
        self.db.sellers.insert_one(seller.model_dump(mode='json'))

    def add_listing(self, listing):
        self.db.listings.insert_one(listing.model_dump(mode='json'))

    def save_bundles(self, bundles):
        for bundle in bundles:
            self.db.bundles.replace_one({'id':bundle['id']}, deepcopy(bundle), upsert=True)

    def checkout(self, bundle_id):
        def transaction(session):
            existing = self.db.orders.find_one({'bundle_id':bundle_id}, {'_id':0}, session=session)
            if existing:
                return existing
            bundle = self.db.bundles.find_one({'id':bundle_id}, {'_id':0}, session=session)
            if not bundle:
                raise StoreError(404, 'Bundle not found. Build a fresh bundle.')
            ids = [i['id'] for i in bundle['listings']]
            current = {i['id']:i for i in self.db.listings.find({'id':{'$in':ids}}, {'_id':0}, session=session)}
            validate_checkout(bundle, current)
            result = self.db.listings.update_many({'id':{'$in':ids}, 'available':True}, {'$set':{'available':False}}, session=session)
            if result.modified_count != len(ids):
                raise StoreError(409, 'One of these items was just reserved. Build a fresh bundle.')
            order = make_order(bundle)
            self.db.orders.insert_one(deepcopy(order), session=session)
            return order
        with self.client.start_session() as session:
            return session.with_transaction(transaction)

    def deliveries(self, seller_id):
        return list(self.db.orders.find({'bundle.driver.id':seller_id}, {'_id':0}))

    def close(self):
        self.client.close()
