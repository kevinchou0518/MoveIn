#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
(cd frontend && npm ci)
echo 'Ready. Run ./scripts/dev.sh, then open http://localhost:5173.'
