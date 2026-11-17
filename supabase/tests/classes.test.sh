#!/usr/bin/env bash
# My Classes tests: subjects, sections, schedules, session generation, status rules, reports counting,
# rescheduling, history protection and isolation between teachers.
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"

d() { q -c "select (public.school_today() + ($1))::text;"; }   # date relative to today
T1="{\"term_number\":1,\"start_date\":\"$(d -100)\",\"end_date\":\"$(d -30)\"}"
T2="{\"term_number\":2,\"start_date\":\"$(d -20)\",\"end_date\":\"$(d 80)\"}"
T3="{\"term_number\":3,\"start_date\":\"$(d 90)\",\"end_date\":\"$(d 200)\"}"
YS=$(d -110); YE=$(d 210)
q -c "$(as $A) select public.save_academic_year(null,'Y1','$YS','$YE','[$T1,$T2,$T3]');" >/dev/null
YEAR=$(q -c "$(as $A) select id from public.academic_years;" | tail -1)
sql() { q -c "$(as "$1") $2" | tail -1; }   # run and return last line

# --- subjects & sections ---
expect_ok    "create section"        "$A" "insert into public.class_sections(user_id,academic_year_id,name,grade_level,population) values ('$A','$YEAR','Sampaguita','Grade 7',40);"
SEC=$(sql "$A" "select id from public.class_sections;")
expect_ok    "create 2nd section"    "$A" "insert into public.class_sections(user_id,academic_year_id,name,grade_level,population) values ('$A','$YEAR','Rose','Grade 7',35);"
SEC2=$(sql "$A" "select id from public.class_sections where name='Rose';")
expect_error "duplicate section name+grade rejected" "$A" "insert into public.class_sections(user_id,academic_year_id,name,grade_level,population) values ('$A','$YEAR','  sampaguita ','Grade 7',10);"
expect_error "population over 200 rejected"  "$A" "insert into public.class_sections(user_id,academic_year_id,name,grade_level,population) values ('$A','$YEAR','Big','Grade 7',201);"
expect_error "negative population rejected"  "$A" "insert into public.class_sections(user_id,academic_year_id,name,grade_level,population) values ('$A','$YEAR','Neg','Grade 7',-1);"
expect_error "invalid grade level rejected"  "$A" "insert into public.class_sections(user_id,academic_year_id,name,grade_level,population) values ('$A','$YEAR','G','Grade 13',1);"
expect_ok    "save subject with section" "$A" "select public.save_subject(null,'$YEAR','Mathematics','MATH7','Grade 7','', array['$SEC']::uuid[]);"
SUB=$(sql "$A" "select id from public.subjects;")
expect_value "assignment created" "$A" "select count(*) from public.subject_sections;" "1"
expect_error "duplicate subject rejected" "$A" "select public.save_subject(null,'$YEAR','mathematics','','Grade 7','',array[]::uuid[]);"
expect_ok    "edit subject adds 2nd section" "$A" "select public.save_subject('$SUB','$YEAR','Mathematics','MATH7','Grade 7','',array['$SEC','$SEC2']::uuid[]);"
expect_value "two assignments" "$A" "select count(*) from public.subject_sections;" "2"

# --- schedule generation ---
MON=1
EXPECTED=$(q -c "select count(*) from generate_series('$(d -100)'::date,'$(d 200)'::date,interval '1 day') g
  where extract(isodow from g)=$MON and (g::date between '$(d -100)' and '$(d -30)' or g::date between '$(d -20)' and '$(d 80)' or g::date between '$(d 90)' and '$(d 200)');")
expect_ok    "save schedule (all terms)" "$A" "select public.save_teaching_schedule(null,'$SUB','$SEC',$MON,'08:00','09:00','$(d -100)','$(d 200)',array[1,2,3]);"
SCH=$(sql "$A" "select id from public.teaching_schedules;")
expect_value "generated Mondays inside terms only" "$A" "select count(*) from public.teaching_sessions;" "$EXPECTED"
expect_value "all generated rows are Scheduled (past too)" "$A" "select count(*) from public.teaching_sessions where status<>'scheduled';" "0"
expect_value "generation is idempotent" "$A" "select public.generate_sessions_for_schedule('$SCH');" "0"
expect_value "every session has a term" "$A" "select count(*) from public.teaching_sessions where term_id is null;" "0"
expect_error "end before start rejected" "$A" "select public.save_teaching_schedule(null,'$SUB','$SEC',2,'10:00','09:00','$(d -100)','$(d 200)',array[1,2,3]);"
expect_error "bad day rejected"          "$A" "select public.save_teaching_schedule(null,'$SUB','$SEC',9,'08:00','09:00','$(d -100)','$(d 200)',array[1,2,3]);"
expect_error "unassigned pair rejected"  "$A" "select public.save_teaching_schedule(null,'$SUB','$SEC',2,'08:00','09:00','$(d -100)','$(d 200)',array[4]);"
expect_error "schedule outside year rejected" "$A" "select public.save_teaching_schedule(null,'$SUB','$SEC',2,'08:00','09:00','$(d -300)','$(d 200)',array[1]);"

# --- completing ---
PAST=$(sql "$A" "select id from public.teaching_sessions where session_date < public.school_today() order by session_date limit 1;")
FUT=$(sql "$A" "select id from public.teaching_sessions where session_date > public.school_today() order by session_date limit 1;")
expect_ok    "complete a past session" "$A" "update public.teaching_sessions set status='completed' where id='$PAST';"
expect_value "actual minutes default to scheduled" "$A" "select actual_minutes from public.teaching_sessions where id='$PAST';" "60"
expect_value "population snapshot taken" "$A" "select population_at_completion from public.teaching_sessions where id='$PAST';" "40"
expect_ok    "population change later" "$A" "update public.class_sections set population=44 where id='$SEC';"
expect_value "snapshot is unchanged" "$A" "select population_at_completion from public.teaching_sessions where id='$PAST';" "40"
expect_error "future session cannot be completed" "$A" "update public.teaching_sessions set status='completed' where id='$FUT';"
expect_error "completed session cannot be moved"  "$A" "update public.teaching_sessions set session_date=session_date+1 where id='$PAST';"
expect_ok    "edit actual minutes" "$A" "update public.teaching_sessions set actual_minutes=45 where id='$PAST';"
expect_value "only completed counted: sessions" "$A" "select count(*) from public.teaching_sessions where status='completed';" "1"
expect_value "only completed counted: minutes"  "$A" "select coalesce(sum(actual_minutes),0) from public.teaching_sessions where status='completed';" "45"
expect_error "completed session cannot be rescheduled" "$A" "select public.reschedule_session('$PAST','$(d 3)','08:00','09:00');"

# --- cancel / reopen ---
CAN=$(sql "$A" "select id from public.teaching_sessions where session_date > public.school_today() order by session_date limit 1 offset 1;")
expect_ok    "cancel a session" "$A" "update public.teaching_sessions set status='cancelled' where id='$CAN';"
expect_value "cancelled has no actual minutes" "$A" "select coalesce(actual_minutes,0) from public.teaching_sessions where id='$CAN';" "0"
expect_ok    "reopen cancelled" "$A" "update public.teaching_sessions set status='scheduled' where id='$CAN';"
expect_error "scheduled cannot jump insert as cancelled" "$A" "insert into public.teaching_sessions(user_id,academic_year_id,subject_id,section_id,origin,session_date,start_time,end_time,status) values ('$A','$YEAR','$SUB','$SEC','manual','$(d 2)','10:00','11:00','cancelled');"

# --- reschedule ---
RS=$(sql "$A" "select id from public.teaching_sessions where session_date > public.school_today() and status='scheduled' order by session_date limit 1 offset 2;")
NEWDATE=$(d 3)
expect_ok    "reschedule creates replacement" "$A" "select public.reschedule_session('$RS','$NEWDATE','13:00','14:00');"
expect_value "original is Rescheduled" "$A" "select status from public.teaching_sessions where id='$RS';" "rescheduled"
expect_value "replacement is Scheduled + linked" "$A" "select status||'/'||origin from public.teaching_sessions where rescheduled_from_id='$RS';" "scheduled/rescheduled"
expect_error "second reschedule of same original rejected" "$A" "select public.reschedule_session('$RS','$(d 4)','13:00','14:00');"
expect_error "reschedule into a gap between terms rejected" "$A" "select public.reschedule_session('$(sql "$A" "select id from public.teaching_sessions where status='scheduled' and session_date>public.school_today() order by session_date desc limit 1;")','$(d 85)','08:00','09:00');"
expect_ok    "undo reschedule" "$A" "select public.undo_reschedule('$RS');"
expect_value "original back to Scheduled" "$A" "select status from public.teaching_sessions where id='$RS';" "scheduled"
expect_value "replacement removed" "$A" "select count(*) from public.teaching_sessions where rescheduled_from_id='$RS';" "0"
expect_value "rescheduled/cancelled/scheduled never counted" "$A" "select count(*) from public.teaching_sessions where status='completed';" "1"

# --- manual sessions ---
expect_ok    "manual session (assigned pair)" "$A" "insert into public.teaching_sessions(user_id,academic_year_id,subject_id,section_id,origin,session_date,start_time,end_time) values ('$A','$YEAR','$SUB','$SEC2','manual','$(d -5)','15:00','16:00');"
expect_error "manual session outside all terms rejected" "$A" "insert into public.teaching_sessions(user_id,academic_year_id,subject_id,section_id,origin,session_date,start_time,end_time) values ('$A','$YEAR','$SUB','$SEC2','manual','$(d 85)','15:00','16:00');"
expect_ok    "manual session may start Completed" "$A" "insert into public.teaching_sessions(user_id,academic_year_id,subject_id,section_id,origin,session_date,start_time,end_time,status) values ('$A','$YEAR','$SUB','$SEC2','manual','$(d -6)','15:00','16:00','completed');"
expect_value "manual completed snapshot uses its section" "$A" "select population_at_completion from public.teaching_sessions where session_date='$(d -6)' and section_id='$SEC2';" "35"

# --- no-class days ---
NCD_DATE=$(sql "$A" "select session_date from public.teaching_sessions where schedule_id='$SCH' and status='scheduled' and session_date>public.school_today() order by session_date limit 1 offset 3;")
BEFORE=$(sql "$A" "select count(*) from public.teaching_sessions where schedule_id='$SCH';")
expect_ok    "add no-class day" "$A" "select public.add_no_class_day('$YEAR','$NCD_DATE','$NCD_DATE','Holiday');"
expect_value "session on that day removed" "$A" "select count(*) from public.teaching_sessions where schedule_id='$SCH' and session_date='$NCD_DATE';" "0"
NCD=$(sql "$A" "select id from public.no_class_days;")
expect_ok    "remove no-class day" "$A" "select public.remove_no_class_day('$NCD');"
expect_value "session restored" "$A" "select count(*) from public.teaching_sessions where schedule_id='$SCH';" "$BEFORE"

# --- editing a schedule keeps history ---
expect_ok    "edit schedule time" "$A" "select public.save_teaching_schedule('$SCH','$SUB','$SEC',$MON,'09:00','10:00','$(d -100)','$(d 200)',array[1,2,3]);"
expect_value "completed past session untouched" "$A" "select start_time||'/'||actual_minutes from public.teaching_sessions where id='$PAST';" "08:00:00/45"
expect_value "future sessions moved to new time" "$A" "select count(*) from public.teaching_sessions where schedule_id='$SCH' and status='scheduled' and session_date>public.school_today() and start_time<>'09:00';" "0"

# --- deleting a schedule keeps completed history ---
expect_ok    "delete schedule" "$A" "select public.delete_teaching_schedule('$SCH');"
expect_value "completed session kept" "$A" "select count(*) from public.teaching_sessions where id='$PAST' and schedule_id is null;" "1"
expect_value "no scheduled generated sessions left" "$A" "select count(*) from public.teaching_sessions where origin='generated' and status='scheduled';" "0"

# --- guarded deletes ---
expect_error "delete subject with completed sessions blocked" "$A" "select public.delete_subject('$SUB');"
expect_error "delete section with completed sessions blocked" "$A" "select public.delete_section('$SEC2');"
expect_ok    "unused section can be deleted" "$A" "insert into public.class_sections(user_id,academic_year_id,name,grade_level) values ('$A','$YEAR','Temp','Grade 8');"
expect_ok    "delete unused section" "$A" "select public.delete_section((select id from public.class_sections where name='Temp'));"

# --- academic year edits re-term sessions ---
expect_error "year edit that orphans a session rejected" "$A" "select public.save_academic_year('$YEAR','Y1','$YS','$YE','[{\"term_number\":1,\"start_date\":\"$(d -60)\",\"end_date\":\"$(d -30)\"},$T2,$T3]');"

# --- copy to next year ---
T1b="{\"term_number\":1,\"start_date\":\"$(d 300)\",\"end_date\":\"$(d 330)\"}"; T2b="{\"term_number\":2,\"start_date\":\"$(d 340)\",\"end_date\":\"$(d 370)\"}"; T3b="{\"term_number\":3,\"start_date\":\"$(d 380)\",\"end_date\":\"$(d 400)\"}"
q -c "$(as $A) select public.save_academic_year(null,'Y2','$(d 290)','$(d 410)','[$T1b,$T2b,$T3b]');" >/dev/null
YEAR2=$(sql "$A" "select id from public.academic_years where name='Y2';")
expect_ok    "copy classes to next year" "$A" "select public.copy_year_classes('$YEAR','$YEAR2');"
expect_value "subjects copied" "$A" "select count(*) from public.subjects where academic_year_id='$YEAR2';" "1"
expect_value "assignments copied" "$A" "select count(*) from public.subject_sections where academic_year_id='$YEAR2';" "2"
expect_value "no sessions copied" "$A" "select count(*) from public.teaching_sessions where academic_year_id='$YEAR2';" "0"
expect_ok    "copy twice does not duplicate" "$A" "select public.copy_year_classes('$YEAR','$YEAR2');"
expect_value "still one subject" "$A" "select count(*) from public.subjects where academic_year_id='$YEAR2';" "1"

# --- isolation ---
for t in subjects class_sections subject_sections teaching_schedules no_class_days teaching_sessions; do
  expect_value "B sees no $t" "$B" "select count(*) from public.$t;" "0"
done
expect_error "B cannot schedule A's subject" "$B" "select public.save_teaching_schedule(null,'$SUB','$SEC',2,'08:00','09:00','$(d -100)','$(d 200)',array[1]);"
expect_error "B cannot save over A's subject" "$B" "select public.save_subject('$SUB','$YEAR','x','','Grade 7','',array[]::uuid[]);"
expect_error "B cannot delete A's subject" "$B" "select public.delete_subject('$SUB');"
expect_error "B cannot add no-class day to A's year" "$B" "select public.add_no_class_day('$YEAR','$(d 1)','$(d 1)','x');"
expect_error "B cannot reschedule A's session" "$B" "select public.reschedule_session('$PAST','$(d 3)','08:00','09:00');"
expect_error "B cannot copy A's year" "$B" "select public.copy_year_classes('$YEAR','$YEAR2');"
expect_error "B cannot insert a session for A" "$B" "insert into public.teaching_sessions(user_id,academic_year_id,subject_id,section_id,origin,session_date,start_time,end_time) values ('$A','$YEAR','$SUB','$SEC','manual','$(d -5)','15:00','16:00');"
expect_value "B update hits 0 rows" "$B" "with u as (update public.teaching_sessions set notes='x' returning 1) select count(*) from u;" "0"
out=$(q -c "set role anon; select count(*) from public.teaching_sessions;" | tail -1)
if [ "$out" = "0" ]; then echo "ok    anonymous visitors see no sessions"; else echo "FAIL  anon: $out"; FAILS=$((FAILS+1)); fi
out=$(q -c "set role anon; select public.delete_subject('$SUB');" | tail -1)
if echo "$out" | grep -qi "permission denied"; then echo "ok    anon cannot call RPCs"; else echo "FAIL  anon rpc: $out"; FAILS=$((FAILS+1)); fi

echo; if [ $FAILS -eq 0 ]; then echo "ALL PASSED"; else echo "$FAILS FAILED"; exit 1; fi
