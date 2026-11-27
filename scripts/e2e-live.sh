#!/usr/bin/env bash
# Runs the Maestro flows that need the real Supabase project (.maestro/live).
# Reads the project address and publishable key from .env.local and hands them to Maestro,
# because some flows plant test rows through the Supabase API. Also puts one sample
# screenshot into the simulator and passes the Gemini key from keys.local.json, both
# for the Generate flow.
#
# Usage: npm run e2e:live            (all live flows)
#        npm run e2e:live -- .maestro/live/keys-list.yaml
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env.local ]]; then
  echo "No .env.local. Copy .env.example to .env.local and fill it in first." >&2
  exit 2
fi
value() { grep -E "^$1=" .env.local | head -1 | cut -d= -f2- | tr -d '"'"'"; }
URL="$(value EXPO_PUBLIC_SUPABASE_URL)"
KEY="$(value EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY)"
if [[ -z "$URL" || -z "$KEY" ]]; then
  echo ".env.local is missing the Supabase address or publishable key." >&2
  exit 2
fi

# The Generate flow needs a real Gemini key and a photo in the simulator.
GEMINI_KEY=""
if [[ -f keys.local.json ]]; then
  GEMINI_KEY="$(python3 -c 'import json; print((json.load(open("keys.local.json")).get("gemini") or "").strip())')"
fi
LATEST="$(ls samples/*.{HEIC,heic,png,jpg,jpeg} 2>/dev/null | sed -n 2p || true)"
if [[ -n "$LATEST" ]]; then
  bash scripts/sim-photos.sh "$LATEST"
else
  echo "No samples/ images: the Generate flow will have no photo to use." >&2
fi

# The live flows run the app's code in production mode, as it ships, from a second server.
# In development mode the build's developer extras sometimes swallow the first tap on a
# screen (found on 2026-11-26: about one run in three failed that way, none in production
# mode). The dev server on 8081 is left alone.
PORT=8082
STARTED_SERVER=""
running() { curl -s -m 2 "localhost:$PORT/status" 2>/dev/null | grep -q running; }
if ! running; then
  echo "Starting a production-mode server on port $PORT. The first run builds the app's code, which takes a minute."
  mkdir -p .maestro/artifacts
  # --offline: no calls to Expo's web service, which a local test server does not need. When
  # that service had an outage (2026-11-27) the app could not load at all.
  npx expo start --dev-client --no-dev --minify --offline --port "$PORT" > .maestro/artifacts/live-server.log 2>&1 &
  STARTED_SERVER=1
  for _ in $(seq 1 90); do running && break; sleep 1; done
  if ! running; then
    echo "The server on port $PORT did not start. See .maestro/artifacts/live-server.log" >&2
    exit 2
  fi
fi
stop_server() {
  if [[ -n "$STARTED_SERVER" ]]; then
    lsof -ti "tcp:$PORT" 2>/dev/null | xargs kill 2>/dev/null || true
  fi
}
trap stop_server EXIT

source scripts/env.sh
# A Mac that falls asleep mid-run freezes the simulator and the run with it (seen on
# 2026-11-26). caffeinate keeps it awake for as long as the flows run. A closed lid still
# puts it to sleep.
AWAKE=""
command -v caffeinate >/dev/null 2>&1 && AWAKE="caffeinate -i"
$AWAKE maestro test --test-output-dir .maestro/artifacts \
  -e SUPABASE_URL="$URL" -e SUPABASE_KEY="$KEY" -e GEMINI_KEY="$GEMINI_KEY" -e METRO_PORT="$PORT" \
  "${@:-.maestro/live}"
