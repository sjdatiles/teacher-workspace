#!/usr/bin/env bash
# Task tests: allowed values, completion tracking, isolation.
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"

expect_ok    "create task with defaults" "$A" "insert into public.tasks(user_id,title,category) values ('$A','Prepare quiz','teaching');"
expect_value "defaults: To Do / Medium / no due date" "$A" "select status||'/'||priority||'/'||coalesce(due_date::text,'none') from public.tasks;" "todo/medium/none"
expect_ok    "create task with everything" "$A" "insert into public.tasks(user_id,title,description,category,status,priority,due_date,notes) values ('$A','Submit report','desc','administrative','in_progress','urgent','2026-12-01','n');"
for c in teaching administrative school_activities personal other; do
  expect_ok "category $c allowed" "$A" "insert into public.tasks(user_id,title,category) values ('$A','c $c','$c');"
done
for s in todo in_progress for_review; do
  expect_ok "status $s allowed" "$A" "insert into public.tasks(user_id,title,category,status) values ('$A','s $s','other','$s');"
done
for p in low medium high urgent; do
  expect_ok "priority $p allowed" "$A" "insert into public.tasks(user_id,title,category,priority) values ('$A','p $p','other','$p');"
done
expect_error "unknown category rejected" "$A" "insert into public.tasks(user_id,title,category) values ('$A','x','homework');"
expect_error "unknown status rejected" "$A" "insert into public.tasks(user_id,title,category,status) values ('$A','x','other','done');"
expect_error "unknown priority rejected" "$A" "insert into public.tasks(user_id,title,category,priority) values ('$A','x','other','critical');"
expect_error "empty title rejected" "$A" "insert into public.tasks(user_id,title,category) values ('$A','   ','other');"
expect_error "overlong title rejected" "$A" "insert into public.tasks(user_id,title,category) values ('$A','$(printf 'x%.0s' $(seq 1 161))','other');"

sql() { q -c "$(as "$1") $2" | tail -1; }
T=$(sql "$A" "select id from public.tasks where title='Prepare quiz';")
expect_value "not completed has no completed_at" "$A" "select completed_at is null from public.tasks where id='$T';" "t"
expect_ok    "complete a task" "$A" "update public.tasks set status='completed' where id='$T';"
expect_value "completed_at set by database" "$A" "select completed_at is not null from public.tasks where id='$T';" "t"
CA=$(q -c "$(as $A) select completed_at from public.tasks where id='$T';" | tail -1)
expect_ok    "edit a completed task keeps completed_at" "$A" "update public.tasks set notes='later' where id='$T';"
expect_value "completed_at unchanged" "$A" "select completed_at='$CA' from public.tasks where id='$T';" "t"
expect_ok    "reopen a task" "$A" "update public.tasks set status='in_progress' where id='$T';"
expect_value "reopened clears completed_at" "$A" "select completed_at is null from public.tasks where id='$T';" "t"
expect_ok    "insert directly as completed" "$A" "insert into public.tasks(user_id,title,category,status) values ('$A','Done','other','completed');"
expect_value "insert as completed gets completed_at" "$A" "select completed_at is not null from public.tasks where title='Done';" "t"
expect_ok    "delete a task" "$A" "delete from public.tasks where title='Done';"

# Tasks never touch teaching sessions (separate tables, nothing to count)
expect_value "teaching sessions unaffected by tasks" "$A" "select count(*) from public.teaching_sessions;" "0"

# isolation
expect_value "B sees no tasks" "$B" "select count(*) from public.tasks;" "0"
expect_error "B cannot insert a task as A" "$B" "insert into public.tasks(user_id,title,category) values ('$A','spoof','other');"
expect_value "B update hits 0 rows" "$B" "with u as (update public.tasks set title='x' returning 1) select count(*) from u;" "0"
expect_value "B delete hits 0 rows" "$B" "with d as (delete from public.tasks returning 1) select count(*) from d;" "0"
expect_error "B cannot move a task to B" "$A" "update public.tasks set user_id='$B' where id='$T';"
out=$(q -c "set role anon; select count(*) from public.tasks;" | tail -1)
if [ "$out" = "0" ]; then echo "ok    anonymous visitors see no tasks"; else echo "FAIL  anon: $out"; FAILS=$((FAILS+1)); fi

echo; if [ $FAILS -eq 0 ]; then echo "ALL PASSED"; else echo "$FAILS FAILED"; exit 1; fi
