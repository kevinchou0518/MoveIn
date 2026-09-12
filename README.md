# SnackOverflow

An end-to-end hackathon demo for finding **fulfillable secondhand furniture bundles**. A buyer chooses categories, a furniture budget, a location, and delivery or self-pickup. The app selects up to three bundles, assigns an eligible seller driver, and computes pickup routes. Sellers upload photos, publish editable listing details, and see delivery plans after a buyer reserves a bundle.

## Run locally

Requires Python **3.12–3.14**, Node **22.12+**, and npm. Verified here on Python 3.14 and Node 25. Dependencies require internet during initial setup.

```bash
./scripts/setup.sh
./scripts/dev.sh
```

Open [the app](http://localhost:5173) and [the API docs](http://localhost:8000/docs).

No keys are needed for the local demo. The first startup seeds 7 fictional sellers and 24 listings. Changes persist in `backend/data/demo.json`; photos persist in `backend/uploads/`. Use **one backend process** in local mode.

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
4. **View bundle** shows the selected driver, capacity, all items, route order, distance, time, and fee.
5. **Choose this bundle** reserves the inventory. No payment occurs.
6. Switch to **Sell furniture**, select the named delivery lead, and open **Delivery plans** to see pickups, buyer destination, and reward.
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
| `DEMO_DATA_PATH` | Optional path to a separate local database, useful for smoke tests. |

Restart services after changing environment variables. Without Mapbox, routes use great-circle distance × 1.3 and 20 mph travel estimates. The visualization is explicitly a geographic schematic, **not road navigation**. Mapbox failures fall back to labeled estimates; an explicit unreachable-road result rejects that route. Live Mapbox matrices, road geometry, and map tiles were verified with the configured demo credentials. Atlas remains unverified without a MongoDB URI.

Grok image analysis is **deferred to P1**. `POST /listings/analyze` returns 503 with an explanatory message. Manual seller publishing works without AI. No authentication, payment, messaging, or scheduling is implemented.

## Optimization

1. Filter by category, availability/date, per-item price, and radius; cap at 30 candidates per category.
2. CP-SAT selects exactly one item per category, with integer-cent budget constraints. For delivery, exactly one represented seller must drive and fit the complete load. The seller driver is an eligibility witness; final driver choice happens during routing.
3. Exclude each chosen listing set and solve again for up to ten distinct bundles. Single solver worker, fixed random seed, deterministic work budget.
4. Independently verify eligible drivers. For each candidate/driver, OR-Tools Routing minimizes travel duration, starting at the driver’s own location and ending at the buyer. Self-pickup starts and ends at the buyer. Stops are grouped by seller.
5. Reward = $5 + $1 per route mile + $2 per additional seller stop. Rerank and return three.

Selection score = `10 × mean condition − .08 × item dollars − 3 × seller count − .5 × sum of item-to-buyer miles`, with integer coefficient rounding. Final score subtracts `.35 × route minutes + .25 × delivery dollars`. These are hackathon heuristics, not a guarantee of global optimality. Self-pickup has no delivery fee. Travel duration excludes loading.

## Verify

```bash
.venv/bin/python -m pytest -q -c backend/pytest.ini backend/tests
cd frontend && npm run build
```

Tests cover both transportation modes, unique/category coverage, exact budget and capacity boundaries, selected-driver membership, availability filtering, deterministic ranking, route order, API validation, uploads, persistent checkout, expiration, and simultaneous overlapping reservations.

## Project map

- `docs/SPEC.md`: the user's authoritative brief, preserved verbatim.
- `docs/IMPLEMENTATION.md`: P0/P1/P2 plan, data models, REST contracts, seed requirements, decisions, critical path, and technical references.
- `backend/app/services/`: filtering, CP-SAT selection, driver feasibility, routing, and orchestration.
- `backend/app/db/store.py`: local persistence and Atlas adapter.
- `frontend/src/`: buyer flow, seller dashboard, and route visualization.
- `frontend/public/images/`: original, bundled SVG furniture illustrations; regenerated by `scripts/generate_assets.py`.

P0 is the focus. P1 adds Grok photo suggestions; P2 adds price research, natural-language input, and item swaps. See `docs/VERIFICATION.md` for actual validation and remaining limitations.
