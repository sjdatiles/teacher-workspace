#!/usr/bin/env bash
# Shared harness: starts a throw-away Postgres, applies ALL migrations in order, defines helpers.
# Source it from a *.test.sh script that sets HERE first.
# Runs the foundation migration against a throw-away local Postgres (no Supabase needed)
# and checks the three-term rules and row-level security.
#
# Requirements: PostgreSQL 14+ server binaries and psql on PATH, running as a non-root user.
#   ./supabase/tests/foundation.test.sh
# Exit code is non-zero if any expectation fails.
set -u
HERE="${HERE:-$(cd "$(dirname "$0")" && pwd)}"
D="$(mktemp -d)"; PORT=5544
PGBIN="$(dirname "$(command -v initdb || ls /usr/lib/postgresql/*/bin/initdb | tail -1)")"
cleanup() { "$PGBIN/pg_ctl" -D "$D/data" stop -m immediate >/dev/null 2>&1; rm -rf "$D"; }
trap cleanup EXIT

"$PGBIN/initdb" -D "$D/data" -A trust >/dev/null || exit 2
"$PGBIN/pg_ctl" -D "$D/data" -o "-p $PORT -k $D" -l "$D/log" start >/dev/null || exit 2
sleep 2
q() { psql -h "$D" -p $PORT -d postgres -q -At -v ON_ERROR_STOP=1 "$@" 2>&1; }

# Minimal stand-in for Supabase's auth schema and roles.
q <<'EOF' >/dev/null || exit 2
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema auth, public to authenticated, anon;
EOF
for f in "$HERE"/../migrations/*.sql; do q -f "$f" >/dev/null || { echo "MIGRATION FAILED: $f"; exit 1; }; done
A=00000000-0000-0000-0000-00000000000a; B=00000000-0000-0000-0000-00000000000b
q -c "grant select,insert,update,delete on all tables in schema public to authenticated;
      grant select on all tables in schema public to anon;
      insert into auth.users(id,raw_user_meta_data) values ('$A','{\"full_name\":\"A\"}'),('$B','{}');" >/dev/null

FAILS=0
as() { echo "set role authenticated; set request.jwt.claim.sub='$1';"; }
expect_ok()    { out=$(q -c "$(as "$2") $3"); if echo "$out" | grep -q "ERROR"; then echo "FAIL  $1: $out"; FAILS=$((FAILS+1)); else echo "ok    $1"; fi; }
expect_error() { out=$(q -c "$(as "$2") $3"); if echo "$out" | grep -q "ERROR"; then echo "ok    $1"; else echo "FAIL  $1 (no error): $out"; FAILS=$((FAILS+1)); fi; }
expect_value() { out=$(q -c "$(as "$2") $3" | tail -1); if [ "$out" = "$4" ]; then echo "ok    $1"; else echo "FAIL  $1: got '$out', want '$4'"; FAILS=$((FAILS+1)); fi; }

