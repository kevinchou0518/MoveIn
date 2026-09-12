"""Selectable demo identities. These are public personas, not secure login."""
import hashlib
from fastapi import HTTPException, Request

DEMO_ISSUER = 'https://demo.snackoverflow.local/'
DEMO_USERS = ('maya', 'jordan', 'alex', 'sam', 'riley', 'jamie', 'distant')
LEGACY_USERS = {'demo-buyer': 'maya', 'demo-buyer-2': 'jordan', 'demo-seller': 'riley'}

def account_id(issuer, subject):
    return hashlib.sha256(f'{issuer}\n{subject}'.encode()).hexdigest()

class Authenticator:
    def authenticate(self, authorization):
        subject = authorization[7:] if authorization and authorization.startswith('Bearer ') else 'maya'
        subject = LEGACY_USERS.get(subject, subject)
        if subject not in DEMO_USERS:
            raise HTTPException(401, 'Choose a valid demo user.')
        return {'id': account_id(DEMO_ISSUER, subject), 'subject': subject, 'issuer': DEMO_ISSUER}

def initialize_demo_accounts(data):
    from app.seed import seed_data
    for subject in DEMO_USERS:
        account = Authenticator().authenticate('Bearer ' + subject)
        data.setdefault('accounts', {}).setdefault(account['id'], account)
    # Preserve records created with the previous three demo identities.
    previous = {account_id(DEMO_ISSUER, old): account_id(DEMO_ISSUER, new)
                for old, new in LEGACY_USERS.items()}
    seed_ids = set(DEMO_USERS)
    for collection, field in [('sellers', 'owner_id'), ('uploads', 'owner_id'),
                              ('orders', 'buyer_id'), ('bundles', 'buyer_id')]:
        for record in data.get(collection, {}).values():
            if collection == 'sellers' and record['id'] in seed_ids:
                continue
            if record.get(field) in previous:
                record[field] = previous[record[field]]
            if collection == 'orders' and record.get('bundle', {}).get('buyer_id') in previous:
                record['bundle']['buyer_id'] = previous[record['bundle']['buyer_id']]
    for seed in seed_data()[0]:
        seller = data['sellers'].get(seed.id)
        if seller and (not seller.get('owner_id') or seller['owner_id'] in previous):
            seller['owner_id'] = account_id(DEMO_ISSUER, seed.id)

def current_account(request: Request):
    if not hasattr(request.state, 'account'):
        request.state.account = request.app.state.auth.authenticate(request.headers.get('authorization'))
    return request.state.account
