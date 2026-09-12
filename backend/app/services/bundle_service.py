from collections import Counter
from decimal import Decimal, ROUND_HALF_UP
from math import prod
from uuid import uuid4
from app.schemas import BundleRequest, Listing, Seller, Location, utcnow
from app.services.candidate_filter import filter_candidates
from app.services.bundle_optimizer import optimize_bundles, selection_score
from app.services.driver_selector import eligible_drivers
from app.services.feasibility_report import feasibility_report
from app.services.route_optimizer import MapProvider, RouteUnavailable, calculate_route


def delivery_fee(distance: float, seller_count: int) -> float:
    return float((Decimal('5') + Decimal(str(distance)) + Decimal(2*max(0,seller_count-1))).quantize(Decimal('.01'), rounding=ROUND_HALF_UP))


def generate_bundles(listings: list[Listing], sellers: dict[str, Seller], request: BundleRequest,
                     provider: MapProvider, candidate_limit: int = 10, result_limit: int = 3, fixed_sets=None):
    candidates, rejected = filter_candidates(listings, request, sellers)
    counts = Counter(i.category for i in candidates)
    sets, status = (fixed_sets, 'fixed_items') if fixed_sets is not None else optimize_bundles(candidates, sellers, request, limit=candidate_limit)
    results, cache, route_rejections = [], {}, 0
    for items in sets:
        drivers = [None] if request.buyer_has_car else eligible_drivers(items, sellers)
        options = []
        for driver in drivers:
            try:
                route = calculate_route(items, sellers, request, driver, provider, cache)
            except RouteUnavailable:
                route_rejections += 1
                continue
            fee = delivery_fee(route['distance_miles'], len({i.seller_id for i in items})) if driver else 0
            balanced_cost=round(route['duration_minutes']*.35 + fee*.25, 3)
            primary=fee if request.ranking=='lowest_cost' else route['duration_minutes'] if request.ranking=='fastest_trip' else balanced_cost
            options.append(((primary, balanced_cost), driver.id if driver else '', driver, route, fee))
        if not options:
            continue
        _, _, driver, route, fee = min(options, key=lambda x: (x[0], x[1]))
        total = sum(i.price_cents for i in items)/100
        score = selection_score(items, request)/100
        bundle_sellers = [sellers[sid] for sid in sorted({i.seller_id for i in items})]
        results.append({'id': str(uuid4()), 'listings': [i.public() for i in sorted(items, key=lambda i: request.categories.index(i.category))],
                        'sellers': [s.public() for s in bundle_sellers], 'item_total': total,
                        'condition_score': round(sum(i.condition_score for i in items)/len(items), 1),
                        'seller_count': len(bundle_sellers), 'total_size': sum(i.item_size for i in items),
                        'transportation_mode': 'buyer_pickup' if request.buyer_has_car else 'seller_delivery',
                        'driver': driver.public() if driver else None, 'delivery_fee': fee,
                        'reward_breakdown': {'base': 5, 'distance': round(fee-5-2*max(0,len(bundle_sellers)-1), 2), 'additional_stops': max(0,len(bundle_sellers)-1), 'stops_fee': 2*max(0,len(bundle_sellers)-1)} if driver else None,
                        'total': round(total+fee, 2), 'route': route,
                        'distance_miles': route['distance_miles'], 'duration_minutes': route['duration_minutes'],
                        'selection_score': score, 'final_score': round(score-route['duration_minutes']*.35-fee*.25, 2),
                        'request': request.model_dump(mode='json'), 'ranking': request.ranking,
                        'ranking_reason': f"${round(total+fee,2):.2f} total · {round(sum(i.condition_score for i in items)/len(items),1)}/10 condition · {round(route['duration_minutes'])} min trip",
                        'created_at': utcnow().isoformat()})
    results.sort(key=lambda b: (b['total'] if request.ranking=='lowest_cost' else -sum(i['condition_score'] for i in b['listings'])/len(b['listings']) if request.ranking=='best_condition' else b['duration_minutes'] if request.ranking=='fastest_trip' else -b['final_score'], -b['final_score'], tuple(i['id'] for i in b['listings'])))
    results = results[:result_limit]
    # Road geometry is needed only for the final cards, after all driver/route decisions.
    for bundle in results:
        route = bundle['route']
        if route['source'] == 'mapbox':
            geometry = provider.geometry([Location(**s['location']) for s in route['stops']])
            if geometry:
                route['geometry'], route['geometry_source'] = geometry, 'mapbox'
            else:
                route['warning'] = 'Road distances are available; the map shows straight lines between stops.'
    message = f'{len(results)} feasible bundle options found.' if results else {
        'missing_category': 'No available listings match every category within this budget and area. Try a higher budget, fewer categories, or a larger search radius.',
        'no_driver': 'No selected-area sellers offer delivery. Try self-pickup or a larger search radius.',
    }.get(status, 'No feasible bundle fits your budget and transport needs. Try a higher budget, fewer items, or self-pickup.')
    if not results and route_rejections:
        message = 'The candidate bundles could not be reached by road. Try a different pickup area.'
    return {'bundles': results, 'message': message, 'diagnostics': {
        'inventory_count': len(listings), 'candidate_count': len(candidates),
        'candidate_counts': dict(counts), 'filtered_out': rejected,
        'possible_combinations': prod(counts.get(c, 0) for c in request.categories),
        'combination_checks': feasibility_report(candidates, sellers, request),
        'candidate_bundles': len(sets), 'candidate_bundle_limit': candidate_limit,
        'solver_status': status, 'route_rejections': route_rejections,
        'constraints': ['category coverage', 'item budget', 'availability', 'unique listings'] +
                       ([] if request.buyer_has_car else ['selected seller driver', 'one delivery lead', 'vehicle capacity'])}}
