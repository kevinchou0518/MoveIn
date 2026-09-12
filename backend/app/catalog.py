import hashlib
import unicodedata
from app.schemas import Model
from pydantic import Field

BUILTIN_NAMES = {'tv':'TV','tv_stand':'TV stand','desk':'Desk','chair':'Chair','sofa':'Sofa','table':'Table','lamp':'Lamp','vacuum':'Vacuum','fan':'Fan'}

class CategoryCreate(Model):
    name: str = Field(min_length=1,max_length=60)

def normalized_name(name):
    return ' '.join(unicodedata.normalize('NFKC',name).casefold().split())

def category_record(name):
    name=' '.join(name.split())
    normalized=normalized_name(name)
    if normalized in ('office chair','office_chair'):
        name,normalized='Chair','chair'
    cid=next((k for k,v in BUILTIN_NAMES.items() if normalized in (k,normalized_name(v))),None)
    if cid:
        name=BUILTIN_NAMES[cid]
        normalized=normalized_name(name)
    return {'id':cid or 'cat_'+hashlib.sha256(normalized.encode()).hexdigest()[:20], 'name':name,'normalized_name':normalized}

def builtin_categories():
    return [category_record(name) for name in BUILTIN_NAMES.values()]

def ensure_categories(ids, store):
    from app.db.store import StoreError
    known={c['id'] for c in store.categories()}
    if any(cid not in known for cid in ids):
        raise StoreError(422,'Choose an existing category or create it in seller mode first.')
