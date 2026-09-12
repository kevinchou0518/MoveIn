#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -x .venv/bin/python || ! -d frontend/node_modules ]]; then
  echo 'Dependencies are missing. Run ./scripts/setup.sh first.' >&2
  exit 1
fi
.venv/bin/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 &
backend_pid=$!
(cd frontend && exec node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort) &
frontend_pid=$!
cleanup() { kill "$backend_pid" "$frontend_pid" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
# Keep both services tied to this launcher; stop if either exits.
while kill -0 "$backend_pid" 2>/dev/null && kill -0 "$frontend_pid" 2>/dev/null; do sleep 1; done
