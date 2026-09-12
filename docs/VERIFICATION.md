# Verification

## Compact seller analysis and pickup address — latest

- Reduced the seller AI panel to one button, a short result status, and actionable errors. Added a loading spinner, photo scan, and completion transition, with reduced-motion support. Removed confidence, price-range prose, and duplicate instructions; analysis still fills the editable form automatically.
- Seller inventory now includes Change address, address search/selection, Save address, and cancel. Saving updates the seller pickup location and listing locations, preserves listing drafts, blocks overlapping form submission, and retains backend restrictions for active orders. Older dashboard reads cannot replace the saved address.
- All 62 frontend tests and the production build pass. New tests cover address selection, no accidental listing submission, saved address updates, active-order rejection/retry, preserved drafts, and analysis busy/result states. No backend behavior changed.

## Seller photo analysis autofill — latest

- Photo analysis now directly fills title, category, description/visible issues, condition, score, and the suggested price midpoint. Removed the selection checkboxes and Apply step; users can edit the resulting form before publishing.
- Null/empty suggestions leave existing values intact. Edits made while analysis is pending are preserved, and stale results after photo/profile changes are still discarded.
- All 60 frontend tests and the production TypeScript/Vite build pass. Tests cover direct filling of existing fields, manual edits before publishing, in-flight edits, empty results, stale responses, and provider failure.

## Original sellers promoted to users — latest

- The seven original sellers are now the seven selectable users. Each owns their original furniture and can buy, sell, and manage orders. Profile directly edits the selected user's settings; the extra selling-profile selector and Sell furniture account/settings panel were removed.
- Existing local data was backed up before restarting with the repeatable ownership migration. All listing records and order statuses were verified unchanged; the seven seed profiles now have seven distinct owners. Previous three-user demo identities map to Maya/Jordan/Riley for existing purchases and custom records. Atlas remains unchanged.
- 111 backend tests pass (two optional Atlas tests skipped), 53 frontend tests pass, and the production build passes. Tests cover independent ownership, all seven users buying and creating selling records, migration preservation/idempotency, and absence of the redundant UI.

## Unified accounts and Profile settings — latest

- Profile is the only user-switching surface. Avery, Casey, and Morgan have identical buying/selling capabilities, with existing internal identity IDs preserved. Profile supports pickup/delivery settings, creating selling profiles, and remembering the active owned profile per account. Seller inventory no longer has a profile/user selector.
- Header navigation now tracks Find furniture, My orders, Sell furniture, and Profile independently. Order history and buyer order details highlight My orders instead of Find furniture.
- 106 backend tests pass (two opt-in Atlas tests skipped), 53 frontend tests pass, and the production build passes. Added tests verify every persona can buy and create selling profiles, profile save/load recovery and switching, and independent My orders navigation.
- Live browser checks confirmed switching users in Profile, selecting Riley's selling profile and opening its inventory without a switcher, and navigating to My orders with the correct selected header state. The app still uses the separate local demo database.

## Review fixes — latest checkpoint

- Pending listing saves disable the complete editor and Cancel editing. Successful saves reset the submitted form; failed saves retain the draft and re-enable editing. Success/failure regression tests verify the controls lock and subsequent drafts remain editable. All 50 frontend tests and the production build pass after this fix; backend code is unchanged.
- Per-listing write locks disable conflicting inventory actions until the pending request settles. Synchronous submit guards also reject duplicate requests; locks release on success and failure. Regression tests cover withdrawal followed by editing, editing followed by withdrawal, and recovery after a failed withdrawal. All 48 frontend tests and the production build pass after this follow-up; backend code is unchanged from the 103-test checkpoint below.
- Seller inventory refreshes preserve visible inventory and discard responses that overlap listing mutations, including refreshes started before or during an edit, creation, withdrawal, or republish.
- Listing PATCH validates the merged record before category/image helpers. Malformed category/image values return 422; failed validation leaves stored records unchanged.
- Saving withdrawn furniture reports that changes were saved and explicit republishing is still required.
- 103 backend tests pass (two opt-in Atlas tests skipped), 45 frontend tests pass, and the production build passes. The running demo continues to use the separate local persona database; Atlas data is unchanged.

## Demo persona replacement — current

- Removed Auth0 SDK, JWT validation/dependency, and required Auth0 environment settings. Header selection supports Demo buyer, Second buyer, and Demo seller without login. All seven unowned seed seller profiles are assigned to the seller persona on startup; custom ownership is preserved.
- 95 backend tests and 36 frontend tests pass; two opt-in Atlas tests skipped. Production build and diff whitespace checks pass. Obsolete JWT/login tests were replaced by demo identity, seed ownership/idempotency, and user-switching tests; existing order ownership and lifecycle regressions remain.
- Browser verification confirmed the seller selector opens inventory with all seven profiles, and switching to Second buyer opens that buyer's order history without a login step.
- Atlas mapping preview failed before writes with a TLS handshake error. No historical Atlas orders were changed. For testing, the running app uses the separate local `backend/data/persona-demo.json` via process-only environment overrides; `.env` is unchanged. Ordinary `./scripts/dev.sh` continues to use the configured Atlas database when connectivity is restored.
- Earlier Auth0 setup and verification entries below are historical and superseded by this replacement.

## Account and order management — current checkpoint

- 100 backend tests pass; two optional Atlas tests are skipped in the ordinary suite. Both Atlas tests passed separately against disposable databases, which were removed afterward. Coverage includes account ownership, JWT validation, lifecycle permissions, cancellation/start races, safe inventory release, upload ownership, stale listing guards, CORS on auth failures, migration idempotency, local write rollback, and selected-seller mutation permissions/redaction.
- 37 frontend tests pass, including buyer-only delivery navigation, cancelled receipts, reason/confirmation requirements, duplicate-click guards, pagination/status filtering, login gates, stale account responses, listing editing/withdrawal, and owned seller tabs. New regressions cover late refreshes after cancellation, failed refreshes retaining the confirmed status, reduced seller mutation responses, preservation/discard of profile drafts, and dashboard retry. Production TypeScript/Vite build passes.
- Chrome inspected the public buyer form and protected-order gate at 390 × 844: both fit without horizontal overflow. My orders stays in buyer navigation. Authenticated controls were tested with isolated component fixtures, not a live Auth0 session.
- Both development services were restarted with the configured Auth0 environment. Live browser sign-in reaches Auth0 but fails with **Callback URL mismatch**. Add `http://localhost:5173/auth/callback` and `http://127.0.0.1:5173/auth/callback` to the SPA application's Allowed Callback URLs. Live login/logout and separate-account fulfillment remain pending this dashboard correction and test-user login.
- Test-user IDs and `backend/data/account-map.json` are still missing. The mapping migration is implemented and tested but has NOT changed the four historical live reservations. They will be assigned as cancelled after explicit buyer/seller mappings are provided, preserving available inventory.
- No authentication bypass was added. The old local reset command now delegates to the shared reset implementation, preserving account and upload ownership records.

## Demo storage follow-up

- Demo photo sources now live in `backend/fixtures/photos/`; the backend serves installed copies from `/uploads/demo/`. Legacy receipt photo URLs remain supported.
- `scripts/demo_data.py` previews seed/reset operations by default. Apply backs up existing records; MongoDB writes are transactional. Full reset is explicitly destructive to all app records, while seed mode preserves custom data and reservation history.
- 79 backend tests pass, with one optional Atlas test skipped; production TypeScript/Vite build passes. Added coverage verifies idempotent seeding, preservation of edits and reservations, full reset behavior, backup-before-reset, dry-run behavior, and all eight current/legacy photo URLs.
- Live Atlas seed apply migrated photo URLs while retaining 27 listings, 39 bundles, and 4 orders. No full live reset was performed.

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

Mapbox credentials became available during verification. After confirming SPEC §8 authorizes the integration and that every location is a fictional seed fixture, live Matrix and Directions requests succeeded. All three returned routes report `source=mapbox`, `geometry_source=mapbox`, and 397 road geometry points. Mapbox tile visualization was checked in the browser. Atlas remains unconfigured; its adapter is implemented but live persistence/transactions are unverified. Local persistence is verified. Without map credentials, the fallback remains an explicitly labeled estimate/schematic. At that P0 checkpoint, P1 Grok analysis and P2 features were deferred; see the P1 verification below for current status.

Local persistence supports one process; use Atlas for multiple workers. The demo has no auth or real payments and must not be treated as a public production marketplace. Seed images are illustrations, not photos of real listings. Frontend font loading can fall back to installed serif/sans fonts if offline.

## P1 verification — September 12, 2026

- 45 backend tests pass, including structured AI validation, upload boundaries, provider errors/timeouts, manual publishing after AI failure, no analysis inventory mutations, and reward totals in checkout snapshots.
- 5 frontend component tests pass: preserve seller edits, apply blank-field suggestions and price midpoint, publish edited values, discard stale profile/photo responses, continue manually after failure, and disable application when no suggestions are usable. Run `cd frontend && npm test`.
- TypeScript and Vite production build pass.
- Live Grok Responses request with the configured model and a synthetic chair illustration returned schema-valid suggestions. Browser upload → Analyze photo → Apply selected suggestions succeeded; the existing title was preserved and the accepted description appeared in the editable form. The illustration was labeled with low confidence, so this verifies integration rather than real-photo valuation quality.
- Mobile analysis panel inspected at 390 × 844 with no horizontal overflow. Browser file uploads initially required enabling the extension's file-URL access; the user enabled it and the retry succeeded.
- Live Mapbox matrix source was `mapbox`; the two-stop fictional demo route returned 151 geometry points and a map tile returned HTTP 200.
- Atlas remains blocked: the current `MONGODB_URI` is set but lacks a valid MongoDB URI scheme. No Atlas persistence/transaction check or migration was performed. Local mode remains active through a process-only override; `.env` was not changed.
- Authentication, comparable-price research, and other P2 work remain deferred. Analysis is optional and never makes optimizer decisions.
- Browser buyer generation returned three live road-route bundles. Reserved the first as demo order `86c21a6b…`; its four listings are now reserved in the local demo store. Riley's delivery dashboard showed $14.96 = $5 base + $5.96 mileage + $4 for two additional stops. Road map tiles and route were visible. Desktop and 390-pixel mobile delivery layouts passed visual inspection without horizontal overflow.

## Address search and Atlas — September 12, 2026

- Replaced buyer coordinate entry and seller pickup latitude/longitude with shared Mapbox address search, explicit selection, and demo neighborhood shortcuts. Seller route stops display readable location labels.
- Live permanent geocoding of the public address 5000 Forbes Avenue, Pittsburgh returned matching addresses.
- Removed a stray leading slash from the configured MongoDB URI without printing secrets. Atlas ping and the isolated persistence/concurrent checkout/idempotency test passed. Temporary test database was deleted afterward. The app was restarted without the local-storage override and now uses Atlas. Local JSON history was preserved without migration.
- 51 ordinary backend tests pass; the live Atlas test is skipped unless MONGODB_TEST_URI is explicitly set, and passed separately with the configured credentials. Eight frontend tests pass, including location result selection, invalidation after edits, stale search responses, and unavailable/no-results behavior. Production build passes.

- Browser buyer search and result selection passed. Seller pickup search returned named results; the profile form has no coordinate fields and fits at 390 × 844 without horizontal overflow.

## P2 verification — September 12, 2026

- 75 backend tests pass, with one opt-in Atlas test skipped in the ordinary suite. New coverage includes category normalization/concurrent creation/persistence, custom-category bundles, all four stable rankings, one-item swaps, legacy bundles, expiration, changed prices, missing drivers, capacity, budget, radius and availability failures, cited-comparable gating, malformed/upstream AI responses, and guarded/idempotent photo migration.
- 14 frontend tests pass. Confirmation cancellation makes no checkout request; repeated clicks submit once; expired inventory offers a fresh search; order refresh restores the receipt; **Find another bundle** retains the exact buyer request. Buyer and seller AI drafts require explicit field application and stale results are discarded.
- Production TypeScript/Vite build passes. Desktop browser validation covered results → detail page → fixed-item swap → confirmation cancel → confirmation → durable receipt → fresh results. The second search excluded reserved items. The driver deep link opened the matching delivery tab. Mobile delivery plans were inspected at 390 × 844.
- Live Mapbox routes and tiles rendered on the detail, receipt, and seller delivery pages. The app is running with Atlas storage. A demo reservation made during verification persisted as `e1eeb1d9…` and appeared for Riley Morgan.
- All eight supplied photos returned schema-valid Grok analyses with their expected broad catalog categories: four chairs/seat variants, vacuum, TV, lamp, sofa, and fan. Results are saved under ignored `artifacts/p2-live/` for local inspection. AI observations remain reviewable suggestions.
- Live buyer parsing extracted desk + chair, a $150 budget, Oakland, seller delivery, and Lowest total cost. Live price research returned five cited Honeywell fan used-asking comparables and computed a $12–$20 range. The initial default-model attempts timed out cleanly; P2 now falls back to the configured `GROK_MODEL` unless `GROK_RESEARCH_MODEL` is set.
- The reviewed Atlas photo migration updated five untouched seed listings and inserted lamp, vacuum, and fan. Its dry run and apply output matched. The migration preserves availability, custom listings, bundles, and historical order snapshots.

P2 still has the deliberate product limits documented in the specification: no authentication, payment, messaging, scheduling, quantity requests, or inventory unreservation. Comparable prices are current web evidence, not verified transactions or appraisals. External provider results and availability can change.

## P2 navigation follow-up

- Results now use a search ID and a saved, validated request distinct from editable preferences. Entering or refreshing results regenerates current inventory; leaving the page discards late responses. Missing saved searches recover to the form, and failures offer a retry of the same request.
- Back to results traverses to the original history entry, including after swaps. Direct bundle links fall back to a fresh search from the stored bundle request. Confirmation still opens a durable receipt and waits for the user to choose the next action.
- Best condition sorting uses the precise average, retaining rounded display values and deterministic tie-breakers. The backend ranking regression now asserts ordering by actual listing averages.
- 75 backend tests pass (one optional Atlas test skipped), 22 frontend tests pass, and the production build passes. New frontend tests cover reload, history traversal, missing/disabled storage, retry after edits, late responses, and regeneration after returning from a receipt.
- Browser verification at 390 × 844 confirmed the results region receives focus and scrolls into view without horizontal overflow. A lamp bundle opened its confirmation dialog, canceled without reservation, and returned to the original results URL for regeneration.

### Detailed demo addresses

- Seven demo seed users now have verified public street addresses and matching Mapbox coordinates; see `docs/DEMO_ADDRESSES.md` for sources and migration commands.
- Applied the backed-up address-only migration to local `backend/data/persona-demo.json`; all seven `/me` profiles return their new addresses.
- Verified existing orders and bundle snapshots, account/upload records, and all inventory fields except location/revision are unchanged.
- Backend regression suite: 127 passed, 2 skipped. Migration coverage includes custom address preservation, revision updates, immutable snapshots, and idempotency.

- Follow-up: moved Taylor to CLP Homewood, 7101 Hamilton Avenue, Pittsburgh, PA 15208. All seven live demo profiles now use Pittsburgh addresses. Seed and address migration include this change; existing orders remain unchanged. Distance exclusion is covered using an isolated remote test fixture. Backend: 129 passed, 2 skipped.
