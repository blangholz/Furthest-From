#!/usr/bin/env bash
# Runs the migrations and SQL tests on a local Postgres 16 + PostGIS + pgTAP.
# Usage: supabase/tests/run_local.sh   (needs a local server you can reach as postgres)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
db="${TEST_DB:-fff_test}"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -d postgres -c "drop database if exists $db with (force)" -c "create database $db"
sed "s/current_db_placeholder/$db/" "$here/shim.sql" | "${PSQL[@]}" -d "$db"
for f in "$here"/../migrations/*.sql; do
  echo "migrate $(basename "$f")"
  "${PSQL[@]}" -d "$db" -f "$f"
done
"${PSQL[@]}" -d "$db" -f "$here/fixtures.sql"
status=0
for t in "$here"/test_*.sql; do
  echo "test $(basename "$t")"
  out=$("${PSQL[@]}" -d "$db" -At -f "$t" 2>&1) || status=1
  echo "$out" | grep -E '^(not ok|# )' || true
  echo "$out" | grep -qE '^not ok|ERROR' && { echo "$out" | grep -E 'ERROR|not ok' ; status=1; }
  echo "$out" | grep -cE '^ok' | sed 's/^/  passed: /'
done
exit $status
