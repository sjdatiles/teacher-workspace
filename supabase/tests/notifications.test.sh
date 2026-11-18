#!/usr/bin/env bash
# Notification state tests: read/dismiss, upsert, limits, isolation.
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"
sql() { q -c "$(as "$1") $2" | tail -1; }

K1="task-overdue:11111111-1111-4111-8111-111111111111"
K2="event:22222222-2222-4222-8222-222222222222:2026-11-20"
expect_ok    "mark read" "$A" "insert into public.notification_states(user_id,key,state) values ('$A','$K1','read');"
expect_ok    "mark another dismissed" "$A" "insert into public.notification_states(user_id,key,state) values ('$A','$K2','dismissed');"
expect_error "same key twice rejected" "$A" "insert into public.notification_states(user_id,key,state) values ('$A','$K1','read');"
expect_ok    "upsert read -> dismissed" "$A" "insert into public.notification_states(user_id,key,state) values ('$A','$K1','dismissed') on conflict (user_id,key) do update set state=excluded.state, updated_at=now();"
expect_value "state updated" "$A" "select state from public.notification_states where key='$K1';" "dismissed"
expect_value "two states stored" "$A" "select count(*) from public.notification_states;" "2"
expect_error "unknown state rejected" "$A" "insert into public.notification_states(user_id,key,state) values ('$A','x:y','unread');"
expect_error "key too short rejected" "$A" "insert into public.notification_states(user_id,key,state) values ('$A','ab','read');"
expect_error "key too long rejected" "$A" "insert into public.notification_states(user_id,key,state) values ('$A','$(printf 'x%.0s' $(seq 1 201))','read');"
expect_ok    "prune old states" "$A" "update public.notification_states set updated_at = now() - interval '100 days' where key='$K2'; delete from public.notification_states where updated_at < now() - interval '90 days';"
expect_value "old state pruned" "$A" "select count(*) from public.notification_states;" "1"

expect_value "B sees nothing" "$B" "select count(*) from public.notification_states;" "0"
expect_error "B cannot write as A" "$B" "insert into public.notification_states(user_id,key,state) values ('$A','spoof:1','read');"
expect_ok    "B stores the same key independently" "$B" "insert into public.notification_states(user_id,key,state) values ('$B','$K1','read');"
expect_value "B update of A's row hits 0 rows" "$B" "with u as (update public.notification_states set state='read' where user_id='$A' returning 1) select count(*) from u;" "0"
expect_value "B delete hits 0 rows" "$B" "with x as (delete from public.notification_states where user_id='$A' returning 1) select count(*) from x;" "0"
expect_value "A row untouched" "$A" "select state from public.notification_states where key='$K1';" "dismissed"
expect_error "A cannot move a row to B" "$A" "update public.notification_states set user_id='$B' where key='$K1';"
out=$(q -c "set role anon; select count(*) from public.notification_states;" | tail -1)
if echo "$out" | grep -q "ERROR\|^0$"; then echo "ok    anonymous visitors see nothing"; else echo "FAIL  anon: $out"; FAILS=$((FAILS+1)); fi

echo; if [ $FAILS -eq 0 ]; then echo "ALL PASSED"; else echo "$FAILS FAILED"; exit 1; fi
