# Implementation plan and contracts

`SPEC.md` is the authoritative product specification. Initial inspection: the workspace is empty, with no application, dependencies, or Git repository.

## Delivery plan

P0, in order:
1. Seed realistic Pittsburgh sellers/listings. Define validated schemas, local demo persistence, and a MongoDB Atlas adapter.
2. Prove a vertical slice: listings → category/availability/price/radius filtering → CP-SAT selection → capacity/driver verification → deterministic route → one valid bundle.
3. Generate up to ten distinct listing combinations with exclusion constraints, evaluate eligible drivers, optimize routes with OR-Tools Routing, calculate fees, rerank, return three.
4. Add Mapbox road matrices and route geometry when configured; preserve an explicitly labeled distance-estimate fallback for a reliable demo without credentials.
5. Connect a React buyer form, bundle comparison, route details, checkout, seller publishing with photo upload, and delivery assignments.
6. Verify constraints, routing, persistence, checkout conflicts, API contracts, frontend build, and both browser flows.

P1 (only after P0 works): optional Grok image analysis with editable suggestions; expand driver reward presentation. Authentication is deferred.

P2: comparable-price research, natural-language requirements, item swaps, ranking improvements.

## Decisions

- Exactly one listing per requested category; duplicate categories are rejected. `office_chair` normalizes to `chair`.
- Budget applies to item subtotal per the spec. Delivery is additional and shown before checkout.
- Prices accept at most two decimal places and are converted to integer cents for constraints and totals.
- Availability means `available` and `available_date <= today` (UTC). No scheduling negotiation.
- Candidate radius defaults to 25 miles, maximum 100, with a bounded number of candidates per category. The response discloses filtering and search limits; no claim of global optimality.
- A seller's listings use that seller's single pickup location. One stop per seller.
- Size units: small 1, medium 2, large 3; sedan 4, SUV 7, truck 12. Capacity is derived from vehicle type, never trusted from a submitted capacity.
- Buyer self-pickup has no capacity constraint because the specified buyer form does not collect a vehicle type. This MVP assumption is visible in the form.
- CP-SAT chooses the bundle, independently of the route solver. Driver eligibility and capacity are encoded in CP-SAT, then verified again before routing.
- For up to 10,000 category combinations, a separate read-only feasibility audit counts first-failure reasons for the demo. It does not choose bundles; CP-SAT remains the selection engine. Larger spaces omit this audit.
- Selection objective: reward average condition, penalize item price, seller count, and summed approximate buyer distance. Route reranking adds travel duration and delivery cost penalties. Hardcoded, documented weights; no LLM decisions.
- Delivery fee = $5 + $1 × route miles + $2 × additional seller stops, rounded to cents. No fee for self-pickup. Travel duration excludes loading time.
- An unconfigured demo uses a persisted local JSON store. Setting `MONGODB_URI` selects Atlas; configured Atlas failures are surfaced rather than silently losing writes. Atlas checkout uses transactions.
- Generated bundles are stored with a 30-minute expiration. Checkout rechecks inventory and reserves all items atomically. Repeat checkout of the same bundle returns the existing order. Conflicting bundles return 409.
- No real payment or authentication. Seller identity is explicitly a demo persona selector.
- Uploaded photos are local files in P0; metadata can be stored in Atlas. Production object storage is deferred.

## Minimum models

| Model | Fields |
| --- | --- |
| Location | lat [-90,90], lng [-180,180], optional label |
| Seller | id, name, location, can_drive, vehicle_type, derived vehicle_capacity |
| Listing | id, seller_id, title, category, description, price, condition, condition_score [0,10], item_size [1,3], image_url, location, available, available_date |
| BundleRequest | unique categories, budget, buyer_has_car, buyer_location, radius_miles |
| Bundle | id, listings, sellers, item_total, condition_score, seller_count, total_size, transportation_mode, driver, delivery_fee, total, route, distance_miles, duration_minutes, selection_score, final_score, created_at |
| Route | ordered stops (seller or buyer, location, item IDs), geometry [lng,lat], distance_miles, duration_minutes, source, warning |
| Order | id, bundle_id, full bundle snapshot, created_at, status=reserved |

## REST API

All JSON; validation errors use FastAPI's `detail` array; business errors use `detail` string. No feasible bundles returns 200 with an empty `bundles` array and explanatory `message`.

| Method and path | Request | Response |
| --- | --- | --- |
| GET /health | — | status, storage, routing |
| GET /sellers | — | Seller[] |
| GET /listings | optional category, available | Listing[] |
| POST /listings | ListingCreate: existing seller_id, title, category, description, price, condition, condition_score, item_size, image_url, available_date | 201 Listing |
| POST /sellers | name, location, can_drive, vehicle_type | 201 Seller |
| POST /uploads | multipart `file`: JPEG/PNG/WebP, max 8 MB | {image_url} |
| POST /listings/analyze | P1, image_url and optional seller context | 503 until configured/implemented; must not block publishing |
| POST /bundles/generate | BundleRequest | {bundles: Bundle[], diagnostics, message} |
| POST /bundles/{id}/checkout | no payment/body required | 201 Order (idempotent for same bundle), 404 unknown, 409 unavailable, 410 expired |
| GET /deliveries/{seller_id} | — | Order[] for the selected delivery lead |

Full interactive contract: FastAPI `/docs`; machine-readable `/openapi.json`.

## Seed requirements

At least six named fictional Pittsburgh sellers across Oakland, Shadyside, Bloomfield, Squirrel Hill, and Lawrenceville. Include non-drivers, an insufficient-capacity sedan, an SUV, and two trucks. At least four candidates for each of TV, TV stand, desk, chair. Include tempting unavailable, future-dated, distant, and over-budget inventory. Fixture images are bundled locally. Baseline: these four categories, $300, no car, Oakland (40.443,-79.943). It must consistently produce three distinct feasible bundles, each with at least three sellers so pickup ordering is visible. Tests independently exercise no driver, insufficient capacity, tight budget, missing category, self-pickup, and stale checkout.

## Critical path

The optimizer's hard constraints and one successful API response come first. Expand and test top-three routing next. Connect the buyer flow before optional AI. Credentials, external image hosts, maps, and MongoDB must not block the seed demo. A configured Mapbox response is road-based; a fallback is labeled an estimate and never passed off as road navigation.

## Technical references

- [CP-SAT Python API](https://developers.google.com/optimization/cp/cp_solver)
- [OR-Tools routing](https://developers.google.com/optimization/routing/tsp)
- [Mapbox Matrix API](https://docs.mapbox.com/api/navigation/matrix/)
- [Mapbox Directions API](https://docs.mapbox.com/api/navigation/directions/)
- [FastAPI uploads](https://fastapi.tiangolo.com/tutorial/request-files/)
