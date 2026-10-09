#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY
[ -d "$ROOT/backend/.venv" ] || { python3 -m venv "$ROOT/backend/.venv" && "$ROOT/backend/.venv/bin/pip" install -r "$ROOT/backend/requirements.txt"; }
[ -d "$ROOT/frontend/node_modules" ] || (cd "$ROOT/frontend" && npm install)
pids=()
cleanup() {
    local pid
    for pid in "${pids[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
    wait || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
(cd "$ROOT/backend" && exec .venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000) &
pids+=("$!")
(cd "$ROOT/frontend" && exec npm run dev -- --host 127.0.0.1 --strictPort) &
pids+=("$!")
wait
