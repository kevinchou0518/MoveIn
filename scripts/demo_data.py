"""Seed or reset a dedicated demo database. Stop the app before applying.

Default: preview only. --apply adds missing seeds and migrates known photo URLs.
--reset --apply replaces inventory and reservations, preserving accounts and upload ownership.
An on-disk backup is written before any existing database records are changed.
Uploaded files are never deleted. MongoDB reset uses a transaction.
"""
import argparse
from copy import deepcopy
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
from app.catalog import builtin_categories
from app.demo_photos import PHOTO_LISTINGS, install_demo_photos
from app.seed import seed_data

COLLECTIONS = ('sellers', 'listings', 'categories', 'bundles', 'orders', 'accounts', 'uploads')


def migrate_addresses(current):
    """Upgrade untouched neighborhood defaults, preserving custom addresses and receipts."""
    legacy = {
        'maya': (40.4512, -79.9321, 'Shadyside'),
        'jordan': (40.4318, -79.9222, 'Squirrel Hill'),
        'alex': (40.4601, -79.9514, 'Bloomfield'),
        'sam': (40.4438, -79.9581, 'Oakland'),
        'riley': (40.4691, -79.9612, 'Lawrenceville'),
        'jamie': (40.4482, -79.9405, 'Shadyside'),
        'distant': (41.50, -80.1, 'Outside demo area'),
    }
    data = deepcopy(current)
    seeds, _ = seed_data()
    for seed in seeds:
        seller = data.get('sellers', {}).get(seed.id)
        lat, lng, label = legacy[seed.id]
        old = {'lat': lat, 'lng': lng, 'label': label}
        previous = [old]
        if seed.id == 'distant':
            previous.append({'lat': 41.639778, 'lng': -80.149919,
                             'label': '848 North Main Street, Meadville, PA 16335'})
        if not seller or seller.get('location') not in previous:
            continue
        old = deepcopy(seller['location'])
        seller['location'] = seed.location.model_dump(mode='json')
        seller['revision'] = seller.get('revision', 0) + 1
        for item in data.get('listings', {}).values():
            if item.get('seller_id') == seed.id and item.get('location') == old:
                item['location'] = deepcopy(seller['location'])
                item['revision'] = item.get('revision', 0) + 1
                if item.get('id') == 'chair-far' and item.get('title') == 'Out-of-area chair':
                    item['title'] = 'Compact accent chair'
    return data


def prepare(current, reset=False):
    data = {name: {} for name in COLLECTIONS} if reset else deepcopy(current)
    sellers, listings = seed_data()
    seeds = {'sellers': [s.model_dump(mode='json') for s in sellers],
             'listings': [i.model_dump(mode='json') for i in listings],
             'categories': builtin_categories()}
    for name in COLLECTIONS:
        data.setdefault(name, {})
    for name, records in seeds.items():
        for record in records:
            data[name].setdefault(record['id'], record)
    if reset:
        for name in ('accounts', 'uploads'):
            data[name] = deepcopy(current.get(name, {}))
        for sid, seller in data['sellers'].items():
            seller['owner_id'] = current.get('sellers', {}).get(sid, {}).get('owner_id')
    for lid in PHOTO_LISTINGS:
        item = data['listings'][lid]
        if item.get('image_url') == f'/images/demo/{lid}.jpg':
            item['image_url'] = f'/uploads/demo/{lid}.jpg'
    return data


def backup(data):
    from bson import json_util
    path = ROOT / 'backend/data' / ('demo-backup-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.json')
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('x') as f:
        f.write(json_util.dumps(data, indent=2))
    print(f'Backup: {path}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--reset', action='store_true')
    parser.add_argument('--migrate-addresses', action='store_true', help='Only upgrade untouched legacy demo addresses; preserve orders and inventory status')
    parser.add_argument('--account-map', type=Path, help='JSON issuer, buyer_sub, and sellers {seller_id: demo subject} mapping')
    parser.add_argument('--local', type=Path, help='Use this local JSON file instead of configured MongoDB')
    args = parser.parse_args()
    if args.migrate_addresses and (args.reset or args.account_map):
        parser.error('Apply address migration separately from reset or account migration.')
    if args.reset and args.account_map:
        parser.error('Apply account migration separately from a full demo reset.')
    load_dotenv(ROOT / '.env')
    uri = None if args.local else os.getenv('MONGODB_URI')
    client = None
    try:
        if uri:
            from pymongo import MongoClient
            client = MongoClient(uri, serverSelectionTimeoutMS=10000)
            db = client[os.getenv('MONGODB_DB', 'movein')]
            current = {name: {r['id']: r for r in db[name].find({})} for name in COLLECTIONS}
            print(f'Target: MongoDB database {db.name}')
        else:
            path = args.local or Path(os.getenv('DEMO_DATA_PATH', ROOT / 'backend/data/demo.json'))
            current = json.loads(path.read_text()) if path.exists() else {}
            print(f'Target: local file {path}')
        desired = migrate_addresses(current) if args.migrate_addresses else prepare(current, args.reset)
        if args.account_map:
            from account_migration import assign_accounts
            mapping = json.loads(args.account_map.read_text())
            desired = assign_accounts(desired, mapping)
        print('Upgrade legacy demo addresses only' if args.migrate_addresses else 'RESET ALL app records (including custom listings and orders)' if args.reset else 'Add missing seeds and migrate demo photo URLs; preserve existing data')
        print(json.dumps({name: {'before': len(current.get(name, {})), 'after': len(desired[name])} for name in COLLECTIONS}))
        print(json.dumps({'changed_ids': {name: [rid for rid, record in desired[name].items() if record != current.get(name, {}).get(rid)] for name in COLLECTIONS}}))
        if not args.apply:
            print('Preview only. Stop the app, then repeat with --apply to write.')
            return
        if current:
            backup(current)
        if not args.migrate_addresses:
            install_demo_photos(ROOT / 'backend/uploads')
        if client:
            db.workflow_lock.update_one({'id': 'management'}, {'$setOnInsert': {'revision': 0}}, upsert=True)
            def write(session):
                db.workflow_lock.update_one({'id': 'management'}, {'$inc': {'revision': 1}}, session=session)
                observed = {name: {r['id']: r for r in db[name].find({}, session=session)} for name in COLLECTIONS}
                if observed != current:
                    raise ValueError('Database changed since preview/backup. Stop the app and rerun.')
                for name in COLLECTIONS:
                    if args.reset and name not in ('accounts', 'uploads'):
                        db[name].delete_many({}, session=session)
                    for rid, record in desired[name].items():
                        if args.reset or record != current.get(name, {}).get(rid):
                            db[name].replace_one({'id': rid}, record, upsert=True, session=session)
            with client.start_session() as session:
                session.with_transaction(write)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix('.seed.tmp')
            tmp.write_text(json.dumps(desired, indent=2))
            tmp.replace(path)
        print('Demo data and photos installed. Start the app.')
    finally:
        if client:
            client.close()


if __name__ == '__main__':
    main()
