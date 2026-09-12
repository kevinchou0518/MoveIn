"""Account-owned marketplace operations shared by local and Atlas stores."""
from copy import deepcopy
from uuid import uuid4
from app.db.store import StoreError, validate_checkout
from app.schemas import Listing, Seller, utcnow

ACTIVE = ('reserved', 'in_progress')


def owned_seller(data, sid, actor):
    seller = data.get('sellers', {}).get(sid)
    if not seller:
        raise StoreError(404, 'Seller not found.')
    if seller.get('owner_id') != actor:
        raise StoreError(403, 'You do not own this seller profile.')
    return seller


def owned_bundle(data, bid, actor):
    bundle = data.get('bundles', {}).get(bid)
    if not bundle or bundle.get('buyer_id') != actor:
        raise StoreError(404, 'Bundle not found. Start a fresh search.')
    return bundle


def roles(data, order, actor):
    owned = {sid for sid, s in data.get('sellers', {}).items() if s.get('owner_id') == actor}
    participants = set(order.get('seller_ids', [i['seller_id'] for i in order['bundle']['listings']]))
    driver = (order['bundle'].get('driver') or {}).get('id')
    return order.get('buyer_id') == actor, bool(owned & participants), driver in owned, owned & participants


def actions(data, order, actor):
    buyer, seller, driver, _ = roles(data, order, actor)
    if not (buyer or seller):
        raise StoreError(404, 'Order not found.')
    allowed = []
    if order['status'] == 'reserved':
        allowed.append('cancel')
        if driver or (buyer and not order['bundle'].get('driver')):
            allowed.append('start')
    if buyer and order['status'] == 'in_progress':
        allowed.append('complete')
    return allowed


def order_view(data, order, actor, seller_id=None):
    allowed = actions(data, order, actor)
    buyer, _, driver, owned = roles(data, order, actor)
    if seller_id:
        owned_seller(data, seller_id, actor)
        if seller_id not in owned:
            raise StoreError(404, 'Order not found.')
        buyer = False
        driver = (order['bundle'].get('driver') or {}).get('id') == seller_id
        owned = {seller_id}
        allowed = [a for a in allowed if a == 'cancel' or (a == 'start' and driver)]
    result = deepcopy(order)
    result.pop('buyer_id', None)
    result['allowed_actions'] = allowed
    result['viewer_role'] = 'buyer' if buyer else 'driver' if driver else 'seller'
    for event in result.get('history', []):
        event.pop('actor_id', None)
    bundle = result['bundle']
    bundle.pop('buyer_id', None)
    if not buyer and not driver:
        # Do not send other sellers' inventory, a buyer address, or route geometry.
        result['bundle'] = {
            'listings': [i for i in bundle['listings'] if i['seller_id'] in owned],
            'sellers': [s for s in bundle['sellers'] if s['id'] in owned],
            'driver_name': (bundle.get('driver') or {}).get('name'),
            'transportation_mode': bundle['transportation_mode'],
        }
    return result


def list_orders(data, actor, status=None, limit=20, offset=0, seller_id=None, deliveries=False):
    if seller_id:
        owned_seller(data, seller_id, actor)
    found = []
    for order in data.get('orders', {}).values():
        if status and order['status'] != status:
            continue
        if seller_id:
            if seller_id not in {i['seller_id'] for i in order['bundle']['listings']}:
                continue
            if deliveries and (order['bundle'].get('driver') or {}).get('id') != seller_id:
                continue
        elif order.get('buyer_id') != actor:
            continue
        found.append(order)
    found.sort(key=lambda o: (o['created_at'], o['id']), reverse=True)
    return {'items': [order_view(data, o, actor, seller_id) for o in found[offset:offset + limit]],
            'total': len(found), 'limit': limit, 'offset': offset}


def checkout(data, bid, actor):
    bundle = owned_bundle(data, bid, actor)
    existing = next((o for o in data.get('orders', {}).values() if o['bundle_id'] == bid), None)
    if existing:
        if existing.get('buyer_id') != actor:
            raise StoreError(404, 'Order not found.')
        return order_view(data, existing, actor)
    validate_checkout(bundle, data['listings'])
    for old in bundle['listings']:
        item = data['listings'][old['id']]
        if item.get('reserved_order_id') or item.get('status') in ('withdrawn', 'reserved', 'sold'):
            raise StoreError(409, 'Inventory changed. Build a fresh bundle.')
        for field in ('title', 'description', 'category', 'condition', 'condition_score', 'item_size', 'image_url', 'location', 'available_date', 'revision'):
            if item.get(field, 0 if field == 'revision' else None) != old.get(field, 0 if field == 'revision' else None):
                raise StoreError(409, 'Listing details changed. Build a fresh bundle.')
    for old in bundle['sellers']:
        current = data['sellers'].get(old['id'])
        if not current or any(current.get(k, 0 if k == 'revision' else None) != old.get(k, 0 if k == 'revision' else None) for k in ('location', 'can_drive', 'vehicle_type', 'revision')):
            raise StoreError(409, 'Seller logistics changed. Build a fresh bundle.')
    oid, now = str(uuid4()), utcnow().isoformat()
    order = {'id': oid, 'bundle_id': bid, 'buyer_id': actor, 'bundle': deepcopy(bundle),
             'seller_ids': sorted({i['seller_id'] for i in bundle['listings']}),
             'driver_id': (bundle.get('driver') or {}).get('id'), 'status': 'reserved',
             'created_at': now, 'updated_at': now, 'history': [{'status': 'reserved', 'at': now, 'actor_id': actor}]}
    for old in bundle['listings']:
        data['listings'][old['id']].update(available=False, status='reserved', reserved_order_id=oid)
    data.setdefault('orders', {})[oid] = order
    return order_view(data, order, actor)


def transition(data, oid, actor, action, reason=None, seller_id=None):
    order = data.get('orders', {}).get(oid)
    if not order:
        raise StoreError(404, 'Order not found.')
    if seller_id:
        order_view(data, order, actor, seller_id)
        if action == 'complete' or (action == 'start' and (order['bundle'].get('driver') or {}).get('id') != seller_id):
            raise StoreError(403, 'This action is not available in this seller profile.')
    buyer, seller, driver, _ = roles(data, order, actor)
    authorized = (action == 'cancel' and (buyer or seller) or action == 'complete' and buyer or
                  action == 'start' and (driver or (buyer and not order['bundle'].get('driver'))))
    if not authorized:
        raise StoreError(403, 'You cannot perform this order action.')
    target = {'cancel': 'cancelled', 'start': 'in_progress', 'complete': 'completed'}[action]
    if order['status'] == target:
        return order_view(data, order, actor, seller_id)
    if action not in actions(data, order, actor):
        raise StoreError(409, 'The order status changed. Refresh before continuing.')
    if action == 'cancel' and not (reason and reason.strip()):
        raise StoreError(422, 'Enter a cancellation reason.')
    if action in ('start', 'complete'):
        if any(data['listings'].get(i['id'], {}).get('reserved_order_id') != oid for i in order['bundle']['listings']):
            raise StoreError(409, 'Reservation inventory is inconsistent. Contact the demo operator.')
    if action in ('cancel', 'complete'):
        for old in order['bundle']['listings']:
            item = data['listings'].get(old['id'])
            if item and item.get('reserved_order_id') == oid:
                item.update(available=action == 'cancel', status='available' if action == 'cancel' else 'sold', reserved_order_id=None)
    now = utcnow().isoformat()
    order.update(status=target, updated_at=now, **{target + '_at': now})
    event = {'status': target, 'at': now, 'actor_id': actor}
    if action == 'cancel':
        order['cancellation_reason'] = reason.strip()
        event['reason'] = reason.strip()
    order.setdefault('history', []).append(event)
    return order_view(data, order, actor, seller_id)


def check_image(data, url, actor, seller_id=None):
    if not url or url.startswith('/images/'):
        return
    if url.startswith('/uploads/demo/') and seller_id:
        owned_seller(data, seller_id, actor)
        return
    if url.startswith('/uploads/demo/') and any(i.get('image_url') == url and data['sellers'].get(i['seller_id'], {}).get('owner_id') == actor for i in data.get('listings', {}).values()):
        return
    record = data.get('uploads', {}).get(url)
    if not record or record['owner_id'] != actor:
        raise StoreError(403, 'Choose a photo uploaded by your account.')


def edit_listing(data, lid, actor, patch=None, action=None):
    item = data['listings'].get(lid)
    if not item:
        raise StoreError(404, 'Listing not found.')
    owned_seller(data, item['seller_id'], actor)
    state = item.get('status') or ('available' if item['available'] else 'sold')
    if state in ('reserved', 'sold') or item.get('reserved_order_id'):
        raise StoreError(409, 'Reserved or sold furniture cannot be edited or republished.')
    if patch:
        # Validate the merged record before helpers inspect individual values.
        candidate = Listing(**{**item, **patch})
        check_image(data, candidate.image_url, actor, item['seller_id'])
        item.update(candidate.model_dump(mode='json'))
    if action:
        item.update(status='withdrawn' if action == 'withdraw' else 'available', available=action == 'publish')
    item['revision'] = item.get('revision', 0) + 1
    validated = Listing(**item)
    data['listings'][lid] = validated.model_dump(mode='json')
    return validated.public()


def edit_seller(data, sid, actor, patch):
    seller = owned_seller(data, sid, actor)
    logistics = any(patch.get(k, seller.get(k)) != seller.get(k) for k in ('location', 'can_drive', 'vehicle_type'))
    if logistics and any(o['status'] in ACTIVE and sid in {i['seller_id'] for i in o['bundle']['listings']} for o in data.get('orders', {}).values()):
        raise StoreError(409, 'Finish or cancel active orders before changing pickup or vehicle details.')
    seller.update(patch)
    seller['revision'] = seller.get('revision', 0) + 1
    validated = Seller(**seller)
    data['sellers'][sid] = validated.model_dump(mode='json')
    if logistics:
        for item in data['listings'].values():
            if item['seller_id'] == sid:
                item['location'] = deepcopy(seller['location'])
                item['revision'] = item.get('revision', 0) + 1
    return validated.public()
