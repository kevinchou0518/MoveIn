# Verification

## Completed

- Empty workspace inspected; no prior files or Git checkout existed.
- Authoritative brief preserved verbatim in `SPEC.md`.
- Smallest vertical slice verified before expanding: a single result returned through FastAPI TestClient with $235 furniture, a represented seller driver, size 9 <= truck capacity 12, and correct start/end points.
- Seed then adjusted so the baseline visibly requires multiple sellers.
- 26 backend tests pass: core constraints, repeatability, exact currency and capacity boundaries, both route modes, brute-force reference route comparison, unreachable routes, Mapbox response parsing/failure behavior, request validation, photo upload, seller/listing publishing, persistence, idempotent and conflicting checkout, concurrent reservations, and expiration.
- TypeScript checks and Vite production build pass.
- Buyer comparison, route details, seller publishing, and driver dashboard visually inspected in Chrome.
- Browser: generated three delivery bundles, reserved one, saw inventory become unavailable, and viewed the correct driver assignment/reward.
- Browser: uploaded a PNG, edited listing fields, published, and saw it appear in inventory.
- Browser: self-pickup displayed zero delivery fee and buyer start/end; $1 budget produced an explanatory empty state.
- Mobile at 390 × 844: no horizontal overflow, no broken images, buyer and seller layouts inspected.
- Original SVG illustrations bundled locally. Browser screenshots are in ignored `output/playwright/`.
- Corrected configuration paths and restored the local seed after smoke testing; test data is backed up in ignored `backend/data/`.

## Baseline output (unmodified seed, estimated routing)

Request: TV + TV stand + desk + chair, $300 furniture budget, no car, (40.443, -79.943).

| Rank | Furniture | Delivery | Total | Load | Route |
| --- | --- | --- | --- | --- | --- |
| 1 | $225 | $14.05 | $239.05 | 9 / 12 | Jordan → Maya → Alex → Buyer |
| 2 | $220 | $14.05 | $234.05 | 9 / 12 | Jordan → Maya → Alex → Buyer |
| 3 | $220 | $14.23 | $234.23 | 9 / 12 | Riley → Sam → Maya → Buyer |

The candidate audit checks 400 combinations: 10 fail budget, 12 have no seller driver, 64 exceed eligible vehicle capacity, and 314 pass the bundle constraints before routing. Each rejection is counted at its first failed constraint. The final seed requires three sellers, so both pickup order and alternative drivers are visible.

The sets of listings differ even where driver and route are shared. Dynamic bundle IDs and timestamps are intentionally not deterministic; listing selection, scores, and route order are repeatable for the same inventory and date.

## Live Mapbox result

On the verification run, the final options had furniture subtotals of $220, $215, and $210 plus $14.96 delivery. The best option totaled $234.96 with Riley as delivery lead, route Riley → Sam → Maya → Buyer, 5.96 road miles, 32.4 driving minutes, and a 9-unit load in a 12-unit truck. Road data changed the ranking relative to straight-line estimates, demonstrating the separate route reranking stage. Live provider results may change over time.

## External-service limits

Mapbox credentials became available during verification. After confirming SPEC §8 authorizes the integration and that every location is a fictional seed fixture, live Matrix and Directions requests succeeded. All three returned routes report `source=mapbox`, `geometry_source=mapbox`, and 397 road geometry points. Mapbox tile visualization was checked in the browser. Atlas remains unconfigured; its adapter is implemented but live persistence/transactions are unverified. Local persistence is verified. Without map credentials, the fallback remains an explicitly labeled estimate/schematic. P1 Grok analysis and P2 features are deferred.

Local persistence supports one process; use Atlas for multiple workers. The demo has no auth or real payments and must not be treated as a public production marketplace. Seed images are illustrations, not photos of real listings. Frontend font loading can fall back to installed serif/sans fonts if offline.
