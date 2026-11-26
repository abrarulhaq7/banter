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

source scripts/env.sh
exec maestro test --test-output-dir .maestro/artifacts \
  -e SUPABASE_URL="$URL" -e SUPABASE_KEY="$KEY" -e GEMINI_KEY="$GEMINI_KEY" \
  "${@:-.maestro/live}"
