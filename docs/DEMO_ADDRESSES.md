# Demo pickup addresses

The seven fictional users use real public-place street addresses as demo pickup locations. These are illustrative locations, not residences or actual pickup arrangements. Coordinates were resolved with Mapbox permanent geocoding on 2026-09-12.

| User | Public location | Address |
| --- | --- | --- |
| Maya Chen | Apple Shadyside | 5436 Walnut Street, Pittsburgh, PA 15232 |
| Jordan Brooks | CLP Squirrel Hill | 5801 Forbes Avenue, Pittsburgh, PA 15217 |
| Alex Rivera | CLP LAMP | 4724 Baum Boulevard, Pittsburgh, PA 15213 |
| Sam Patel | CLP Main (Oakland) | 4400 Forbes Avenue, Pittsburgh, PA 15213 |
| Riley Morgan | CLP Lawrenceville | 279 Fisk Street, Pittsburgh, PA 15201 |
| Jamie Park | CLP East Liberty | 130 South Whitfield Street, Pittsburgh, PA 15206 |
| Taylor Reed | CLP Homewood | 7101 Hamilton Avenue, Pittsburgh, PA 15208 |

Address sources: [Apple Shadyside](https://www.apple.com/retail/shadyside/), [Carnegie Library locations](https://www.carnegielibrary.org/locations/). All seven users are within Pittsburgh; Taylor’s legacy internal ID remains `distant` to preserve ownership and history.

New seeds and resets include these addresses. To upgrade an existing demo database, stop the app, preview, then apply:

```sh
.venv/bin/python scripts/demo_data.py --local backend/data/persona-demo.json --migrate-addresses
.venv/bin/python scripts/demo_data.py --local backend/data/persona-demo.json --migrate-addresses --apply
```

Omit `--local ...` to target the configured MongoDB database instead. This is an explicit operator migration: it upgrades only original neighborhood defaults and Taylor’s previous Meadville demo address, backs up existing data before writing, increments seller/listing revisions, and preserves customized locations, availability, ownership, reservations, and existing order/bundle snapshots. Existing orders continue to show the pickup information agreed at checkout. Normal profile edits remain subject to active-order restrictions.
