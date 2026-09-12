from collections import Counter
from math import asin, cos, radians, sin, sqrt
from app.schemas import BundleRequest, Listing, Location, Seller, utcnow


def miles(a: Location, b: Location) -> float:
    lat1, lat2 = radians(a.lat), radians(b.lat)
    h = sin((lat2-lat1)/2)**2 + cos(lat1)*cos(lat2)*sin(radians(b.lng-a.lng)/2)**2
    return 3958.7613 * 2 * asin(min(1, sqrt(h)))


def filter_candidates(listings: list[Listing], request: BundleRequest, sellers: dict[str, Seller]):
    rejected = Counter()
    candidates = []
    for item in sorted(listings, key=lambda i: i.id):
        if item.category not in request.categories:
            rejected['category'] += 1
        elif not item.available or item.available_date > utcnow().date():
            rejected['unavailable'] += 1
        elif item.price > request.budget:
            rejected['price'] += 1
        elif item.seller_id not in sellers:
            rejected['unknown_seller'] += 1
        elif miles(item.location, request.buyer_location) > request.radius_miles:
            rejected['distance'] += 1
        else:
            candidates.append(item)
    # Bound model size, retaining driver listings as well as low-cost, high-condition ones.
    limited = []
    for category in request.categories:
        group = [i for i in candidates if i.category == category]
        group.sort(key=lambda i: (not sellers[i.seller_id].can_drive, i.price_cents - i.condition_score*500, i.id))
        limited.extend(group[:30])
        rejected['candidate_limit'] += max(0, len(group)-30)
    return sorted(limited, key=lambda i: i.id), dict(rejected)
