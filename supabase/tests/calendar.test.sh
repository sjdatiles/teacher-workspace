#!/usr/bin/env bash
# Calendar tests: event constraints, repeating rules, per-occurrence exceptions, isolation.
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"
sql() { q -c "$(as "$1") $2" | tail -1; }


expect_ok    "create all-day event" "$A" "insert into public.calendar_events(user_id,title,category,start_date,end_date) values ('$A','Faculty day','school_activity','2026-12-01','2026-12-01');"
expect_ok    "create timed event with reminder + color" "$A" "insert into public.calendar_events(user_id,title,category,color,start_date,end_date,start_time,end_time,reminder_minutes,location) values ('$A','PTA meeting','meeting','blue','2026-12-02','2026-12-02','14:00','15:30',60,'Room 5');"
expect_ok    "multi-day event" "$A" "insert into public.calendar_events(user_id,title,category,start_date,end_date) values ('$A','Seminar','other','2026-12-03','2026-12-05');"
expect_error "teaching category not allowed manually" "$A" "insert into public.calendar_events(user_id,title,category,start_date,end_date) values ('$A','x','teaching_session','2026-12-01','2026-12-01');"
expect_error "empty title rejected" "$A" "insert into public.calendar_events(user_id,title,category,start_date,end_date) values ('$A','  ','meeting','2026-12-01','2026-12-01');"
expect_error "end before start rejected" "$A" "insert into public.calendar_events(user_id,title,category,start_date,end_date) values ('$A','x','meeting','2026-12-02','2026-12-01');"
expect_error "end time before start time rejected" "$A" "insert into public.calendar_events(user_id,title,category,start_date,end_date,start_time,end_time) values ('$A','x','meeting','2026-12-01','2026-12-01','10:00','09:00');"
expect_ok    "multi-day may end earlier in the day" "$A" "insert into public.calendar_events(user_id,title,category,start_date,end_date,start_time,end_time) values ('$A','Overnight','other','2026-12-01','2026-12-02','20:00','06:00');"
expect_error "only one of start/end time rejected" "$A" "insert into public.calendar_events(user_id,title,category,start_date,end_date,start_time) values ('$A','x','meeting','2026-12-01','2026-12-01','10:00');"
expect_error "bad color rejected" "$A" "insert into public.calendar_events(user_id,title,category,color,start_date,end_date) values ('$A','x','meeting','pink','2026-12-01','2026-12-01');"
expect_error "negative reminder rejected" "$A" "insert into public.calendar_events(user_id,title,category,start_date,end_date,reminder_minutes) values ('$A','x','meeting','2026-12-01','2026-12-01',-5);"

expect_ok    "weekly repeating event" "$A" "insert into public.calendar_events(user_id,title,category,start_date,end_date,repeat_freq,repeat_until) values ('$A','Dept meeting','meeting','2026-12-07','2026-12-07','weekly','2027-03-01');"
expect_error "repeating event without end rejected" "$A" "insert into public.calendar_events(user_id,title,category,start_date,end_date,repeat_freq) values ('$A','x','meeting','2026-12-07','2026-12-07','weekly');"
expect_error "end date without repeating rejected" "$A" "insert into public.calendar_events(user_id,title,category,start_date,end_date,repeat_until) values ('$A','x','meeting','2026-12-07','2026-12-07','2027-01-01');"
expect_error "repeat end before start rejected" "$A" "insert into public.calendar_events(user_id,title,category,start_date,end_date,repeat_freq,repeat_until) values ('$A','x','meeting','2026-12-07','2026-12-07','daily','2026-12-01');"
expect_error "repeat longer than two years rejected" "$A" "insert into public.calendar_events(user_id,title,category,start_date,end_date,repeat_freq,repeat_until) values ('$A','x','meeting','2026-12-07','2026-12-07','daily','2029-01-01');"
expect_error "bad frequency rejected" "$A" "insert into public.calendar_events(user_id,title,category,start_date,end_date,repeat_freq,repeat_until) values ('$A','x','meeting','2026-12-07','2026-12-07','yearly','2027-01-01');"

SER=$(sql "$A" "select id from public.calendar_events where title='Dept meeting';")
expect_ok    "skip one occurrence" "$A" "insert into public.calendar_event_exceptions(user_id,event_id,occurrence_date,cancelled) values ('$A','$SER','2026-12-14',true);"
expect_ok    "change one occurrence" "$A" "insert into public.calendar_event_exceptions(user_id,event_id,occurrence_date,title,start_date,end_date,start_time,end_time) values ('$A','$SER','2026-12-21','Dept meeting (moved)','2026-12-22','2026-12-22','10:00','11:00');"
expect_error "second exception for same occurrence rejected" "$A" "insert into public.calendar_event_exceptions(user_id,event_id,occurrence_date,cancelled) values ('$A','$SER','2026-12-14',true);"
expect_error "changed occurrence needs title and dates" "$A" "insert into public.calendar_event_exceptions(user_id,event_id,occurrence_date) values ('$A','$SER','2026-12-28');"
expect_ok    "editing title keeps exceptions" "$A" "update public.calendar_events set title='Department meeting' where id='$SER';"
expect_value "exceptions kept after title edit" "$A" "select count(*) from public.calendar_event_exceptions;" "2"
expect_ok    "extending the end date keeps exceptions" "$A" "update public.calendar_events set repeat_until='2027-04-01' where id='$SER';"
expect_value "exceptions kept after end date edit" "$A" "select count(*) from public.calendar_event_exceptions;" "2"
expect_ok    "changing the frequency resets exceptions" "$A" "update public.calendar_events set repeat_interval=2 where id='$SER';"
expect_value "exceptions cleared after series change" "$A" "select count(*) from public.calendar_event_exceptions;" "0"
expect_ok    "re-add exception" "$A" "insert into public.calendar_event_exceptions(user_id,event_id,occurrence_date,cancelled) values ('$A','$SER','2026-12-21',true);"
expect_ok    "deleting event cascades exceptions" "$A" "delete from public.calendar_events where id='$SER';"
expect_value "no orphan exceptions" "$A" "select count(*) from public.calendar_event_exceptions;" "0"

# --- isolation ---
EV=$(sql "$A" "select id from public.calendar_events where title='PTA meeting';")
expect_ok    "A event for exception test" "$A" "insert into public.calendar_events(user_id,title,category,start_date,end_date,repeat_freq,repeat_until) values ('$A','Daily','other','2026-12-01','2026-12-01','daily','2026-12-31');"
SER=$(sql "$A" "select id from public.calendar_events where title='Daily';")
expect_value "B sees no events" "$B" "select count(*) from public.calendar_events;" "0"
expect_value "B sees no exceptions" "$B" "select count(*) from public.calendar_event_exceptions;" "0"
expect_error "B cannot insert event as A" "$B" "insert into public.calendar_events(user_id,title,category,start_date,end_date) values ('$A','spoof','meeting','2026-12-01','2026-12-01');"
expect_error "B cannot add exception to A's event" "$B" "insert into public.calendar_event_exceptions(user_id,event_id,occurrence_date,cancelled) values ('$B','$SER','2026-12-05',true);"
expect_error "B cannot add exception to A's event as A" "$B" "insert into public.calendar_event_exceptions(user_id,event_id,occurrence_date,cancelled) values ('$A','$SER','2026-12-05',true);"
expect_value "B update hits 0 rows" "$B" "with u as (update public.calendar_events set title='x' returning 1) select count(*) from u;" "0"
expect_value "B delete hits 0 rows" "$B" "with d as (delete from public.calendar_events returning 1) select count(*) from d;" "0"
expect_value "A events survived" "$A" "select count(*) from public.calendar_events;" "5"
out=$(q -c "set role anon; select count(*) from public.calendar_events;" | tail -1)
if [ "$out" = "0" ]; then echo "ok    anonymous visitors see no events"; else echo "FAIL  anon: $out"; FAILS=$((FAILS+1)); fi

echo; if [ $FAILS -eq 0 ]; then echo "ALL PASSED"; else echo "$FAILS FAILED"; exit 1; fi
