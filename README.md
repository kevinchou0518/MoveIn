# MoveIn

An end-to-end hackathon demo for finding **fulfillable secondhand furniture bundles**. A buyer chooses categories, a furniture budget, a location, delivery or self-pickup, and a ranking preference. The app selects up to three bundles, assigns an eligible seller driver, and computes pickup routes. Sellers upload photos, publish editable listing details, and see delivery plans after a buyer reserves a bundle.

## Run locally

Requires Python **3.12–3.14**, Node **22.12+**, and npm. Verified here on Python 3.14 and Node 25. Dependencies require internet during initial setup.

```bash
./scripts/setup.sh
./scripts/dev.sh
```

Open [the app](http://localhost:5173) and [the API docs](http://localhost:8000/docs).

The app can start without provider keys and display the public buyer form. Choose a user in **Profile → Current user**; no login is required. See [demo accounts](docs/ACCOUNTS.md). The first startup seeds 7 fictional sellers and 27 listings. Without MongoDB, changes persist in `backend/data/demo.json`; photos persist in `backend/uploads/`. Use **one backend process** in local mode.

To start services separately:

```bash
# Terminal 1, repository root
.venv/bin/python -m uvicorn app.main:app --app-dir backend --port 8000

# Terminal 2
cd frontend
npm run dev
```

## Demo walkthrough

1. Select **Maya Chen** in **Profile → Current user**. In **Find furniture**, keep TV, TV stand, desk, chair, $300, Oakland, and **Bring it to me**.
2. Click **Build my bundle**. Compare the three complete options. Furniture subtotal fits $300; delivery is extra and included in the displayed total.
3. Open **How these bundles were chosen** to see filtered listings, combination count, and enforced constraints.
4. **View bundle** opens a separate review page with the selected driver, capacity, all items, route order, distance, time, and fee. Use **Swap item** to replace one piece while keeping the others fixed.
5. **Choose this bundle** opens a confirmation dialog. Confirming reserves inventory and opens a durable reservation page; no payment occurs.
6. **My orders** keeps your reservations and history. **View delivery plan** opens your buyer plan without entering seller mode. Cancel before fulfillment starts to release inventory, or confirm receipt after the driver starts delivery. **Find another bundle** searches current inventory with the same preferences.
7. Try **I’ll pick it up** for a buyer → sellers → buyer route. Buyer vehicle size is assumed sufficient for this MVP.
8. Try a $1 budget to demonstrate an explanatory no-results state.
9. Select **Riley Morgan** in **Profile → Current user**. Manage owned profiles, upload and publish furniture, edit or withdraw available listings, review orders containing your items, and start assigned deliveries. Buyers start and complete their own self-pickup orders.

Reservations make listings unavailable. Manage demo records with the script below. It uses the configured MongoDB database, or local JSON when MongoDB is unset. Stop the app before applying changes.

```bash
# Preview adding missing demo records and migrating old demo photo URLs
.venv/bin/python scripts/demo_data.py
.venv/bin/python scripts/demo_data.py --apply

# Preview a full reset, then apply only to a dedicated demo database
.venv/bin/python scripts/demo_data.py --reset
.venv/bin/python scripts/demo_data.py --reset --apply
```

Seed mode preserves existing listings and reservations. **Reset replaces records in sellers, listings, categories, bundles, and orders, including custom records.** Accounts, upload ownership, and ownership of seeded seller profiles are preserved. Both modes back up existing data under ignored `backend/data/` before writing; MongoDB changes use a transaction. Uploaded files are retained. Use `--local /path/to/demo.json` to explicitly target a local store instead of Atlas. Restart the app afterward.

## Optional providers

Copy `.env.example` to `.env` in the repository root. Never commit real keys.

| Variable | Behavior |
| --- | --- |
| `MONGODB_URI` | Selects MongoDB Atlas persistence; empty uses local JSON. Configured connection failures are surfaced. Atlas must support transactions. |
| `MONGODB_DB` | Database name, default `movein`. |
| `MAPBOX_ACCESS_TOKEN` | Server-only token for Mapbox driving matrices and route geometry. |
| `VITE_MAPBOX_TOKEN` | Optional public, URL-restricted Mapbox token for interactive map tiles. It is intentionally browser-visible. |
| `VITE_API_URL` | Optional frontend API base for hosting separately; local Vite proxies `/api` to port 8000. |
| `GROK_API_KEY` | Server-only xAI inference key for optional photo analysis. |
| `GROK_MODEL` | xAI vision/structured-output model; default `grok-4.6`. Explicit overrides are preserved. |
| `GROK_RESEARCH_MODEL` | Optional model override for buyer-text parsing and web-backed price research; empty uses `GROK_MODEL`. |
| `DEMO_DATA_PATH` | Optional path to a separate local database, useful for smoke tests. |

Restart services after changing environment variables. Without Mapbox, routes use great-circle distance × 1.3 and 20 mph travel estimates. The visualization is explicitly a geographic schematic, **not road navigation**. Every route view offers an **Open in Google Maps** link that hands the ordered stops (origin, pickups, destination) to Google Maps driving directions for real navigation; it needs no API key. Mapbox failures fall back to labeled estimates; an explicit unreachable-road result rejects that route. Live Mapbox matrices, road geometry, and map tiles were verified with the configured demo credentials. Atlas persistence and atomic checkout have been verified with the configured connection.

Grok image analysis is available: upload a photo and click **Analyze photo**. Available AI results fill listing fields automatically, including the price-range midpoint; there is no separate Apply step. Fields changed manually while analysis is pending are preserved. All values remain editable before publishing. The compact Analyze control uses a spinner and photo scan while processing, followed by a short completion status. Sellers can change their pickup address directly in the listing editor; it applies to their listings and existing active-order restrictions still apply. Photo estimates remain distinct from **Research comparable prices**, which uses web search and renders only cited USD comparables. A range is offered only when at least three cited used asking prices are available, and applying it is explicit. Buyers may also describe a plain-language request; extracted categories, budget, transportation, priority, and a geocoded location are filled into the form automatically and stay editable (if the address cannot be resolved, it only pre-fills the address search). Manual forms work without AI. Public demo personas separate account data; there is no secure login. Payment, messaging, and scheduling are not implemented.

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

Normalized demo source images are committed in `backend/fixtures/photos/`. The demo-data script copies them into `backend/uploads/demo/` and stores `/uploads/demo/<listing-id>.jpg` in each photo listing's `image_url`. Backend startup also installs these files so fresh automatic seeds work. React renders the URL returned by the listings API; it does not import the demo photos from its public folder. Older order snapshots remain readable through a backend `/images/demo/` compatibility route.

User uploads follow `POST /uploads`: the backend validates JPEG/PNG/WebP files (up to 8 MB), corrects orientation, resizes to at most 1600 pixels, and writes a JPEG under `backend/uploads/<uuid>.jpg`. MongoDB stores the URL and listing metadata, **not image bytes**. FastAPI serves the files, and Vite proxies `/uploads` during development. A hosted setup must route `/uploads` and legacy `/images/demo` to the backend and persist the uploads directory; MongoDB backups alone do not include photos. Cloud object storage is not implemented.

Original files in `furniture-photos/` remain local because they can contain GPS metadata. With the originals, run `.venv/bin/python scripts/prepare_demo_photos.py` to regenerate the sanitized backend fixtures, then run the demo-data script to install them. A fresh checkout already includes the sanitized sources.

## Address selection

Buyers and sellers can type a street address, neighborhood, or city, click **Search**, and select the matching address. Coordinates are resolved automatically. Editing the text clears the confirmed location; select a new result before continuing. Pittsburgh demo neighborhood shortcuts remain available without address search. Searches use server-side Mapbox Geocoding v6 with permanent results because locations are saved in profiles and orders; the Mapbox account must support permanent geocoding.

Atlas requires a database connection URI, not an Atlas management API key. The configured Atlas connection and isolated persistence/checkout tests now pass. The app runs with MongoDB; existing local JSON history remains on disk and is not automatically migrated.
