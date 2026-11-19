#!/usr/bin/env bash
# Account deletion: removes everything the teacher owns, only their own account, never anon.
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"
cnt() { q -c "select count(*) from $1 where $2 = '$3';" | tail -1; }

# Give A and B some data (academic year with three terms, a task, a resource folder).
for U in $A $B; do
  q -c "select set_config('request.jwt.claim.sub','$U',false);" >/dev/null
done
expect_ok "A creates a task" "$A" "insert into public.tasks(user_id,title,category) values ('$A','A task','teaching');"
expect_ok "B creates a task" "$B" "insert into public.tasks(user_id,title,category) values ('$B','B task','teaching');"
expect_ok "A stores a notification state" "$A" "insert into public.notification_states(user_id,key,state) values ('$A','k:1234','read');"

expect_error "anonymous cannot delete accounts" "$A" "reset role; set role anon; select public.delete_my_account();"
out=$(q -c "set role anon; select public.delete_my_account();"); if echo "$out" | grep -q "ERROR"; then echo "ok    anon refused"; else echo "FAIL  anon allowed: $out"; FAILS=$((FAILS+1)); fi
out=$(q -c "set role authenticated; reset request.jwt.claim.sub; select public.delete_my_account();"); if echo "$out" | grep -q "ERROR"; then echo "ok    signed-out token refused"; else echo "FAIL  no-uid allowed: $out"; FAILS=$((FAILS+1)); fi
expect_value "nothing deleted by refused calls" "$A" "select count(*) from public.tasks;" "1"

expect_ok "A deletes own account" "$A" "select public.delete_my_account();"
[ "$(cnt auth.users id $A)" = "0" ] && echo "ok    A's login is gone" || { echo "FAIL  A user remains"; FAILS=$((FAILS+1)); }
for t in "public.profiles id" "public.user_settings user_id" "public.tasks user_id" "public.notification_states user_id"; do
  set -- $t; [ "$(cnt $1 $2 $A)" = "0" ] && echo "ok    $1 rows removed" || { echo "FAIL  $1 still has rows"; FAILS=$((FAILS+1)); }
done
[ "$(cnt auth.users id $B)" = "1" ] && echo "ok    B's account untouched" || { echo "FAIL  B user missing"; FAILS=$((FAILS+1)); }
expect_value "B's data untouched" "$B" "select count(*) from public.tasks;" "1"

# --- full data set: classes, schedule, completed session, event, resources ---
d() { q -c "select (public.school_today() + ($1))::text;"; }
T1="{\"term_number\":1,\"start_date\":\"$(d -100)\",\"end_date\":\"$(d -30)\"}"
T2="{\"term_number\":2,\"start_date\":\"$(d -20)\",\"end_date\":\"$(d 80)\"}"
T3="{\"term_number\":3,\"start_date\":\"$(d 90)\",\"end_date\":\"$(d 200)\"}"
q -c "$(as $B) select public.save_academic_year(null,'Y1','$(d -110)','$(d 210)','[$T1,$T2,$T3]');" >/dev/null
YEAR=$(q -c "$(as $B) select id from public.academic_years;" | tail -1)
q -c "$(as $B) insert into public.class_sections(user_id,academic_year_id,name,grade_level,population) values ('$B','$YEAR','Rose','Grade 7',35);" >/dev/null
SEC=$(q -c "$(as $B) select id from public.class_sections;" | tail -1)
q -c "$(as $B) select public.save_subject(null,'$YEAR','Mathematics','','Grade 7','', array['$SEC']::uuid[]);" >/dev/null
SUB=$(q -c "$(as $B) select id from public.subjects;" | tail -1)
expect_ok "B schedule generates sessions" "$B" "select public.save_teaching_schedule(null,'$SUB','$SEC',1,'08:00','09:00','$(d -100)','$(d 200)',array[1,2,3]);"
expect_ok "B completes a session" "$B" "update public.teaching_sessions set status='completed' where id=(select id from public.teaching_sessions order by session_date limit 1);"
expect_ok "B event" "$B" "insert into public.calendar_events(user_id,title,category,start_date,end_date) values ('$B','Faculty day','school_activity','2026-12-01','2026-12-01');"
expect_ok "B folders" "$B" "select public.ensure_resource_categories();"
expect_ok "B link" "$B" "insert into public.resource_links(user_id,title,url) values ('$B','DepEd','https://teacher.deped.gov.ph');"
expect_ok "B no-class day" "$B" "select public.add_no_class_day('$YEAR','$(d 5)','$(d 5)','Holiday');"
expect_ok "B deletes account with completed sessions, schedules and classes" "$B" "select public.delete_my_account();"
LEFT=$(q -c "do \$\$ declare r record; n bigint; total bigint := 0; begin
  for r in select c.relname, exists(select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='user_id') has_uid from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname='public' and c.relkind='r' loop
    execute format('select count(*) from public.%I where %s = %L', r.relname, case when r.has_uid then 'user_id' else 'id' end, '$B') into n; total := total + n; end loop;
  raise notice 'LEFT=%', total; end \$\$;" 2>&1 | grep -o "LEFT=[0-9]*")
[ "$LEFT" = "LEFT=0" ] && echo "ok    no row of B remains in any public table" || { echo "FAIL  $LEFT"; FAILS=$((FAILS+1)); }

echo; if [ $FAILS -eq 0 ]; then echo "ALL PASSED"; else echo "$FAILS FAILED"; exit 1; fi
