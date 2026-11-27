#!/usr/bin/env bash
# Runs EAS CLI for Banter with the personal Expo account, and never with any other.
#
# This Mac is also signed in to Expo for work. Banter must never use that login: builds,
# projects and settings would land in the company's account. So this wrapper
#   - passes the personal token from expo-token.local (not in git) as EXPO_TOKEN,
#   - runs EAS with its own empty settings folder (.expo-home, not in git), so the work
#     login on this Mac is not even read,
#   - stops if the token turns out to belong to the login this Mac uses for work.
#
#   npm run eas -- whoami
#   npm run eas -- build -p android --profile preview
#
# Never run `eas` or `npx eas-cli` directly in this project.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TOKEN_FILE="$ROOT/expo-token.local"
if [[ ! -s "$TOKEN_FILE" ]]; then
  cat >&2 <<'EOF'
No expo-token.local.
Sign in to your PERSONAL Expo account at https://expo.dev, make an access token at
https://expo.dev/settings/access-tokens, and put it alone in expo-token.local in this folder.
EOF
  exit 2
fi
EXPO_TOKEN="$(tr -d '[:space:]' < "$TOKEN_FILE")"
export EXPO_TOKEN
export __UNSAFE_EXPO_HOME_DIRECTORY="$ROOT/.expo-home"
mkdir -p "$__UNSAFE_EXPO_HOME_DIRECTORY"

EAS=(npx --yes eas-cli@latest)

# Who the token belongs to. `whoami` prints the username on its first line.
if ! WHO="$("${EAS[@]}" whoami 2>&1)"; then
  echo "Expo did not accept the token in expo-token.local:" >&2
  echo "$WHO" >&2
  exit 2
fi
ME="$(printf '%s\n' "$WHO" | head -1 | sed -E 's/^[^A-Za-z0-9_.-]+//; s/[[:space:]].*$//')"

# The login this Mac uses outside this project (read from its own file, never printed).
WORK_USER="$(node -e '
  try {
    const state = require(require("os").homedir() + "/.expo/state.json");
    console.log((state.auth && state.auth.username) || "");
  } catch { console.log(""); }
')"
if [[ -z "$ME" || ( -n "$WORK_USER" && "$ME" == "$WORK_USER" ) ]]; then
  echo "This token belongs to the Expo login this Mac uses for work. Use a token from your personal account." >&2
  exit 2
fi

echo "EAS as: $ME" >&2
if [[ "${1:-}" == "whoami" ]]; then
  printf '%s\n' "$WHO"
  exit 0
fi
# A new project is made under the personal account, said out loud.
if [[ "${1:-}" == "init" && " $* " != *" --account "* ]]; then
  set -- "$@" --account "$ME"
fi
exec "${EAS[@]}" "$@"
