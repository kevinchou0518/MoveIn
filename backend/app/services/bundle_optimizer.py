from ortools.sat.python import cp_model
from app.schemas import BundleRequest, Listing, Seller
from app.services.candidate_filter import miles


def selection_score(items: list[Listing], request: BundleRequest) -> int:
    # Hundredth-point units: condition × 10; price × -0.08;
    # seller count × -3; summed buyer distance × -0.5.
    n = len(request.categories)
    return sum(round(i.condition_score*1000/n) - round(i.price_cents*0.08)
               - round(miles(i.location, request.buyer_location)*50) for i in items) - 300*len({i.seller_id for i in items})


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
    n = len(request.categories)
    weights = [round(i.condition_score*1000/n) - round(i.price_cents*0.08)
               - round(miles(i.location, request.buyer_location)*50) for i in items]
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
