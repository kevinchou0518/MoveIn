#!/bin/sh
set -eu
mkdir -p "${UPLOADS_DIR:-/data/uploads}"
exec uvicorn app.web:create_web_app --factory --app-dir backend --host 0.0.0.0 --port "${PORT:-8080}" --workers 1
