> Current demo: Auth0 has been removed. Use the header persona selector for two buyers and one seller. Ownership and order lifecycle rules remain; no login configuration is needed. See [ACCOUNTS.md](ACCOUNTS.md). Earlier authentication notes below are historical.

You are the primary engineering agent for our hackathon project.

Your goal is to help us build a working end-to-end demo, not a production-complete marketplace.

Treat this document as the authoritative implementation specification. If any existing notes, brainstorming documents, or previous discussions conflict with this specification, THIS SPEC WINS.

# 1. Product

We are building an AI-assisted second-hand furniture marketplace that automatically creates feasible multi-seller furniture bundles and optimizes how those items are picked up and delivered.

The main problem:

A buyer who just moved into a new apartment may need several furniture items, such as:

* TV
* TV stand
* desk
* office chair

On a traditional marketplace, the buyer must search for each item separately, contact multiple sellers, and arrange multiple pickups.

Our system should instead:

Buyer requirements
→ find candidate listings
→ automatically generate feasible bundles
→ determine transportation feasibility
→ optimize pickup route
→ return the best bundle options

The core technical theme is constrained optimization.

The system should NOT simply recommend furniture.

It should generate a bundle that can actually be fulfilled.

# 2. Primary Buyer Flow

The buyer specifies:

* furniture categories they need
* budget
* buyer location
* whether they have a car

Example:

{
"categories": ["tv", "tv_stand", "desk", "chair"],
"budget": 300,
"buyer_has_car": false,
"buyer_location": {
"lat": 40.443,
"lng": -79.943
}
}

The system automatically generates feasible bundles.

Return the top 3 bundles.

Each bundle should include:

* selected listings
* sellers
* item subtotal
* condition score
* seller count
* transportation mode
* delivery lead if applicable
* route
* estimated travel distance
* estimated travel duration
* delivery reward / fee if applicable
* overall bundle score

The buyer then selects one bundle.

Do NOT make manual item-by-item cart building the primary user experience.

Individual listing browsing and filtering may exist as a secondary feature.

# 3. Seller Flow

A seller should be able to:

* upload a furniture photo
* enter/edit product title
* category
* description
* price
* condition
* pickup location
* availability / selling date
* whether they can drive
* vehicle type

If AI analysis is available, it can pre-fill:

* category
* condition
* visible damage
* suggested resale price

The seller must always be able to edit AI-generated fields.

If a seller is selected as the delivery lead, show:

* items to pick up
* pickup locations
* pickup order
* buyer destination
* estimated route
* travel time
* driver reward

# 4. Transportation Logic

There are two modes.

## Mode A — Seller-assisted delivery

If:

buyer_has_car == false

then the bundle is only feasible if at least one seller represented in the selected bundle can drive.

For the MVP:

* exactly one seller becomes the delivery lead
* the delivery lead must be a seller represented in the bundle
* the driver starts from their own pickup location
* the driver picks up the remaining bundle items
* the driver finishes at the buyer location

Example:

Seller B / driver
→ Seller A
→ Seller C
→ Buyer

A bundle with no available driver is INVALID when the buyer has no car.

## Mode B — Buyer self-pickup

If:

buyer_has_car == true

then no seller driver is required.

Route:

Buyer
→ Seller pickup locations
→ Buyer

The system should optimize the pickup order.

Do NOT build messaging, scheduling negotiation, or pickup coordination systems for the MVP.

# 5. Vehicle Capacity

Use a simple abstraction.

Item size:

small = 1
medium = 2
large = 3

Example vehicle capacities:

sedan = 4
suv = 7
truck = 12

For seller-assisted delivery:

total bundle size <= driver vehicle capacity

This should be treated as a hard feasibility constraint.

# 6. Bundle Optimization

Do NOT use an LLM to make final bundle decisions.

Bundle generation should be implemented as deterministic constrained optimization.

Preferred library:

Google OR-Tools CP-SAT.

AI can normalize or enrich input data, but the optimization engine decides the final bundle.

## Candidate Filtering

Before optimization, reduce the listing set using:

* requested category
* availability
* price
* approximate geographic relevance

## Hard Constraints

At minimum:

* all requested categories must be satisfied
* total item price <= buyer budget
* all selected listings must be available
* no listing may be selected more than once
* if buyer_has_car == false, at least one selected seller must be able to drive
* exactly one delivery lead for the MVP
* delivery lead must belong to the selected bundle
* vehicle capacity must be sufficient

## Objective

Use a simple weighted objective.

Possible factors:

* item condition
* preference match
* price attractiveness

- number of sellers
- approximate geographic spread

Do not over-engineer or train the weights.

Hardcoded weights are acceptable for the hackathon.

# 7. Bundle and Route Optimization Must Be Separate

Do NOT attempt to jointly optimize the complete bundle-selection and vehicle-routing problem in one giant model.

Use this pipeline:

Buyer Request
→ Candidate Filtering
→ Bundle Optimization
→ Top ~10 Candidate Bundles
→ Transportation Feasibility
→ Route Optimization
→ Calculate logistics cost
→ Re-rank
→ Return Top 3 Bundles

Bundle generation can initially use approximate geographic distance.

Only run full route optimization on the best candidate bundles.

This separation is an intentional hackathon engineering decision.

# 8. Route Optimization

Use deterministic routing algorithms, not an LLM.

Preferred implementation:

Google OR-Tools Routing.

Use a map provider for distance / travel-time matrices and visualization.

Preferred options:

* Google Maps / Routes API
  or
* Mapbox

The route optimizer should consider:

* seller locations
* buyer location
* pickup count
* travel distance
* travel duration
* transportation mode

# 9. Driver Reward

Do NOT implement real payment processing.

Use a simple formula such as:

driver_reward =
base_fee

* distance_fee
* pickup_stop_fee

Example:

base fee = $5
distance = 9 miles × $1
2 additional pickup stops × $2

driver reward = $18

Buyer UI may show:

Furniture: $215
Delivery: $18
Total: $233

Driver UI may show:

You earn: $18

No Stripe, escrow, or payment splitting is required.

# 10. AI Scope

AI supports the marketplace but does NOT control optimization.

Use Grok API for AI functionality.

Primary AI feature:

AI Listing Assistant.

Input may contain:

* furniture image
* product name
* brand
* model
* original purchase price
* purchase date
* seller description

AI structured output may contain:

{
"category": "office_chair",
"condition": "good",
"condition_score": 8.2,
"visible_issues": [
"minor scratch on armrest"
],
"estimated_product": "example product",
"suggested_price_min": 60,
"suggested_price_max": 85,
"confidence": 0.81
}

Seller can edit these values.

## AI Priority

MVP AI:

image
→ category
→ condition
→ visible damage
→ suggested resale price

Stretch feature:

product identification
→ web search
→ original retail price
→ comparable second-hand listings
→ improved resale valuation

Do NOT block the core application on web-based price research.

Natural-language buyer requirement parsing is also a stretch feature.

# 11. Tech Stack

Use:

Frontend:

* React
* TypeScript
* Vite
* Tailwind CSS
* shadcn/ui if useful

Backend:

* Python
* FastAPI

API:

* RESTful API

Database:

* MongoDB Atlas

AI:

* Grok API

Optimization:

* Google OR-Tools CP-SAT
* Google OR-Tools Routing

Maps:

* Google Maps / Routes API or Mapbox

Secrets:

* `.env`
* never hardcode API keys
* never commit secrets

Authentication:

* Auth0 is optional for the MVP
* authentication must not block the core demo

Container:

* Docker / Docker Compose may be added after the main end-to-end flow works
* do not prioritize containerization over product functionality

# 12. Suggested Backend Architecture

Keep the backend modular.

Suggested structure:

backend/
app/
main.py
api/
listings.py
bundles.py
deliveries.py
models/
schemas/
services/
listing_service.py
ai_service.py
candidate_filter.py
bundle_optimizer.py
driver_selector.py
route_optimizer.py
bundle_ranking.py
bundle_service.py
db/
core/

The main orchestration should conceptually be:

BundleService
→ CandidateFilter
→ BundleOptimizer
→ DriverSelector / Transportation Feasibility
→ RouteOptimizer
→ BundleRanking

Keep optimization logic isolated so it can be unit tested without the frontend or external APIs.

# 13. Minimum Data Model

At minimum support:

User / Seller

* id
* name
* location
* can_drive
* vehicle_type
* vehicle_capacity

Listing

* id
* seller_id
* title
* category
* description
* price
* condition_score
* item_size
* image_url
* location
* available
* available_date

Bundle

* id
* selected listings
* sellers
* item_total
* condition score
* transportation mode
* driver
* delivery fee
* route
* distance
* duration
* final score

Do not over-model the database during the hackathon.

# 14. Important API Endpoints

Prioritize:

POST /listings

GET /listings

POST /listings/analyze

POST /bundles/generate

POST /bundles/{id}/checkout

GET /deliveries/{seller_id}

The most important endpoint is:

POST /bundles/generate

Example input:

{
"categories": [
"tv",
"tv_stand",
"desk"
],
"budget": 300,
"buyer_has_car": false,
"buyer_location": {
"lat": 40.443,
"lng": -79.943
}
}

The endpoint should return the top feasible bundle options.

# 15. UI / UX

Reference the simplicity of applications such as Uber Eats.

There should be two clear modes:

Buyer Mode
Seller Mode

Users should be able to switch easily.

## Buyer Main Screen

Focus on:

"What do you need for your new place?"

Buyer selects furniture categories, budget, transportation mode, and submits:

Build My Bundle

Then show:

Top 3 optimized bundle cards.

Each card should make it immediately clear:

* what items are included
* total price
* average condition
* number of sellers
* delivery / pickup option
* route time
* route distance

Route visualization should appear on bundle details.

Do NOT prioritize a map-based marketplace browsing experience.

The map is most valuable for explaining route optimization.

## Seller Main Screen

Focus on:

Sell Furniture
→ Upload Photo
→ AI Analysis
→ Edit Listing
→ Delivery Settings
→ Publish

# 16. Hackathon Priority

## P0 — Must Work

Build these first:

1. seeded furniture / seller dataset
2. buyer requirement form
3. seller listings
4. candidate filtering
5. automatic bundle optimization
6. seller-driver feasibility
7. buyer self-pickup mode
8. vehicle capacity constraint
9. route optimization
10. top 3 bundle results
11. route visualization
12. end-to-end frontend/backend integration

A complete P0 demo is more important than all other features.

## P1 — After P0 Works

* AI furniture image analysis
* AI condition score
* AI visible damage detection
* AI suggested resale price
* driver reward UI
* basic Auth0 only if easy

## P2 — Stretch

* web search for comparable prices
* natural-language buyer request parsing
* swap an individual item inside a generated bundle
* improved ranking heuristics

# 17. Explicit Non-Goals

Do NOT spend meaningful hackathon time on:

* real payment processing
* Stripe integration
* escrow
* seller/buyer chat
* real-time GPS tracking
* multi-driver routing
* production-grade authentication
* complex roles and permissions
* dynamic pricing
* automated pickup scheduling negotiation
* prompt auto-optimization systems
* AR furniture placement
* 2D-to-3D room generation

AR / 3D furniture placement is future work only.

# 18. Engineering Principles

This is a hackathon.

Prefer:

working demo

> production completeness

simple deterministic architecture

> sophisticated architecture

seeded realistic data

> building data ingestion infrastructure

working optimization constraints

> theoretical optimization perfection

end-to-end flow

> isolated impressive features

If a feature does not materially improve the core demo, postpone it.

Avoid unnecessary abstractions and premature refactoring.

# 19. Initial Demo Scenario

Use a seeded scenario resembling:

Buyer needs:

* TV
* TV stand
* desk
* chair

Budget:

$300

Buyer:

no car

Marketplace:

multiple candidate listings across multiple sellers

Some sellers:

can_drive = false

At least one:

can_drive = true

The system should visibly demonstrate that:

1. multiple possible combinations exist
2. invalid combinations are rejected because of budget / driver / capacity constraints
3. the optimizer selects feasible bundles
4. a delivery lead is selected
5. pickup order is optimized
6. the top 3 bundles are returned
7. the route is shown visually

This scenario should remain stable enough for a live demo.

# 20. What You Should Do Now

Do NOT immediately generate the entire application blindly.

First:

1. inspect the current repository
2. identify what already exists
3. create or update `docs/SPEC.md` using this specification as the source of truth
4. propose a concise implementation plan divided into P0, P1, and P2
5. define the minimum data models
6. define the REST API contracts
7. define the seeded demo dataset requirements
8. identify the critical path for the end-to-end demo

Then begin implementing P0.

Start with the smallest vertical slice that proves the core system:

seeded listings
→ POST /bundles/generate
→ bundle optimizer
→ simple route calculation
→ return one valid result

After that works, expand it to:

Top 3 results
→ real routing
→ frontend integration

Do not implement P1 or P2 until the P0 end-to-end path works.

When making ambiguous implementation decisions, choose the option that maximizes the probability of delivering a stable hackathon demo.
# Approved account/order extension — September 12, 2026

The user subsequently authorized Auth0 login and account ownership, buyer order history and buyer-only delivery-plan navigation, seller inventory editing/withdrawal, and order cancellation/fulfillment. The lifecycle is reserved → in_progress → completed, or reserved → cancelled. Buyers or involved sellers may cancel before fulfillment starts; the driver starts delivery and the buyer confirms receipt. Buyers start/complete self-pickup. Explicitly mapped demo test accounts own seed sellers, and the four historical reservations migrate to the test buyer as cancelled without consuming available inventory. This extension supersedes conflicting authentication/persona/reservation-only limits in the original brief below. Detailed contracts and setup: [ACCOUNTS.md](ACCOUNTS.md).
