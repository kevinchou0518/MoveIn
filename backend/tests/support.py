"""Explicit authenticated fixture factory for pre-existing feature tests."""
from app.main import create_app as real_create_app

class TestAuth:
    def authenticate(self, authorization):
        return {'id': 'test-account', 'subject': 'test-user', 'issuer': 'https://test.invalid/'}

def create_app(*args, **kwargs):
    store = args[0] if args else kwargs.get('store')
    if store and hasattr(store, 'data'):
        for seller in store.data['sellers'].values():
            seller['owner_id'] = 'test-account'
    kwargs['authenticator'] = TestAuth()
    return real_create_app(*args, **kwargs)
