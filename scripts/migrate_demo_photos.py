"""Idempotent photo migration. Dry-run by default; --apply writes only known demo IDs.

For local mode, stop the server first. Historical bundle/order snapshots are untouched.
"""
import argparse
import json
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
from app.demo_photos import PHOTO_LISTINGS, photo_fields
from app.seed import seed_data
from app.catalog import builtin_categories

def changes(existing):
    """Return guarded metadata updates and absent new demo listings."""
    _, seeds = seed_data()
    updates, additions = [], []
    for seed in seeds:
        if seed.id not in PHOTO_LISTINGS: continue
        current = existing.get(seed.id)
        old_title = PHOTO_LISTINGS[seed.id][1]
        if current is None and old_title is None:
            additions.append(seed.model_dump(mode='json'))
        elif current and old_title and current['title'] == old_title and current['image_url'] == f'/images/{seed.category}.svg':
            updates.append(({'id': seed.id, 'title': old_title, 'image_url': current['image_url']}, photo_fields(seed.id)))
    return updates, additions

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    load_dotenv(ROOT / '.env')
    uri = os.getenv('MONGODB_URI')
    if uri:
        from pymongo import MongoClient
        with MongoClient(uri, serverSelectionTimeoutMS=5000) as client:
            db = client[os.getenv('MONGODB_DB', 'movein')]
            updates, additions = changes({x['id']: x for x in db.listings.find({}, {'_id': 0})})
            if args.apply:
                for guard, patch in updates: db.listings.update_one(guard, {'$set': patch})
                for listing in additions: db.listings.update_one({'id': listing['id']}, {'$setOnInsert': listing}, upsert=True)
                for c in builtin_categories(): db.categories.update_one({'id': c['id']}, {'$setOnInsert': c}, upsert=True)
    else:
        path = Path(os.getenv('DEMO_DATA_PATH', ROOT / 'backend/data/demo.json'))
        if not path.exists():
            print('No local data yet. New stores automatically use the photo fixtures.'); return
        data = json.loads(path.read_text())
        updates, additions = changes(data['listings'])
        if args.apply:
            for guard, patch in updates: data['listings'][guard['id']].update(patch)
            for listing in additions: data['listings'].setdefault(listing['id'], listing)
            for c in builtin_categories(): data.setdefault('categories', {}).setdefault(c['id'], c)
            tmp = path.with_suffix('.migration.tmp'); tmp.write_text(json.dumps(data, indent=2)); tmp.replace(path)
    print(json.dumps({'applied': args.apply, 'updated_ids': [g['id'] for g, _ in updates], 'inserted_ids': [i['id'] for i in additions]}))

if __name__ == '__main__': main()
