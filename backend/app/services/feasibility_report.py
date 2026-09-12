"""Bounded audit of the small demo search space, never used to select bundles."""
from itertools import product
from math import prod
from app.schemas import BundleRequest, Listing, Seller
from app.services.driver_selector import eligible_drivers


def feasibility_report(items: list[Listing], sellers: dict[str, Seller], request: BundleRequest):
    groups = [[i for i in items if i.category == category] for category in request.categories]
    count = prod(len(group) for group in groups)
    # Avoid exhaustive enumeration for larger real inventories.
    if count > 10_000:
        return None
    rejected = {'budget': 0, 'no_driver': 0, 'capacity': 0}
    feasible = 0
    for combination in product(*groups):
        if sum(i.price_cents for i in combination) > int(request.budget*100):
            rejected['budget'] += 1
        elif not request.buyer_has_car and not any(sellers[i.seller_id].can_drive for i in combination):
            rejected['no_driver'] += 1
        elif not request.buyer_has_car and not eligible_drivers(list(combination), sellers):
            rejected['capacity'] += 1
        else:
            feasible += 1
    return {'examined': count, 'feasible_before_routing': feasible, 'rejected': rejected}
