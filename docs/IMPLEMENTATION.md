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

P1 implemented after P0 verification: optional Grok image analysis with explicit review/apply controls and itemized driver rewards. Authentication remains deferred.

P2: comparable-price research, natural-language requirements, item swaps, ranking improvements.

P2 is implemented. Bundle results link to durable `/bundles/{id}` pages. Checkout requires a native confirmation dialog and redirects to `/orders/{id}`; the receipt can fresh-generate with the saved request against current inventory. Browser history supports back/forward navigation, page focus resets, and reduced-motion preferences.

Results use `/buyer/results?search=<id>`, with a versioned per-tab request snapshot in session storage and an in-memory fallback. Every results entry regenerates current inventory. Back-to-results traverses tracked browser history; direct bundle links recover from the stored bundle request. Missing search snapshots return to the buyer form. No database migration is required.

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
| POST /listings/analyze | uploaded image_url, optional title and description | Structured editable suggestions; 422 invalid request, 404 missing upload, 503 unavailable/configuration error, 504 timeout, 502 invalid upstream output |
| POST /bundles/generate | BundleRequest | {bundles: Bundle[], diagnostics, message} |
| POST /bundles/{id}/checkout | no payment/body required | 201 Order (idempotent for same bundle), 404 unknown, 409 unavailable, 410 expired |
| GET /deliveries/{seller_id} | — | Order[] for the selected delivery lead |
| GET /categories | — | Shared Category[] |
| POST /categories | `{name}` | 201 idempotent Category |
| POST /buyer/parse | `{text}` | Nullable buyer requirement draft and explanations |
| POST /listings/research-price | title, category, condition, optional brand/model | Up to five cited comparables and optional used-asking range |
| GET /bundles/{id} | — | Stored bundle plus nullable order ID |
| POST /bundles/{id}/alternatives | `{listing_id}` | Up to three new bundle versions with exactly one replacement |
| GET /orders/{id} | — | Durable reservation and full bundle snapshot |

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

## P1 contracts

Analysis returns nullable title, description, category, condition, condition_score, estimated_product, suggested_price_min/max, plus visible_issues and confidence. Categories and condition values match listing creation; office_chair normalizes to chair. Scores are 0–10, confidence 0–1, and finite USD price bounds must be ordered and both present or both null. Images must be JPEG files returned by the upload endpoint; arbitrary URLs and paths are rejected. The server sends base64 image data and seller text to xAI Responses with JSON Schema, store=false, and a 30-second timeout without retries. No analysis record or inventory mutation is made.

Sellers trigger analysis explicitly. Null suggestions cannot be applied. Existing values are unchecked; blank fields are selected when results arrive. Accepted visible issues join the editable description, and the price midpoint is rounded to cents. Photo replacement, profile changes, publishing, and unmount invalidate pending results. Item size and availability remain manual.

New bundles and order snapshots include nullable reward_breakdown with base, distance, additional_stops, and stops_fee. Self-pickup returns null and zero delivery fee. Legacy snapshots display their stored total without needing migration.

## Address selection

Shared buyer/seller LocationPicker replaces latitude/longitude fields with explicit text search and named result selection. GET /locations/search?q=… validates 3–200 characters and returns Location[] (lat, lng, label). Mapbox Geocoding v6 uses a Pittsburgh proximity bias, US country filter, five results, autocomplete=false and permanent=true; requests are triggered by Search or Enter rather than every keystroke. Provider failures return a sanitized 503; demo neighborhood shortcuts remain usable. Changing the query invalidates the selected coordinates and stale responses are ignored. Existing seller/listing/bundle schemas remain unchanged.

## P2 contracts

- Sellers explicitly create flexible categories. Names are whitespace/case normalized and receive deterministic IDs; `office_chair` remains a `chair` alias. Buyers search the shared catalog and select up to six unique categories.
- Ranking changes deterministic optimizer weights and route reranking. Every returned option still satisfies budget, availability, radius, driver membership, and capacity constraints. AI never chooses inventory, drivers, or routes.
- A swap creates a new stored bundle and changes exactly one listing in the same category. Retained items, price, current availability, radius, delivery leadership, capacity, and route feasibility are rechecked. The source bundle is never mutated.
- Buyer text parsing returns nullable fields only. Every proposed field requires review and explicit selection; address text clears coordinates until the buyer selects a geocoded result.
- Price research makes at most five xAI web-search tool calls with a 60-second timeout and no retry. Only comparables whose URLs appear in response citations are displayed. Used asking, sold, and new retail evidence stay labeled; a range is computed only from three or more cited used asking prices.
- The eight supplied photos are normalized to at most 1600 px and stored without EXIF metadata. Their listing facts are explicitly fictional. Migration targets only unchanged seed IDs and preserves reservation state and historical snapshots.
