#!/usr/bin/env bash
# Links Banter to your personal Expo account and gives its builds the Supabase address and
# publishable key, once, through scripts/eas.sh (never the work login on this Mac).
#
#   npm run eas:setup
#
# The two values are public by design (they ship inside the app), so they are stored as
# plaintext EAS variables. .env.local itself is never uploaded: it is in .gitignore.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 1. Make the EAS project under the personal account; this writes its id into app.json.
bash scripts/eas.sh init --force --non-interactive

# 2. The Supabase address and publishable key, for preview and production builds.
value() { grep -E "^$1=" .env.local | head -1 | cut -d= -f2- | tr -d '"'"'"; }
for name in EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY; do
  current="$(value "$name")"
  if [[ -z "$current" ]]; then
    echo ".env.local has no $name." >&2
    exit 2
  fi
  bash scripts/eas.sh env:set --name "$name" --value "$current" \
    --environment preview --environment production --visibility plaintext --non-interactive
done

echo "Done. Commit the project id that was added to app.json."
