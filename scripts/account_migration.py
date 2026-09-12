"""Pure, repeatable transformation for explicit demo demo account mappings."""
from copy import deepcopy
from app.auth import account_id
from app.schemas import utcnow

LEGACY_ORDERS = {
    '2b9ce9a6-19b8-4095-8851-bb1b0f8e067a',
    'd44c8c3c-7bd6-4c4c-a2ba-05904ab1eb0f',
    'e1eeb1d9-848d-438e-a601-33529ca804b2',
    '9abe6c0f-617e-4f37-8c17-6a6d0482b2c3',
}


def assign_accounts(current, mapping):
    data = deepcopy(current)
    issuer = mapping['issuer']
    if not issuer.startswith('https://') or not issuer.endswith('/'):
        raise ValueError('Use the exact HTTPS demo issuer with a trailing slash.')
    now = utcnow().isoformat()
    def account(subject):
        if not isinstance(subject, str) or not subject.strip():
            raise ValueError('Every account requires an explicit demo user ID (sub).')
        uid = account_id(issuer, subject)
        data.setdefault('accounts', {}).setdefault(uid, {'id': uid, 'subject': subject, 'issuer': issuer, 'created_at': now})
        return uid
    for sid, subject in mapping['sellers'].items():
        owner = account(subject)
        seller = data['sellers'].get(sid)
        if not seller:
            raise ValueError(f'Unknown seller: {sid}')
        if seller.get('owner_id') not in (None, owner):
            raise ValueError(f'Seller {sid} is already owned by another account.')
        seller['owner_id'] = owner
    buyer = account(mapping['buyer_sub'])
    for oid in LEGACY_ORDERS & data.get('orders', {}).keys():
        order = data['orders'][oid]
        if order.get('buyer_id') not in (None, buyer):
            raise ValueError(f'Order {oid} belongs to another buyer.')
        if order.get('account_migration') == 1:
            continue
        if order['status'] not in ('reserved', 'cancelled'):
            raise ValueError(f'Order {oid} has progressed and needs manual review.')
        for old in order['bundle']['listings']:
            item = data['listings'].get(old['id'])
            if not item or item.get('reserved_order_id') not in (None, oid) or (not item['available'] and item.get('reserved_order_id') != oid):
                raise ValueError(f'Inventory conflict for {old["id"]}; no migration applied.')
            conflicts = [o for o in data['orders'].values() if o['id'] not in LEGACY_ORDERS and o['status'] in ('reserved', 'in_progress') and any(i['id'] == old['id'] for i in o['bundle']['listings'])]
            if conflicts:
                raise ValueError(f'Another active order uses {old["id"]}.')
            item.update(available=True, status='available', reserved_order_id=None)
        reason = 'Historical demo reservation cancelled: inventory was manually restored before account migration.'
        order.update(buyer_id=buyer, status='cancelled', cancelled_at=now, updated_at=now,
                     cancellation_reason=reason, account_migration=1,
                     seller_ids=sorted({i['seller_id'] for i in order['bundle']['listings']}),
                     driver_id=(order['bundle'].get('driver') or {}).get('id'))
        if not order.get('history'):
            order['history'] = [{'status': 'reserved', 'at': order['created_at']}]
        order['history'].append({'status': 'cancelled', 'at': now, 'reason': reason, 'actor_id': 'account-migration'})
        bundle = data.get('bundles', {}).get(order['bundle_id'])
        if bundle:
            bundle['buyer_id'] = buyer
    return data
