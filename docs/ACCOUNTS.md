# Demo users and orders

Open **Profile → Current user** to select Maya Chen, Jordan Brooks, Alex Rivera, Sam Patel, Riley Morgan, Jamie Park, or Taylor Reed. Each original seller is now a complete user who can buy, sell, and manage orders. Each user owns their corresponding original furniture; there is no separate seller-profile switcher.

Profile edits the current user's pickup and delivery settings. Sell furniture opens that user's inventory without the redundant name/account/settings panel. User selection persists per tab and switching clears stale searches.

Startup migration maps the former Avery/Casey/Morgan demo identities to Maya/Jordan/Riley for existing purchases, uploads, and custom records, and distributes the seven original selling profiles to their matching users. It preserves inventory and order statuses and is repeatable. Legacy identity headers remain aliases for compatibility.

This is an open demo, not secure authentication: anyone can select any persona. API requests use `Authorization: Bearer maya`, `demo-buyer-2`, or `demo-seller`; absent selection defaults to the first buyer. Unknown identities are rejected. Account ownership and order lifecycle checks still operate between personas.

For historical data, `scripts/demo_data.py --account-map backend/data/account-map.json` previews an explicit mapping; add `--apply` to back up and apply it. Use issuer `https://demo.snackoverflow.local/`, buyer_sub `maya`, and map each seed seller ID to the same user ID. The migration cancels only the four previously identified legacy orders, preserves snapshots, releases their inventory safely, and rejects conflicts. Full resets remain separate and remove custom catalog data and orders.

## Flows and status rules

Buyers use `/buyer/orders`, `/orders/{id}`, and `/orders/{id}/plan`. Viewing a delivery plan never switches into seller mode. Sellers use `/seller/{seller_id}/listings`, `/orders`, `/deliveries`, and `/profile`; seller order details use `/seller/{seller_id}/orders/{order_id}`.

| Status | Allowed actions |
| --- | --- |
| reserved | Buyer or participating seller cancels with a reason; assigned driver starts delivery, or buyer starts self-pickup |
| in_progress | Buyer confirms receipt/completes pickup |
| completed | Read-only history; furniture stays sold |
| cancelled | Read-only history; search again for a fresh reservation |

Cancellation is whole-bundle only, before fulfillment starts. Orders do not expire automatically. Generated bundle quotes still expire after 30 minutes. Repeating checkout for a cancelled bundle returns that cancelled order; it never silently reserves again.

Orders retain immutable bundle snapshots and status history. Listings track availability, state, revision, and reserving order ID. Cancellation releases only items held by the cancelled order. Completion verifies the hold and marks stock sold. Available/withdrawn listings can be edited; reserved/sold listings cannot. Changing a listing or pickup/vehicle details invalidates previously generated quotes. Active orders prevent changes to required pickup locations or driving capacity.

All management writes use a shared transaction path. Atlas serializes them through a coordination document to prevent checkout/logistics write skew. This bounded demo implementation reads application collections into memory; it is not a large-catalog production repository. Local mode uses one process, a lock, and an atomic JSON replacement with rollback on errors.

## API additions

Management calls carry the selected public demo identity in the Authorization header.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | /me | Account ID and owned seller profiles |
| GET | /orders | Current buyer's orders |
| GET | /sellers/{id}/orders | Orders involving an owned seller |
| GET | /sellers/{id}/deliveries | Owned seller's driving assignments |
| GET | /orders/{id}?seller_id={id} | Participant view; optional owned seller context |
| POST | /orders/{id}/cancel | `{ "reason": "…" }`, 1–1000 nonblank characters |
| POST | /orders/{id}/start | Start delivery or self-pickup |
| POST | /orders/{id}/complete | Buyer confirms receipt |
| PATCH | /listings/{id} | Editable ListingCreate fields except seller_id |
| POST | /listings/{id}/withdraw | Remove unreserved stock from searches |
| POST | /listings/{id}/publish | Republish available/withdrawn stock |
| PATCH | /sellers/{id} | Owned profile fields, guarded by active orders |

Order lists accept `status`, `limit` (default 20, maximum 100), and `offset`, returning `{items,total,limit,offset}` in descending creation-time/ID order. Order responses include `allowed_actions` and `viewer_role`. Ordinary sellers receive only their items and pickup details; buyers and assigned drivers can see the full route. The legacy `/deliveries/{id}` endpoint now enforces seller ownership.

Order mutation endpoints also accept optional `seller_id` to preserve the selected owned profile's permissions and response view. A non-driving seller cannot start delivery through that context, even when the account owns the driver profile too. The frontend uses the mutation response directly, discards older refresh responses, and keeps the last confirmed order visible if a later refresh temporarily fails. Seller profile drafts survive window-focus refreshes; **Discard profile changes** restores the latest loaded profile.

Unknown demo identities are 401, forbidden actions are 403, inaccessible private records are 404, invalid transitions/stale quotes are 409, and invalid input is 422. Lifecycle transitions are idempotent for authorized callers; status history is not duplicated. Pages refresh on entry and window focus; realtime push updates are not implemented.
