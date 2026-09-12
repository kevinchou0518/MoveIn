from dataclasses import dataclass
import math
import httpx
from ortools.constraint_solver import pywrapcp, routing_enums_pb2
from app.schemas import BundleRequest, Listing, Location, Seller
from app.services.candidate_filter import miles


@dataclass
class Matrix:
    distances: list[list[float | None]]
    durations: list[list[float | None]]
    source: str = 'estimated'
    warning: str | None = None


class RouteUnavailable(Exception):
    pass


class MapProvider:
    def __init__(self, token: str = ''):
        self.token = token

    def matrix(self, points: list[Location]) -> Matrix:
        if self.token:
            try:
                coords = ';'.join(f'{p.lng},{p.lat}' for p in points)
                r = httpx.get(f'https://api.mapbox.com/directions-matrix/v1/mapbox/driving/{coords}',
                              params={'access_token': self.token, 'annotations': 'distance,duration'}, timeout=6)
                r.raise_for_status()
                data = r.json()
                distances, durations = data['distances'], data['durations']
                n = len(points)
                if data.get('code') != 'Ok' or len(distances) != n or len(durations) != n:
                    raise ValueError('Invalid matrix')
                for matrix in (distances, durations):
                    if any(len(row) != n or any(v is not None and (not math.isfinite(v) or v < 0) for v in row) for row in matrix):
                        raise ValueError('Invalid matrix values')
                return Matrix(distances, durations, 'mapbox')
            except (httpx.HTTPError, KeyError, ValueError, TypeError):
                warning = 'Road routing is unavailable. Distances and times are approximate.'
        else:
            warning = 'Estimated route: straight-line distances × 1.3 at 20 mph. Road navigation is not configured.'
        distances = [[miles(a,b)*1609.344*1.3 for b in points] for a in points]
        return Matrix(distances, [[d/1609.344/20*3600 for d in row] for row in distances], warning=warning)

    def geometry(self, points: list[Location]):
        if not self.token:
            return None
        try:
            coords = ';'.join(f'{p.lng},{p.lat}' for p in points)
            r = httpx.get(f'https://api.mapbox.com/directions/v5/mapbox/driving/{coords}',
                          params={'access_token': self.token, 'geometries': 'geojson', 'overview': 'full'}, timeout=6)
            r.raise_for_status()
            data = r.json()
            return data['routes'][0]['geometry']['coordinates']
        except (httpx.HTTPError, KeyError, ValueError, IndexError, TypeError):
            return None


def solve_order(matrix: Matrix, start: int, end: int) -> list[int]:
    n = len(matrix.durations)
    manager = pywrapcp.RoutingIndexManager(n, 1, [start], [end])
    routing = pywrapcp.RoutingModel(manager)
    def cost(a, b):
        value = matrix.durations[manager.IndexToNode(a)][manager.IndexToNode(b)]
        return round(value) if value is not None else 10**9
    callback = routing.RegisterTransitCallback(cost)
    routing.SetArcCostEvaluatorOfAllVehicles(callback)
    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GREEDY_DESCENT
    params.solution_limit = 100
    params.time_limit.FromSeconds(1)
    solution = routing.SolveWithParameters(params)
    if solution is None:
        raise RouteUnavailable('No pickup route is available.')
    order, index = [], routing.Start(0)
    while not routing.IsEnd(index):
        order.append(manager.IndexToNode(index))
        index = solution.Value(routing.NextVar(index))
    order.append(manager.IndexToNode(index))
    if any(matrix.durations[a][b] is None or matrix.distances[a][b] is None for a,b in zip(order, order[1:])):
        raise RouteUnavailable('A pickup location cannot be reached by road.')
    return order


def calculate_route(items: list[Listing], sellers: dict[str, Seller], request: BundleRequest,
                    driver: Seller | None, provider: MapProvider, cache: dict):
    seller_ids = sorted({i.seller_id for i in items})
    # Seller start is one of the actual pickup nodes, buyer is always node zero.
    points = [request.buyer_location] + [sellers[sid].location for sid in seller_ids]
    key = tuple((p.lat, p.lng) for p in points)
    if key not in cache:
        cache[key] = provider.matrix(points)
    matrix = cache[key]
    start = seller_ids.index(driver.id)+1 if driver else 0
    order = solve_order(matrix, start, 0)
    meters = sum(matrix.distances[a][b] for a,b in zip(order, order[1:]))
    seconds = sum(matrix.durations[a][b] for a,b in zip(order, order[1:]))
    stops = []
    for idx in order:
        sid = seller_ids[idx-1] if idx else None
        stops.append({'kind': 'seller' if idx else 'buyer', 'seller_id': sid,
                      'name': sellers[sid].name if sid else 'Your place',
                      'location': points[idx].model_dump(),
                      'listing_ids': [i.id for i in items if i.seller_id == sid]})
    return {'stops': stops, 'geometry': [[points[idx].lng, points[idx].lat] for idx in order],
            'distance_miles': round(meters/1609.344, 2), 'duration_minutes': round(seconds/60, 1),
            'source': matrix.source, 'geometry_source': 'schematic', 'warning': matrix.warning}
