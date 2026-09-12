# SnackOverflow

An end-to-end hackathon demo for finding **fulfillable secondhand furniture bundles**. A buyer chooses categories, a furniture budget, a location, delivery or self-pickup, and a ranking preference. The app selects up to three bundles, assigns an eligible seller driver, and computes pickup routes. Sellers upload photos, publish editable listing details, and see delivery plans after a buyer reserves a bundle.

## Run locally

Requires Python **3.12–3.14**, Node **22.12+**, and npm. Verified here on Python 3.14 and Node 25. Dependencies require internet during initial setup.

```bash
./scripts/setup.sh
./scripts/dev.sh
```

Open [the app](http://localhost:5173) and [the API docs](http://localhost:8000/docs).

No keys are needed for the local demo. The first startup seeds 7 fictional sellers and 27 listings. Changes persist in `backend/data/demo.json`; photos persist in `backend/uploads/`. Use **one backend process** in local mode.

To start services separately:

```bash
# Terminal 1, repository root
.venv/bin/python -m uvicorn app.main:app --app-dir backend --port 8000

# Terminal 2
cd frontend
npm run dev
```

## Demo walkthrough

1. In **Find furniture**, keep TV, TV stand, desk, chair, $300, Oakland, and **Bring it to me**.
2. Click **Build my bundle**. Compare the three complete options. Furniture subtotal fits $300; delivery is extra and included in the displayed total.
3. Open **How these bundles were chosen** to see filtered listings, combination count, and enforced constraints.
4. **View bundle** opens a separate review page with the selected driver, capacity, all items, route order, distance, time, and fee. Use **Swap item** to replace one piece while keeping the others fixed.
5. **Choose this bundle** opens a confirmation dialog. Confirming reserves inventory and opens a durable reservation page; no payment occurs.
6. Click **Find another bundle** to search the current inventory again with the same preferences, or view the assigned seller's delivery plan.
7. Try **I’ll pick it up** for a buyer → sellers → buyer route. Buyer vehicle size is assumed sufficient for this MVP.
8. Try a $1 budget to demonstrate an explanatory no-results state.
9. In seller mode, upload a JPEG/PNG/WebP and publish a listing, or create a new seller profile with pickup and vehicle details. That inventory participates in subsequent optimization.

Reservations make listings unavailable. For repeated presentations, stop the backend and run:

```bash
python3 scripts/reset_demo.py --confirm
```

This backs up and resets only the local demo data. Restart the backend to seed again. It does not touch Atlas or uploaded images.

## Optional providers

Copy `.env.example` to `.env` in the repository root. Never commit real keys.

| Variable | Behavior |
| --- | --- |
| `MONGODB_URI` | Selects MongoDB Atlas persistence; empty uses local JSON. Configured connection failures are surfaced. Atlas must support transactions. |
| `MONGODB_DB` | Database name, default `snackoverflow`. |
| `MAPBOX_ACCESS_TOKEN` | Server-only token for Mapbox driving matrices and route geometry. |
| `VITE_MAPBOX_TOKEN` | Optional public, URL-restricted Mapbox token for interactive map tiles. It is intentionally browser-visible. |
| `VITE_API_URL` | Optional frontend API base for hosting separately; local Vite proxies `/api` to port 8000. |
| `GROK_API_KEY` | Server-only xAI inference key for optional photo analysis. |
| `GROK_MODEL` | xAI vision/structured-output model; default `grok-4.6`. Explicit overrides are preserved. |
| `GROK_RESEARCH_MODEL` | Optional model override for buyer-text parsing and web-backed price research; empty uses `GROK_MODEL`. |
| `DEMO_DATA_PATH` | Optional path to a separate local database, useful for smoke tests. |

Restart services after changing environment variables. Without Mapbox, routes use great-circle distance × 1.3 and 20 mph travel estimates. The visualization is explicitly a geographic schematic, **not road navigation**. Mapbox failures fall back to labeled estimates; an explicit unreachable-road result rejects that route. Live Mapbox matrices, road geometry, and map tiles were verified with the configured demo credentials. Atlas persistence and atomic checkout have been verified with the configured connection.

Grok image analysis is available: upload a photo, click **Analyze photo**, review the suggestions, select fields, and click **Apply selected suggestions**. All values remain editable. Blank fields are selected by default; existing values require explicit selection. Photo estimates remain distinct from **Research comparable prices**, which uses web search and renders only cited USD comparables. A range is offered only when at least three cited used asking prices are available, and applying it is explicit. Buyers may also parse a plain-language request, review each extracted field, and select a resolved address before searching. Manual forms work without AI. No authentication, payment, messaging, or scheduling is implemented.

## Optimization

1. Filter by a shared seller-created category catalog, availability/date, per-item price, and radius; cap at 30 candidates per category.
2. CP-SAT selects exactly one item per category, with integer-cent budget constraints. For delivery, exactly one represented seller must drive and fit the complete load. The seller driver is an eligibility witness; final driver choice happens during routing.
3. Exclude each chosen listing set and solve again for up to ten distinct bundles. Single solver worker, fixed random seed, deterministic work budget.
4. Independently verify eligible drivers. For each candidate/driver, OR-Tools Routing minimizes travel duration, starting at the driver’s own location and ending at the buyer. Self-pickup starts and ends at the buyer. Stops are grouped by seller.
5. Reward = $5 + $1 per route mile + $2 per additional seller stop. Rerank by Balanced, Lowest total cost, Best condition, or Fastest trip, then return three.

Selection score = `10 × mean condition − .08 × item dollars − 3 × seller count − .5 × sum of item-to-buyer miles`, with integer coefficient rounding. Final score subtracts `.35 × route minutes + .25 × delivery dollars`. These are hackathon heuristics, not a guarantee of global optimality. Self-pickup has no delivery fee. Travel duration excludes loading.

## Verify

```bash
.venv/bin/python -m pytest -q -c backend/pytest.ini backend/tests
cd frontend && npm test && npm run build
```

Tests cover both transportation modes, custom category persistence, all four deterministic rankings, unique/category coverage, exact budget and capacity boundaries, swap revalidation, cited price gating, AI failure handling, route order, uploads, durable confirmation/receipt behavior, expiration, and simultaneous overlapping reservations.

## Project map

- `docs/SPEC.md`: the user's authoritative brief, preserved verbatim.
- `docs/IMPLEMENTATION.md`: P0/P1/P2 plan, data models, REST contracts, seed requirements, decisions, critical path, and technical references.
- `backend/app/services/`: filtering, CP-SAT selection, driver feasibility, routing, and orchestration.
- `backend/app/db/store.py`: local persistence and Atlas adapter.
- `frontend/src/`: buyer flow, seller dashboard, and route visualization.
- `frontend/public/images/`: original, bundled SVG furniture illustrations; regenerated by `scripts/generate_assets.py`.

P1 includes Grok photo suggestions and an itemized driver reward display. P2 adds routed bundle review and confirmation, durable reservation pages, shared categories, ranking preferences, source-backed price research, natural-language input, item swaps, and supplied demo photos. See `docs/VERIFICATION.md` for actual validation and remaining limitations.

## Demo photos

Normalized demo images are included in `frontend/public/images/demo/`. Original files in `furniture-photos/` are kept locally and ignored by Git because they can contain GPS metadata. If you have the originals, run `.venv/bin/python scripts/prepare_demo_photos.py` to recreate the orientation-correct JPEG assets without copied EXIF metadata; a fresh checkout does not need this step. Existing databases are updated by `.venv/bin/python scripts/migrate_demo_photos.py --apply`; omit `--apply` for a dry run. The migration updates only unchanged seed IDs, adds three absent demo listings, and leaves custom inventory, availability, bundles, and order snapshots untouched.

## Address selection

Buyers and sellers can type a street address, neighborhood, or city, click **Search**, and select the matching address. Coordinates are resolved automatically. Editing the text clears the confirmed location; select a new result before continuing. Pittsburgh demo neighborhood shortcuts remain available without address search. Searches use server-side Mapbox Geocoding v6 with permanent results because locations are saved in profiles and orders; the Mapbox account must support permanent geocoding.

Atlas requires a database connection URI, not an Atlas management API key. The configured Atlas connection and isolated persistence/checkout tests now pass. The app runs with MongoDB; existing local JSON history remains on disk and is not automatically migrated.
