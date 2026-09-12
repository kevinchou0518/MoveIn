from ortools.sat.python import cp_model
from app.schemas import BundleRequest, Listing, Seller
from app.services.candidate_filter import miles


def item_weight(item, request, balanced=False):
    mode='balanced' if balanced else request.ranking
    return (round(item.condition_score*1000/len(request.categories)*(2 if mode=='best_condition' else 1))
            - round(item.price_cents*.08*(2 if mode=='lowest_cost' else 1))
            - round(miles(item.location,request.buyer_location)*50*(2 if mode=='fastest_trip' else 1)))


def selection_score(items: list[Listing], request: BundleRequest) -> int:
    return sum(item_weight(i,request,balanced=True) for i in items)-300*len({i.seller_id for i in items})


def optimize_bundles(items: list[Listing], sellers: dict[str, Seller], request: BundleRequest, limit: int = 10):
    if any(not any(i.category == c for i in items) for c in request.categories):
        return [], 'missing_category'
    model = cp_model.CpModel()
    chosen = [model.new_bool_var(f'listing_{i.id}') for i in items]
    for category in request.categories:
        model.add(sum(x for x, i in zip(chosen, items) if i.category == category) == 1)
    model.add(sum(x*i.price_cents for x, i in zip(chosen, items)) <= int(request.budget*100))
    represented = {}
    for seller_id in sorted({i.seller_id for i in items}):
        represented[seller_id] = model.new_bool_var(f'seller_{seller_id}')
        model.add_max_equality(represented[seller_id], [x for x, i in zip(chosen, items) if i.seller_id == seller_id])
    if not request.buyer_has_car:
        leads = []
        total_size = sum(x*i.item_size for x, i in zip(chosen, items))
        for sid, y in represented.items():
            seller = sellers[sid]
            if seller.can_drive:
                lead = model.new_bool_var(f'driver_{sid}')
                model.add(lead <= y)
                model.add(total_size <= seller.vehicle_capacity).only_enforce_if(lead)
                leads.append(lead)
        if not leads:
            return [], 'no_driver'
        model.add(sum(leads) == 1)
    weights = [item_weight(i,request) for i in items]
    model.maximize(sum(x*w for x, w in zip(chosen, weights)) - 300*sum(represented.values()))
    solver = cp_model.CpSolver()
    solver.parameters.num_search_workers = 1
    solver.parameters.random_seed = 0
    solver.parameters.max_deterministic_time = 0.25
    solutions = []
    last_status = 'infeasible'
    for _ in range(limit):
        status = solver.solve(model)
        last_status = solver.status_name(status).lower()
        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            break
        indices = [idx for idx, x in enumerate(chosen) if solver.value(x)]
        selected = [items[idx] for idx in indices]
        solutions.append(selected)
        # Exclude the listing set, not merely the current driver assignment.
        model.add(sum(chosen[idx] for idx in indices) <= len(indices)-1)
    return solutions, last_status
