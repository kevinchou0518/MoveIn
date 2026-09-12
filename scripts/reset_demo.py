"""Compatibility entrypoint: reset only the default local demo, preserving accounts.

Stop the backend first. Prefer demo_data.py for previews or a configured Atlas store.
"""
import argparse
from pathlib import Path
import sys
from demo_data import main

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--confirm', action='store_true')
    args = parser.parse_args()
    if not args.confirm:
        parser.error('Stop the backend, then pass --confirm. Atlas is never modified by this entrypoint.')
    path = Path(__file__).resolve().parents[1] / 'backend/data/demo.json'
    sys.argv = ['demo_data.py', '--local', str(path), '--reset', '--apply']
    main()
