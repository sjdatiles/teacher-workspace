-- Teacher Workspace — M6: Reports & Accomplishments
-- ONE function feeds every report, chart, table and export. It counts ONLY sessions whose status
-- is 'completed' (scheduled, cancelled and rescheduled originals never count) and nothing else:
-- tasks, events and meetings are not in this table, so they cannot leak into a teaching report.
--
-- One row per (term, subject, section). The app adds these up for totals, charts and exports,
-- so the screen and the CSV can never disagree.
--   minutes  = actual teaching minutes (what the teacher recorded when completing the session)
--   students = sum of the section's population recorded at completion (the "students taught" total)

create or replace function public.completed_session_report(
  p_year    uuid,
  p_term    integer default null,   -- 1..3, or null for the whole year
  p_from    date    default null,   -- optional custom date range (inclusive)
  p_to      date    default null,
  p_subject uuid    default null,
  p_section uuid    default null
)
returns table (
  term_number integer,
  subject_id  uuid,
  section_id  uuid,
  sessions    bigint,
  minutes     bigint,
  students    bigint
)
language sql
stable
set search_path = ''
as $$
  select t.term_number,
         s.subject_id,
         s.section_id,
         count(*)::bigint,
         coalesce(sum(s.actual_minutes), 0)::bigint,
         coalesce(sum(s.population_at_completion), 0)::bigint
    from public.teaching_sessions s
    join public.academic_terms t on t.id = s.term_id
   where s.user_id = (select auth.uid())
     and s.academic_year_id = p_year
     and s.status = 'completed'
     and (p_term    is null or t.term_number = p_term)
     and (p_from    is null or s.session_date >= p_from)
     and (p_to      is null or s.session_date <= p_to)
     and (p_subject is null or s.subject_id = p_subject)
     and (p_section is null or s.section_id = p_section)
   group by t.term_number, s.subject_id, s.section_id
$$;

revoke all on function public.completed_session_report(uuid, integer, date, date, uuid, uuid) from public, anon;
grant execute on function public.completed_session_report(uuid, integer, date, date, uuid, uuid) to authenticated;
