#!/usr/bin/env bash
# Foundation tests: three-term rules and row-level security for years/terms/profiles.
#   ./supabase/tests/foundation.test.sh   (needs PostgreSQL server binaries; run as non-root)
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"

T1='{"term_number":1,"start_date":"2026-06-01","end_date":"2026-09-30"}'
T2='{"term_number":2,"start_date":"2026-10-05","end_date":"2027-01-31"}'
T3='{"term_number":3,"start_date":"2027-02-08","end_date":"2027-04-30"}'
save() { echo "select public.save_academic_year($1,'$2','$3','$4','$5');"; }

expect_value "profile+settings auto-created on signup (A sees own)" "$A" "select (select count(*) from public.profiles)||'/'||(select count(*) from public.user_settings);" "1/1"
expect_value "signup copied full_name into profile" "$A" "select full_name from public.profiles;" "A"
expect_ok    "valid year with 3 terms saves"            "$A" "$(save null 2026-2027 2026-06-01 2027-04-30 "[$T1,$T2,$T3]")"
expect_error "only 2 terms rejected"                    "$A" "$(save null X 2026-06-01 2027-04-30 "[$T1,$T2]")"
expect_error "4 terms rejected"                         "$A" "$(save null X4 2026-06-01 2027-04-30 "[$T1,$T2,$T3,$T3]")"
expect_error "overlapping terms rejected"               "$A" "$(save null Y 2026-06-01 2027-04-30 "[$T1,{\"term_number\":2,\"start_date\":\"2026-09-15\",\"end_date\":\"2027-01-31\"},$T3]")"
expect_error "term outside year rejected"               "$A" "$(save null Z 2026-06-01 2027-04-30 "[$T1,$T2,{\"term_number\":3,\"start_date\":\"2027-02-08\",\"end_date\":\"2027-06-30\"}]")"
expect_error "terms out of order rejected"              "$A" "$(save null W 2026-06-01 2027-04-30 "[{\"term_number\":1,\"start_date\":\"2027-02-08\",\"end_date\":\"2027-04-30\"},$T2,{\"term_number\":3,\"start_date\":\"2026-06-01\",\"end_date\":\"2026-09-30\"}]")"
expect_error "term_number 4 rejected (no quarters)"     "$A" "$(save null V 2026-06-01 2027-04-30 "[$T1,$T2,{\"term_number\":4,\"start_date\":\"2027-02-08\",\"end_date\":\"2027-04-30\"}]")"
expect_error "duplicate term_number rejected"           "$A" "$(save null D 2026-06-01 2027-04-30 "[$T1,$T1,$T3]")"
expect_error "year start after end rejected"            "$A" "$(save null U 2027-04-30 2026-06-01 "[$T1,$T2,$T3]")"
expect_error "year without terms rejected at commit"    "$A" "insert into public.academic_years(user_id,name,start_date,end_date) values ('$A','Empty','2026-06-01','2027-04-30');"
expect_error "duplicate year name rejected"             "$A" "$(save null 2026-2027 2026-06-01 2027-04-30 "[$T1,$T2,$T3]")"
expect_error "deleting one term of a year rejected"     "$A" "delete from public.academic_terms where term_number=2;"
expect_value "failed attempts left 1 year"             "$A" "select count(*) from public.academic_years;" "1"
expect_value "failed attempts left exactly 3 terms"    "$A" "select count(*) from public.academic_terms;" "3"
YEAR=$(q -c "select id from public.academic_years;")
expect_ok    "editing year dates via function works"    "$A" "$(save "'$YEAR'" 2026-2027 2026-06-01 2027-05-15 "[$T1,$T2,{\"term_number\":3,\"start_date\":\"2027-02-08\",\"end_date\":\"2027-05-15\"}]")"
expect_ok    "deleting a whole year cascades its terms" "$A" "delete from public.academic_years where id='$YEAR';"
expect_value "no orphan terms after year delete"        "$A" "select count(*) from public.academic_terms;" "0"
expect_ok    "re-create year for isolation tests"       "$A" "$(save null 2026-2027 2026-06-01 2027-04-30 "[$T1,$T2,$T3]")"
YEAR=$(q -c "select id from public.academic_years;")

# --- isolation: teacher B must see and change nothing of teacher A's ---
expect_value "B cannot read A's years"        "$B" "select count(*) from public.academic_years;" "0"
expect_value "B cannot read A's terms"        "$B" "select count(*) from public.academic_terms;" "0"
expect_value "B cannot read A's profile"      "$B" "select count(*) from public.profiles where id='$A';" "0"
expect_value "B cannot read A's settings"     "$B" "select count(*) from public.user_settings where user_id='$A';" "0"
expect_value "B update of A's year hits 0 rows" "$B" "with u as (update public.academic_years set name='hacked' returning 1) select count(*) from u;" "0"
expect_value "B delete of A's year hits 0 rows" "$B" "with d as (delete from public.academic_years returning 1) select count(*) from d;" "0"
expect_error "B cannot insert a year owned by A" "$B" "insert into public.academic_years(user_id,name,start_date,end_date) values ('$A','spoof','2026-01-01','2026-12-31');"
expect_error "B cannot edit A's year via function" "$B" "$(save "'$YEAR'" x 2026-06-01 2027-04-30 "[$T1,$T2,$T3]")"
expect_error "B cannot select A's year in own settings" "$B" "update public.user_settings set selected_academic_year_id='$YEAR';"
expect_value "A's year survived all of that"  "$A" "select name from public.academic_years;" "2026-2027"
# anon was granted SELECT by the harness above; RLS must still return nothing.
out=$(q -c "set role anon; select count(*) from public.academic_years;" | tail -1)
if [ "$out" = "0" ]; then echo "ok    anonymous visitors see no rows"; else echo "FAIL  anon access: got '$out'"; FAILS=$((FAILS+1)); fi

echo; if [ $FAILS -eq 0 ]; then echo "ALL PASSED"; else echo "$FAILS FAILED"; exit 1; fi
