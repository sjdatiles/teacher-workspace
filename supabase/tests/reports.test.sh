#!/usr/bin/env bash
# Report tests: only Completed sessions count; filters; hours; isolation.
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"
sql() { q -c "$(as "$1") $2" | tail -1; }
d() { q -c "select (public.school_today() + ($1))::text;"; }

T1="{\"term_number\":1,\"start_date\":\"$(d -100)\",\"end_date\":\"$(d -30)\"}"
T2="{\"term_number\":2,\"start_date\":\"$(d -20)\",\"end_date\":\"$(d 80)\"}"
T3="{\"term_number\":3,\"start_date\":\"$(d 90)\",\"end_date\":\"$(d 200)\"}"
q -c "$(as $A) select public.save_academic_year(null,'Y1','$(d -110)','$(d 210)','[$T1,$T2,$T3]');" >/dev/null
YEAR=$(sql "$A" "select id from public.academic_years;")
q -c "$(as $A) insert into public.class_sections(user_id,academic_year_id,name,grade_level,population) values ('$A','$YEAR','Rose','Grade 7',35),('$A','$YEAR','Lily','Grade 7',40);" >/dev/null
ROSE=$(sql "$A" "select id from public.class_sections where name='Rose';")
LILY=$(sql "$A" "select id from public.class_sections where name='Lily';")
q -c "$(as $A) select public.save_subject(null,'$YEAR','Math','','Grade 7','',array['$ROSE','$LILY']::uuid[]);" >/dev/null
q -c "$(as $A) select public.save_subject(null,'$YEAR','Science','','Grade 7','',array['$ROSE','$LILY']::uuid[]);" >/dev/null
MATH=$(sql "$A" "select id from public.subjects where name='Math';")
SCI=$(sql "$A" "select id from public.subjects where name='Science';")

ins() { # subject section day status
  q -c "$(as $A) insert into public.teaching_sessions(user_id,academic_year_id,subject_id,section_id,origin,session_date,start_time,end_time,status) values ('$A','$YEAR','$1','$2','manual','$(d $3)','08:00','09:00','$4');" >/dev/null
}
rep() { sql "$A" "select coalesce(sum(sessions),0)||'/'||coalesce(sum(minutes),0)||'/'||coalesce(sum(students),0) from public.completed_session_report('$YEAR'$1);"; }
check() { if [ "$2" = "$3" ]; then echo "ok    $1"; else echo "FAIL  $1: got '$2', want '$3'"; FAILS=$((FAILS+1)); fi; }

check "no sessions: empty report" "$(rep "")" "0/0/0"

# Completed: 3 in Term 1, 1 in Term 2
ins $MATH $ROSE -60 completed; ins $MATH $ROSE -61 completed; ins $SCI $LILY -62 completed; ins $MATH $ROSE -10 completed
# Not completed: must never count
ins $MATH $ROSE 5 scheduled                       # future scheduled
ins $MATH $ROSE -9 scheduled                      # past, still scheduled
ins $SCI $ROSE -8 scheduled; ins $SCI $ROSE -7 scheduled
q -c "$(as $A) update public.teaching_sessions set status='cancelled' where session_date='$(d -8)';" >/dev/null
q -c "$(as $A) select public.reschedule_session((select id from public.teaching_sessions where session_date='$(d -7)'),'$(d 6)','10:00','11:00');" >/dev/null
check "setup: 4 completed, 5 others (incl. the replacement)" "$(sql "$A" "select (select count(*) from public.teaching_sessions where status='completed')||'/'||(select count(*) from public.teaching_sessions where status<>'completed');")" "4/5"
check "statuses present: scheduled, cancelled, rescheduled" "$(sql "$A" "select count(distinct status) from public.teaching_sessions;")" "4"

check "only completed counted (sessions/minutes/students)" "$(rep "")" "4/240/145"
check "term 1" "$(rep ",1")" "3/180/110"
check "term 2" "$(rep ",2")" "1/60/35"
check "term 3 has nothing" "$(rep ",3")" "0/0/0"
check "custom range covering all" "$(rep ",null,'$(d -100)','$(d 0)'")" "4/240/145"
check "custom range, one session" "$(rep ",null,'$(d -61)','$(d -61)'")" "1/60/35"
check "custom range excluding all" "$(rep ",null,'$(d 1)','$(d 50)'")" "0/0/0"
check "open-ended range (from only)" "$(rep ",null,'$(d -30)'")" "1/60/35"
check "subject filter Math" "$(rep ",null,null,null,'$MATH'")" "3/180/105"
check "subject filter Science" "$(rep ",null,null,null,'$SCI'")" "1/60/40"
check "section filter Lily" "$(rep ",null,null,null,null,'$LILY'")" "1/60/40"
check "subject + section + term" "$(rep ",1,null,null,'$MATH','$ROSE'")" "2/120/70"
check "grouped rows: term x subject x section" "$(sql "$A" "select count(*) from public.completed_session_report('$YEAR');")" "3"
check "term number reported" "$(sql "$A" "select string_agg(term_number::text, ',' order by term_number) from public.completed_session_report('$YEAR');")" "1,1,2"

# Actual duration drives hours
q -c "$(as $A) update public.teaching_sessions set actual_minutes=45 where session_date='$(d -60)';" >/dev/null
check "actual minutes (not scheduled) used for hours" "$(rep "")" "4/225/145"
# Students taught is a snapshot: later population changes don't rewrite history
q -c "$(as $A) update public.class_sections set population=50 where id='$ROSE';" >/dev/null
check "population change does not rewrite completed history" "$(rep "")" "4/225/145"

# Reopening / completing changes the report immediately
q -c "$(as $A) update public.teaching_sessions set status='scheduled' where session_date='$(d -10)';" >/dev/null
check "reopened session leaves the report" "$(rep "")" "3/165/110"
q -c "$(as $A) update public.teaching_sessions set status='completed' where session_date='$(d -9)';" >/dev/null
check "completing a past scheduled session adds it once" "$(rep "")" "4/225/160"
q -c "$(as $A) update public.teaching_sessions set status='completed' where session_date='$(d -9)';" >/dev/null
check "completing twice does not double count" "$(rep "")" "4/225/160"

# Other data never appears
q -c "$(as $A) insert into public.tasks(user_id,title,category,status) values ('$A','Done task','teaching','completed');
      insert into public.calendar_events(user_id,title,category,start_date,end_date) values ('$A','Meeting','meeting','$(d -5)','$(d -5)');" >/dev/null
check "completed tasks and events never count" "$(rep "")" "4/225/160"

# Isolation
check "B sees an empty report for A's year" "$(sql "$B" "select count(*) from public.completed_session_report('$YEAR');")" "0"
check "A still sees their report" "$(rep "")" "4/225/160"
out=$(q -c "set role anon; select count(*) from public.completed_session_report('$YEAR');")
if echo "$out" | grep -q "ERROR"; then echo "ok    anonymous visitors cannot run the report"; else echo "FAIL  anon report: $out"; FAILS=$((FAILS+1)); fi

echo; if [ $FAILS -eq 0 ]; then echo "ALL PASSED"; else echo "$FAILS FAILED"; exit 1; fi
