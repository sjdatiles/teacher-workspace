-- M8 hardening: tighter function privileges and covering indexes for every foreign key.

-- 1. Trigger / helper functions are not part of the public API. Signed-out visitors must not be
--    able to call any function in the public schema. (Triggers fire regardless of EXECUTE rights.)
revoke execute on function
  public.check_academic_year_terms(),
  public.enforce_session_rules(),
  public.reset_exceptions_on_series_change(),
  public.resource_links_clean_tags(),
  public.set_updated_at(),
  public.tasks_track_completion()
from public, anon, authenticated;

-- school_today() is used by signed-in users' queries and defaults.
revoke execute on function public.school_today() from public, anon;
grant execute on function public.school_today() to authenticated;

-- 2. Covering indexes for foreign keys (speeds up cascades, set-null and joins when a parent
--    row such as a subject, section, schedule or academic year is changed or deleted).
create index if not exists academic_terms_year_fk_idx on public.academic_terms (academic_year_id, user_id);
create index if not exists calendar_event_exceptions_user_id_fkey_idx on public.calendar_event_exceptions (user_id);
create index if not exists calendar_exceptions_event_fk_idx on public.calendar_event_exceptions (event_id, user_id);
create index if not exists class_sections_year_fk_idx on public.class_sections (academic_year_id, user_id);
create index if not exists no_class_days_year_fk_idx on public.no_class_days (academic_year_id, user_id);
create index if not exists resource_links_category_fk_idx on public.resource_links (category_id, user_id);
create index if not exists resource_links_subject_fk_idx on public.resource_links (subject_id, user_id);
create index if not exists subject_sections_section_fk_idx on public.subject_sections (section_id, user_id, academic_year_id);
create index if not exists subject_sections_subject_fk_idx on public.subject_sections (subject_id, user_id, academic_year_id);
create index if not exists subjects_year_fk_idx on public.subjects (academic_year_id, user_id);
create index if not exists teaching_schedules_assignment_fk_idx on public.teaching_schedules (subject_id, section_id, user_id, academic_year_id);
create index if not exists teaching_schedules_year_fk_idx on public.teaching_schedules (academic_year_id, user_id);
create index if not exists teaching_sessions_assignment_fk_idx on public.teaching_sessions (subject_id, section_id, user_id, academic_year_id);
create index if not exists teaching_sessions_resched_fk_idx on public.teaching_sessions (rescheduled_from_id, user_id);
create index if not exists teaching_sessions_schedule_fk_idx on public.teaching_sessions (schedule_id, user_id);
create index if not exists teaching_sessions_term_fk_idx on public.teaching_sessions (term_id, academic_year_id, user_id);
create index if not exists teaching_sessions_year_fk_idx on public.teaching_sessions (academic_year_id, user_id);
create index if not exists user_settings_selected_year_fk_idx on public.user_settings (selected_academic_year_id, user_id);
