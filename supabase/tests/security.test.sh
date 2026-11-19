#!/usr/bin/env bash
# Whole-schema security checks, generated from the catalog so new tables cannot be forgotten:
# RLS on, policies present and scoped to the signed-in user, no public/anon function access,
# every foreign key has a covering index.
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"
chk() { # name, sql returning a count, expected
  out=$(q -c "$2" | tail -1); if [ "$out" = "$3" ]; then echo "ok    $1"; else echo "FAIL  $1: got '$out', want '$3'"; FAILS=$((FAILS+1)); fi; }

T="from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'"
chk "every public table has row-level security" "select count(*) $T and not c.relrowsecurity;" 0
chk "every public table has at least one policy" "select count(*) $T and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname);" 0
chk "every table except profiles carries user_id" "select count(*) $T and c.relname<>'profiles' and not exists (select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='user_id' and not a.attisdropped);" 0
chk "no policy is open to everyone (using true)" "select count(*) from pg_policies where schemaname='public' and (qual in ('true') or with_check in ('true'));" 0
chk "every policy mentions auth.uid()" "select count(*) from pg_policies where schemaname='public' and coalesce(qual,with_check,'') not like '%auth.uid()%';" 0
chk "no policy targets anon or public" "select count(*) from pg_policies where schemaname='public' and (roles::text like '%anon%' or roles::text like '%public%');" 0
F="from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'"
chk "no public function is executable by anon" "select count(*) $F and has_function_privilege('anon', p.oid, 'execute');" 0
chk "every function pins search_path" "select count(*) $F and not coalesce(p.proconfig::text,'') like '%search_path%';" 0
chk "only handle_new_user and delete_my_account are SECURITY DEFINER" "select count(*) $F and p.prosecdef and p.proname not in ('handle_new_user','delete_my_account');" 0
chk "every foreign key has a covering index" "select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where c.contype='f' and n.nspname='public' and not exists (select 1 from pg_index i where i.indrelid=c.conrelid and (i.indkey::int2[])[0:array_length(c.conkey,1)-1] = c.conkey);" 0

echo; if [ $FAILS -eq 0 ]; then echo "ALL PASSED"; else echo "$FAILS FAILED"; exit 1; fi
