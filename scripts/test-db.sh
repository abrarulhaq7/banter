#!/usr/bin/env bash
# Applies the migrations to a throwaway local Postgres and runs supabase/tests/access_test.sql.
#
# The database lives in a temporary folder, listens only on a private socket, and is deleted
# when the script ends. It never touches the real Supabase project or any other database on
# this Mac. Needs the Postgres 17 programs (brew install postgresql@17) but not a running server.
#
# Usage: npm run test:db
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -n "${PG_BIN:-}" ]]; then
  BIN="$PG_BIN"
elif [[ -x /opt/homebrew/opt/postgresql@17/bin/initdb ]]; then
  BIN=/opt/homebrew/opt/postgresql@17/bin
elif command -v pg_config >/dev/null 2>&1; then
  BIN="$(pg_config --bindir)"
else
  echo "Postgres programs not found. Install with: brew install postgresql@17" >&2
  exit 1
fi

WORK="$(mktemp -d)"
PORT=54329

cleanup() {
  "$BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"$BIN/initdb" -D "$WORK/data" -U postgres --auth=trust --no-instructions >/dev/null
"$BIN/pg_ctl" -D "$WORK/data" -l "$WORK/server.log" -w \
  -o "-c listen_addresses='' -c unix_socket_directories='$WORK' -p $PORT" start >/dev/null

run() {
  "$BIN/psql" -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f "$1"
}

echo "Postgres $("$BIN/psql" -h "$WORK" -p "$PORT" -U postgres -d postgres -Atc 'show server_version')"

run "$ROOT/supabase/tests/00_supabase_stubs.sql"

# Apply the migrations the same way they reach the real project when pasted into the
# Supabase SQL editor: as the single generated file.
bash "$ROOT/scripts/bundle-migrations.sh"
echo "Applying $(ls "$ROOT"/supabase/migrations/*.sql | wc -l | tr -d ' ') migrations"
run "$ROOT/supabase/paste-into-sql-editor.sql"

echo "Running access tests"
OUTPUT="$(run "$ROOT/supabase/tests/access_test.sql" 2>&1)" || {
  echo "$OUTPUT" | grep -E "ok - |FAILED|ERROR" || echo "$OUTPUT"
  echo
  echo "Database tests FAILED"
  exit 1
}

# SHOW_REASONS=1 keeps the database's own error text for each refused statement.
if [[ -n "${SHOW_REASONS:-}" ]]; then
  echo "$OUTPUT" | grep -E "ok - " | sed -E 's/^psql:[^ ]+ NOTICE:  //'
else
  echo "$OUTPUT" | grep -E "ok - " | sed -E 's/^psql:[^ ]+ NOTICE:  //; s/ \[.*\]$//'
fi
echo
echo "Database tests passed: $(echo "$OUTPUT" | grep -c "ok - ") checks"
