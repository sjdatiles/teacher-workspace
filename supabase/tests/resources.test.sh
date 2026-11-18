#!/usr/bin/env bash
# Resource tests: default folders, link validation, tag cleaning, folder/subject deletion, isolation.
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"
sql() { q -c "$(as "$1") $2" | tail -1; }
d() { date -d "$(date +%F) $1 days" +%F; }

# default folders
expect_ok    "ensure default folders" "$A" "select public.ensure_resource_categories();"
expect_value "six default folders" "$A" "select count(*) from public.resource_categories;" "6"
expect_ok    "ensure again is a no-op" "$A" "select public.ensure_resource_categories();"
expect_value "still six folders" "$A" "select count(*) from public.resource_categories;" "6"
expect_value "defaults include Lesson Materials" "$A" "select count(*) from public.resource_categories where name='Lesson Materials';" "1"
CAT=$(sql "$A" "select id from public.resource_categories where name='Online Tools';")
expect_ok    "delete a default folder" "$A" "delete from public.resource_categories where name='Other';"
expect_ok    "ensure after delete does not bring it back" "$A" "select public.ensure_resource_categories();"
expect_value "five folders remain" "$A" "select count(*) from public.resource_categories;" "5"
expect_ok    "add custom folder" "$A" "insert into public.resource_categories(user_id,name) values ('$A','Grade 7 Science');"
expect_error "duplicate folder name rejected (case/space)" "$A" "insert into public.resource_categories(user_id,name) values ('$A','  grade 7 science ');"
expect_error "empty folder name rejected" "$A" "insert into public.resource_categories(user_id,name) values ('$A','  ');"
expect_error "folder name over 60 rejected" "$A" "insert into public.resource_categories(user_id,name) values ('$A','$(printf 'x%.0s' $(seq 1 61))');"
expect_value "B has no folders yet" "$B" "select count(*) from public.resource_categories;" "0"
expect_ok    "B gets own defaults" "$B" "select public.ensure_resource_categories();"
expect_value "B has six" "$B" "select count(*) from public.resource_categories;" "6"
expect_value "A still has six (5 + custom)" "$A" "select count(*) from public.resource_categories;" "6"

# links: validation
expect_ok    "save https link" "$A" "insert into public.resource_links(user_id,title,url) values ('$A','DepEd','https://teacher.deped.gov.ph');"
expect_value "defaults: website, not favorite, no tags" "$A" "select resource_type||'/'||is_favorite||'/'||cardinality(tags) from public.resource_links;" "website/false/0"
expect_ok    "save http link" "$A" "insert into public.resource_links(user_id,title,url) values ('$A','Old site','http://example.com/a?b=c#d');"
for bad in "javascript:alert(1)" "ftp://example.com/x" "data:text/html,hi" "file:///etc/passwd" "example.com" "https://" "https:// spaced.com" "//evil.com"; do
  expect_error "rejects url '$bad'" "$A" "insert into public.resource_links(user_id,title,url) values ('$A','bad','$bad');"
done
expect_error "empty title rejected" "$A" "insert into public.resource_links(user_id,title,url) values ('$A',' ','https://a.com');"
expect_error "title over 160 rejected" "$A" "insert into public.resource_links(user_id,title,url) values ('$A','$(printf 'x%.0s' $(seq 1 161))','https://a.com');"
expect_error "url over 2000 rejected" "$A" "insert into public.resource_links(user_id,title,url) values ('$A','long','https://a.com/$(printf 'x%.0s' $(seq 1 2000))');"
expect_error "description over 500 rejected" "$A" "insert into public.resource_links(user_id,title,url,description) values ('$A','d','https://a.com','$(printf 'x%.0s' $(seq 1 501))');"
for t in website google_drive document video reference other; do
  expect_ok "type $t allowed" "$A" "insert into public.resource_links(user_id,title,url,resource_type) values ('$A','t $t','https://a.com/$t','$t');"
done
expect_error "unknown type rejected" "$A" "insert into public.resource_links(user_id,title,url,resource_type) values ('$A','x','https://a.com','pdf');"

# tags
expect_ok    "tags cleaned" "$A" "insert into public.resource_links(user_id,title,url,tags) values ('$A','Tagged','https://a.com/tags',array['  Math ','math','',' Grade 7','MATH']);"
expect_value "tags trimmed, lower-cased, de-duplicated, in order" "$A" "select array_to_string(tags,'|') from public.resource_links where title='Tagged';" "math|grade 7"
expect_error "more than 10 tags rejected" "$A" "insert into public.resource_links(user_id,title,url,tags) values ('$A','Many','https://a.com/m',array['1','2','3','4','5','6','7','8','9','10','11']);"
expect_error "tag over 30 characters rejected" "$A" "insert into public.resource_links(user_id,title,url,tags) values ('$A','LongTag','https://a.com/l',array['$(printf 'x%.0s' $(seq 1 31))']);"
expect_ok    "update re-cleans tags" "$A" "update public.resource_links set tags=array['A','a ','B'] where title='Tagged';"
expect_value "updated tags cleaned" "$A" "select array_to_string(tags,'|') from public.resource_links where title='Tagged';" "a|b"

# favorites, folders and subjects
expect_ok    "favorite a link" "$A" "update public.resource_links set is_favorite=true where title='DepEd';"
expect_ok    "put link in folder" "$A" "update public.resource_links set category_id='$CAT' where title='DepEd';"
expect_ok    "delete the folder" "$A" "delete from public.resource_categories where id='$CAT';"
expect_value "link survives, now without a folder" "$A" "select (category_id is null)||'/'||is_favorite from public.resource_links where title='DepEd';" "true/true"
expect_value "link keeps its owner after folder delete" "$A" "select user_id from public.resource_links where title='DepEd';" "$A"

YS=$(d -110); YE=$(d 210)
T1="{\"term_number\":1,\"start_date\":\"$(d -100)\",\"end_date\":\"$(d -50)\"}"
T2="{\"term_number\":2,\"start_date\":\"$(d -40)\",\"end_date\":\"$(d 10)\"}"
T3="{\"term_number\":3,\"start_date\":\"$(d 20)\",\"end_date\":\"$(d 200)\"}"
q -c "$(as $A) select public.save_academic_year(null,'Y1','$YS','$YE','[$T1,$T2,$T3]');" >/dev/null
YEAR=$(sql "$A" "select id from public.academic_years;")
expect_ok    "create subject" "$A" "select public.save_subject(null,'$YEAR','Science','','Grade 7','',array[]::uuid[]);"
SUB=$(sql "$A" "select id from public.subjects;")
expect_ok    "link a resource to a subject" "$A" "update public.resource_links set subject_id='$SUB' where title='DepEd';"
expect_ok    "delete the subject" "$A" "select public.delete_subject('$SUB');"
expect_value "resource survives subject delete, subject cleared" "$A" "select (subject_id is null) from public.resource_links where title='DepEd';" "t"

# isolation
expect_value "B sees no links" "$B" "select count(*) from public.resource_links;" "0"
expect_error "B cannot insert a link as A" "$B" "insert into public.resource_links(user_id,title,url) values ('$A','spoof','https://a.com');"
expect_error "B cannot insert a folder as A" "$B" "insert into public.resource_categories(user_id,name) values ('$A','spoof');"
BCAT=$(sql "$B" "select id from public.resource_categories limit 1;")
expect_error "A cannot file a link in B's folder" "$A" "update public.resource_links set category_id='$BCAT' where title='DepEd';"
expect_error "B cannot link a resource to A's subject" "$B" "insert into public.resource_links(user_id,title,url,subject_id) values ('$B','x','https://a.com','$SUB');"
expect_value "B update hits 0 rows" "$B" "with u as (update public.resource_links set title='x' returning 1) select count(*) from u;" "0"
expect_value "B delete hits 0 rows" "$B" "with x as (delete from public.resource_links returning 1) select count(*) from x;" "0"
expect_error "A cannot move a link to B" "$A" "update public.resource_links set user_id='$B' where title='DepEd';"
for t in resource_links resource_categories; do
  out=$(q -c "set role anon; select count(*) from public.$t;" | tail -1)
  if echo "$out" | grep -q "ERROR\|^0$"; then echo "ok    anonymous visitors see no $t"; else echo "FAIL  anon $t: $out"; FAILS=$((FAILS+1)); fi
done
out=$(q -c "set role anon; select public.ensure_resource_categories();")
if echo "$out" | grep -q "ERROR"; then echo "ok    anonymous visitors cannot run ensure_resource_categories"; else echo "FAIL  anon ensure: $out"; FAILS=$((FAILS+1)); fi

echo; if [ $FAILS -eq 0 ]; then echo "ALL PASSED"; else echo "$FAILS FAILED"; exit 1; fi
