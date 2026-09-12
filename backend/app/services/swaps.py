from app.db.store import StoreError, validate_checkout
from app.schemas import BundleRequest
from app.services.candidate_filter import filter_candidates
from app.services.bundle_optimizer import item_weight
from app.services.bundle_service import generate_bundles


def alternatives(store,bid,listing_id,provider):
    source=store.get_bundle(bid)
    if store.order_for_bundle(bid): raise StoreError(409,'Reserved bundles cannot be changed. Find another bundle instead.')
    if not source.get('request'): raise StoreError(409,'This older bundle needs a fresh search before swapping.')
    inventory=store.listings(); by_id={i.id:i for i in inventory}; sellers=store.sellers()
    validate_checkout(source,{i.id:i.public() for i in inventory})
    original=next((i for i in source['listings'] if i['id']==listing_id),None)
    if not original: raise StoreError(422,'Choose an item from this bundle.')
    request=BundleRequest(**source['request'])
    retained=[by_id[i['id']] for i in source['listings'] if i['id']!=listing_id]
    for i in retained:
        eligible,_=filter_candidates([i],request,sellers)
        if not eligible: raise StoreError(409,'A retained item no longer matches this search. Build fresh options.')
    candidates,_=filter_candidates(inventory,request,sellers)
    replacements=[i for i in candidates if i.category==original['category'] and i.id!=listing_id and sum(x.price_cents for x in retained)+i.price_cents<=int(request.budget*100)]
    replacements.sort(key=lambda i:(-item_weight(i,request),i.id))
    result=generate_bundles(inventory,sellers,request,provider,fixed_sets=[retained+[i] for i in replacements[:10]])
    for bundle in result['bundles']:
        bundle['parent_bundle_id']=bid
        bundle['replaced_listing_id']=listing_id
        bundle['total_difference']=round(bundle['total']-source['total'],2)
    store.save_bundles(result['bundles'])
    result['message']='Choose a replacement. Other items stay fixed; route and driver may change.' if result['bundles'] else 'No feasible replacement keeps the other items within your budget and transport requirements.'
    return result
