#!/usr/bin/env bash
# Runs the Maestro flows that need the real Supabase project (.maestro/live).
# Reads the project address and publishable key from .env.local and hands them to Maestro,
# because one flow plants test rows through the Supabase API.
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

source scripts/env.sh
exec maestro test --test-output-dir .maestro/artifacts \
  -e SUPABASE_URL="$URL" -e SUPABASE_KEY="$KEY" \
  "${@:-.maestro/live}"
