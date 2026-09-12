"""Reset only the local demo database. Stop the backend before running this script."""
from pathlib import Path
import argparse
import shutil
from datetime import datetime

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--confirm', action='store_true', help='Reset local listings/reservations after making a backup')
args = parser.parse_args()
path = Path(__file__).resolve().parents[1]/'backend/data/demo.json'
if not args.confirm:
    parser.error('Stop the backend, then pass --confirm to reset local demo inventory. Atlas is never modified.')
if path.exists():
    backup = path.with_name(f'demo.backup-{datetime.now():%Y%m%d-%H%M%S}.json')
    shutil.copy2(path, backup)
    path.unlink()
    print(f'Local demo reset. Backup: {backup}. Fresh seeds will load on backend startup.')
else:
    print('No local database exists. Fresh seeds will load on backend startup.')
