"""Selectable demo identities. These are public personas, not secure login."""
import hashlib
from fastapi import HTTPException, Request

DEMO_ISSUER = 'https://demo.snackoverflow.local/'
DEMO_USERS = ('demo-buyer', 'demo-buyer-2', 'demo-seller')

def account_id(issuer, subject):
    return hashlib.sha256(f'{issuer}\n{subject}'.encode()).hexdigest()

class Authenticator:
    def authenticate(self, authorization):
        subject = authorization[7:] if authorization and authorization.startswith('Bearer ') else 'demo-buyer'
        if subject not in DEMO_USERS:
            raise HTTPException(401, 'Choose a valid demo user.')
        return {'id': account_id(DEMO_ISSUER, subject), 'subject': subject, 'issuer': DEMO_ISSUER}

def initialize_demo_accounts(data):
    from app.seed import seed_data
    for subject in DEMO_USERS:
        account = Authenticator().authenticate('Bearer ' + subject)
        data.setdefault('accounts', {}).setdefault(account['id'], account)
    owner = account_id(DEMO_ISSUER, 'demo-seller')
    for seed in seed_data()[0]:
        seller = data['sellers'].get(seed.id)
        if seller and not seller.get('owner_id'):
            seller['owner_id'] = owner

def current_account(request: Request):
    if not hasattr(request.state, 'account'):
        request.state.account = request.app.state.auth.authenticate(request.headers.get('authorization'))
    return request.state.account
