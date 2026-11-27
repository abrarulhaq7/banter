#!/usr/bin/env bash
# Sends the app's JavaScript to the installed builds over the air (EAS Update), through
# scripts/eas.sh, so it runs only as the personal Expo account.
#
#   npm run ota -- "Fix the wording on Results"                        # the preview build (the APK)
#   npm run ota -- --channel production "Fix the wording on Results"   # store builds, later
#
# A phone gets the update the next time Banter opens (downloaded in the background), and runs
# it from the launch after that.
#
# Only JavaScript, styles, images and texts travel this way. A change to native code (a library
# with native code, plugins or permissions in app.json, an Expo SDK upgrade) changes the
# runtime fingerprint: such an update reaches no installed build, and a new build is needed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CHANNEL=preview
if [[ "${1:-}" == "--channel" ]]; then
  CHANNEL="${2:-}"
  shift 2 || shift $#
fi
case "$CHANNEL" in
  preview | production) ;;
  *)
    echo "The channel is preview or production." >&2
    exit 2
    ;;
esac

MESSAGE="${*:-}"
if [[ -z "$MESSAGE" ]]; then
  echo 'Say what changed: npm run ota -- "Fix the wording on Results"' >&2
  exit 2
fi

# Nothing reaches a phone without passing the checks.
npm run check

# The EAS environment of the same name gives the Supabase address and key, as for the builds.
bash scripts/eas.sh update --channel "$CHANNEL" --environment "$CHANNEL" --message "$MESSAGE" --non-interactive
