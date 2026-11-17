-- Teacher Workspace — M2: My Classes
-- Subjects, class sections, assignments, weekly schedules, no-class days and teaching sessions.
--
-- Rules enforced here (not only in the app):
--  * Every row belongs to one teacher and one academic year; composite foreign keys make it
--    impossible to link records across teachers or across academic years.
--  * Only sessions with status 'completed' ever carry actual minutes / a class-size snapshot,
--    so reports can count exactly those and nothing else.
--  * A session's term is derived from its date; a date outside every term is rejected.
--  * Completed sessions cannot be moved or re-assigned, and past records are never rewritten
--    by schedule edits.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- "Today" in the school time zone. Mirrors SCHOOL_TIME_ZONE in src/lib/time.ts.
create or replace function public.school_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Asia/Manila')::date $$;

create domain public.grade_level as text
  check (value in (
    'Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
    'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'
  ));

-- Lets sessions reference (term, year, teacher) so a term can never belong to another year/teacher.
alter table public.academic_terms
  add constraint academic_terms_id_year_user_unique unique (id, academic_year_id, user_id);

-- ---------------------------------------------------------------------------
-- subjects
-- ---------------------------------------------------------------------------
create table public.subjects (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  academic_year_id uuid not null,
  name             text not null check (char_length(btrim(name)) between 1 and 80),
  code             text check (code is null or char_length(code) <= 20),
  grade_level      public.grade_level not null,
  description      text not null default '' check (char_length(description) <= 500),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint subjects_year_fk foreign key (academic_year_id, user_id)
    references public.academic_years (id, user_id) on delete cascade,
  constraint subjects_scope_unique unique (id, user_id, academic_year_id)
);
create unique index subjects_name_unique
  on public.subjects (academic_year_id, grade_level, lower(btrim(name)));
create index subjects_user_year_idx on public.subjects (user_id, academic_year_id);
create trigger subjects_set_updated_at before update on public.subjects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- class_sections (class population only: a head count, never individual students)
-- ---------------------------------------------------------------------------
create table public.class_sections (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  academic_year_id uuid not null,
  name             text not null check (char_length(btrim(name)) between 1 and 80),
  grade_level      public.grade_level not null,
  population       integer not null default 0 check (population between 0 and 200),
  description      text not null default '' check (char_length(description) <= 500),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint class_sections_year_fk foreign key (academic_year_id, user_id)
    references public.academic_years (id, user_id) on delete cascade,
  constraint class_sections_scope_unique unique (id, user_id, academic_year_id)
);
create unique index class_sections_name_unique
  on public.class_sections (academic_year_id, grade_level, lower(btrim(name)));
create index class_sections_user_year_idx on public.class_sections (user_id, academic_year_id);
create trigger class_sections_set_updated_at before update on public.class_sections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- subject_sections: which subject is taught to which section (many-to-many)
-- ---------------------------------------------------------------------------
create table public.subject_sections (
  subject_id       uuid not null,
  section_id       uuid not null,
  user_id          uuid not null,
  academic_year_id uuid not null,
  created_at       timestamptz not null default now(),
  primary key (subject_id, section_id),
  constraint subject_sections_subject_fk foreign key (subject_id, user_id, academic_year_id)
    references public.subjects (id, user_id, academic_year_id) on delete cascade,
  constraint subject_sections_section_fk foreign key (section_id, user_id, academic_year_id)
    references public.class_sections (id, user_id, academic_year_id) on delete cascade,
  constraint subject_sections_scope_unique
    unique (subject_id, section_id, user_id, academic_year_id)
);
create index subject_sections_section_idx on public.subject_sections (section_id);

-- ---------------------------------------------------------------------------
-- teaching_schedules: recurring weekly slot for one subject + section
-- ---------------------------------------------------------------------------
create table public.teaching_schedules (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  academic_year_id uuid not null,
  subject_id       uuid not null,
  section_id       uuid not null,
  day_of_week      smallint not null check (day_of_week between 1 and 7), -- ISO: 1 = Monday
  start_time       time not null,
  end_time         time not null,
  duration_minutes integer generated always as
    ((extract(epoch from (end_time - start_time)) / 60)::integer) stored,
  effective_start  date not null,
  effective_end    date not null,
  term_numbers     smallint[] not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint teaching_schedules_times_valid check (end_time > start_time),
  constraint teaching_schedules_dates_valid check (effective_start <= effective_end),
  constraint teaching_schedules_terms_valid
    check (cardinality(term_numbers) between 1 and 3 and term_numbers <@ array[1, 2, 3]::smallint[]),
  constraint teaching_schedules_year_fk foreign key (academic_year_id, user_id)
    references public.academic_years (id, user_id) on delete cascade,
  constraint teaching_schedules_assignment_fk
    foreign key (subject_id, section_id, user_id, academic_year_id)
    references public.subject_sections (subject_id, section_id, user_id, academic_year_id),
  constraint teaching_schedules_id_user_unique unique (id, user_id)
);
create index teaching_schedules_user_year_idx on public.teaching_schedules (user_id, academic_year_id);
create trigger teaching_schedules_set_updated_at before update on public.teaching_schedules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- no_class_days: holidays / breaks that generated sessions skip
-- ---------------------------------------------------------------------------
create table public.no_class_days (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  academic_year_id uuid not null,
  date_from        date not null,
  date_to          date not null,
  reason           text not null default '' check (char_length(reason) <= 120),
  created_at       timestamptz not null default now(),
  constraint no_class_days_dates_valid check (date_from <= date_to),
  constraint no_class_days_year_fk foreign key (academic_year_id, user_id)
    references public.academic_years (id, user_id) on delete cascade
);
create index no_class_days_year_idx on public.no_class_days (academic_year_id, date_from);

-- ---------------------------------------------------------------------------
-- teaching_sessions: the single source of truth for what was / will be taught
-- ---------------------------------------------------------------------------
create table public.teaching_sessions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null,
  academic_year_id         uuid not null,
  term_id                  uuid not null,  -- derived from session_date by trigger
  subject_id               uuid not null,
  section_id               uuid not null,
  schedule_id              uuid,           -- source schedule; null for manual or after schedule delete
  origin                   text not null check (origin in ('generated', 'manual', 'rescheduled')),
  session_date             date not null,
  start_time               time not null,
  end_time                 time not null,
  scheduled_minutes        integer generated always as
    ((extract(epoch from (end_time - start_time)) / 60)::integer) stored,
  status                   text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled', 'rescheduled')),
  -- Filled only while status = 'completed' (see trigger): these are what reports count.
  actual_minutes           integer check (actual_minutes is null or actual_minutes between 1 and 1440),
  completed_at             timestamptz,
  population_at_completion integer check (population_at_completion is null or population_at_completion >= 0),
  rescheduled_from_id      uuid,           -- on the replacement: the original session
  notes                    text not null default '' check (char_length(notes) <= 500),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint teaching_sessions_times_valid check (end_time > start_time),
  constraint teaching_sessions_completed_complete check (
    (status = 'completed') = (
      actual_minutes is not null and completed_at is not null and population_at_completion is not null
    )
  ),
  constraint teaching_sessions_year_fk foreign key (academic_year_id, user_id)
    references public.academic_years (id, user_id) on delete cascade,
  constraint teaching_sessions_term_fk foreign key (term_id, academic_year_id, user_id)
    references public.academic_terms (id, academic_year_id, user_id),
  constraint teaching_sessions_assignment_fk
    foreign key (subject_id, section_id, user_id, academic_year_id)
    references public.subject_sections (subject_id, section_id, user_id, academic_year_id),
  constraint teaching_sessions_schedule_fk foreign key (schedule_id, user_id)
    references public.teaching_schedules (id, user_id) on delete set null (schedule_id),
  constraint teaching_sessions_id_user_unique unique (id, user_id),
  constraint teaching_sessions_resched_fk foreign key (rescheduled_from_id, user_id)
    references public.teaching_sessions (id, user_id) on delete set null (rescheduled_from_id)
);

-- A schedule can generate at most one session per date, however often generation runs.
create unique index teaching_sessions_generated_unique
  on public.teaching_sessions (schedule_id, session_date)
  where origin = 'generated' and schedule_id is not null;
-- A session can be rescheduled to at most one replacement.
create unique index teaching_sessions_one_replacement
  on public.teaching_sessions (rescheduled_from_id) where rescheduled_from_id is not null;
create index teaching_sessions_user_year_date_idx
  on public.teaching_sessions (user_id, academic_year_id, session_date);
create index teaching_sessions_schedule_idx on public.teaching_sessions (schedule_id);
create index teaching_sessions_section_idx on public.teaching_sessions (section_id);
create index teaching_sessions_subject_idx on public.teaching_sessions (subject_id);
create index teaching_sessions_term_idx on public.teaching_sessions (term_id);

create trigger teaching_sessions_set_updated_at before update on public.teaching_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Session rules (BEFORE INSERT/UPDATE)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_session_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_term uuid;
  v_pop  integer;
begin
  -- 1. Term is always derived from the date; never silently guessed.
  select t.id into v_term
    from public.academic_terms t
   where t.academic_year_id = new.academic_year_id
     and new.session_date between t.start_date and t.end_date;
  if v_term is null then
    raise exception 'The date % is not inside any term of this academic year. Adjust the term dates or move that session.',
      new.session_date using errcode = 'check_violation';
  end if;
  new.term_id := v_term;

  if tg_op = 'INSERT' then
    if new.status not in ('scheduled', 'completed') then
      raise exception 'A new session must be Scheduled or Completed.' using errcode = 'check_violation';
    end if;
  else
    -- 2. Completed sessions are historical records: they cannot be moved or re-assigned.
    if old.status = 'completed' and new.status = 'completed' then
      if (new.subject_id, new.section_id, new.session_date, new.start_time, new.end_time, new.academic_year_id)
         is distinct from
         (old.subject_id, old.section_id, old.session_date, old.start_time, old.end_time, old.academic_year_id) then
        raise exception 'A completed session cannot be moved or changed. Reopen it first.'
          using errcode = 'check_violation';
      end if;
      new.completed_at := old.completed_at;
      new.population_at_completion := old.population_at_completion;
    end if;

    -- 3. Allowed status changes.
    if old.status <> new.status and not (
         (old.status = 'scheduled' and new.status in ('completed', 'cancelled', 'rescheduled'))
      or (old.status in ('completed', 'cancelled') and new.status = 'scheduled')
      or (old.status = 'rescheduled' and new.status = 'scheduled'
          and not exists (select 1 from public.teaching_sessions r where r.rescheduled_from_id = old.id))
    ) then
      raise exception 'A % session cannot be changed to %.', old.status, new.status
        using errcode = 'check_violation';
    end if;
  end if;

  -- 4. Completion bookkeeping: only completed sessions carry actual minutes and a class-size snapshot.
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status <> 'completed') then
    if new.session_date > public.school_today() then
      raise exception 'A session in the future cannot be marked Completed.' using errcode = 'check_violation';
    end if;
    select population into v_pop from public.class_sections where id = new.section_id;
    new.population_at_completion := coalesce(v_pop, 0);
    new.completed_at := now();
    new.actual_minutes := coalesce(
      new.actual_minutes,
      (extract(epoch from (new.end_time - new.start_time)) / 60)::integer
    );
  elsif new.status <> 'completed' then
    new.actual_minutes := null;
    new.completed_at := null;
    new.population_at_completion := null;
  end if;

  return new;
end;
$$;

create trigger teaching_sessions_enforce_rules
  before insert or update on public.teaching_sessions
  for each row execute function public.enforce_session_rules();

-- ---------------------------------------------------------------------------
-- Session generation
-- ---------------------------------------------------------------------------
-- Creates the missing sessions of one schedule inside [p_from, p_to] (defaults: its whole range).
-- Only dates that fall in the schedule's chosen terms and not on a no-class day are created.
-- Safe to run repeatedly: existing sessions are never duplicated or changed.
create or replace function public.generate_sessions_for_schedule(
  p_schedule_id uuid,
  p_from date default null,
  p_to   date default null
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  s public.teaching_schedules%rowtype;
  v_count integer;
begin
  select * into s from public.teaching_schedules where id = p_schedule_id;
  if not found then
    raise exception 'Schedule not found.' using errcode = 'no_data_found';
  end if;

  insert into public.teaching_sessions
    (user_id, academic_year_id, subject_id, section_id, schedule_id, origin, session_date, start_time, end_time)
  select s.user_id, s.academic_year_id, s.subject_id, s.section_id, s.id, 'generated',
         d::date, s.start_time, s.end_time
    from generate_series(
           greatest(s.effective_start, coalesce(p_from, s.effective_start))::timestamp,
           least(s.effective_end, coalesce(p_to, s.effective_end))::timestamp,
           interval '1 day'
         ) as d
    join public.academic_terms t
      on t.academic_year_id = s.academic_year_id
     and d::date between t.start_date and t.end_date
     and t.term_number = any (s.term_numbers)
   where extract(isodow from d) = s.day_of_week
     and not exists (
       select 1 from public.no_class_days n
        where n.academic_year_id = s.academic_year_id
          and d::date between n.date_from and n.date_to
     )
  on conflict (schedule_id, session_date) where origin = 'generated' and schedule_id is not null
  do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Create or edit a weekly schedule and (re)generate its sessions.
--  * New schedule: sessions are generated for its whole range; dates before today start as
--    Scheduled (the teacher can bulk-complete them).
--  * Edited schedule: only future Scheduled sessions are replaced. Past sessions are never rewritten.
create or replace function public.save_teaching_schedule(
  p_id         uuid,
  p_subject_id uuid,
  p_section_id uuid,
  p_day        integer,
  p_start      time,
  p_end        time,
  p_eff_start  date,
  p_eff_end    date,
  p_terms      integer[]
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_today date := public.school_today();
  v_year  uuid;
  y       public.academic_years%rowtype;
  v_terms smallint[];
  v_id    uuid;
  v_gen   integer;
begin
  if v_user is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  select academic_year_id into v_year from public.subjects where id = p_subject_id;
  if v_year is null then
    raise exception 'Subject not found.' using errcode = 'no_data_found';
  end if;
  select * into y from public.academic_years where id = v_year;

  if p_day is null or p_day not between 1 and 7 then
    raise exception 'Choose a day of the week.' using errcode = 'check_violation';
  end if;
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'The end time must be after the start time.' using errcode = 'check_violation';
  end if;
  if p_eff_start is null or p_eff_end is null or p_eff_start > p_eff_end then
    raise exception 'The effective end date must not be before the start date.' using errcode = 'check_violation';
  end if;
  if p_eff_start < y.start_date or p_eff_end > y.end_date then
    raise exception 'Effective dates must fall within the academic year (% to %).', y.start_date, y.end_date
      using errcode = 'check_violation';
  end if;

  select array_agg(distinct x::smallint order by x::smallint) into v_terms from unnest(p_terms) as x;
  if v_terms is null or not (v_terms <@ array[1, 2, 3]::smallint[]) then
    raise exception 'Choose at least one term (Term 1, 2 or 3).' using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.subject_sections where subject_id = p_subject_id and section_id = p_section_id
  ) then
    raise exception 'This subject is not assigned to that section. Assign it from the subject first.'
      using errcode = 'check_violation';
  end if;

  if p_id is null then
    insert into public.teaching_schedules
      (user_id, academic_year_id, subject_id, section_id, day_of_week, start_time, end_time,
       effective_start, effective_end, term_numbers)
    values (v_user, v_year, p_subject_id, p_section_id, p_day, p_start, p_end, p_eff_start, p_eff_end, v_terms)
    returning id into v_id;

    v_gen := public.generate_sessions_for_schedule(v_id);
  else
    update public.teaching_schedules
       set subject_id = p_subject_id, section_id = p_section_id, day_of_week = p_day,
           start_time = p_start, end_time = p_end,
           effective_start = p_eff_start, effective_end = p_eff_end, term_numbers = v_terms
     where id = p_id and user_id = v_user and academic_year_id = v_year
    returning id into v_id;
    if v_id is null then
      raise exception 'Schedule not found.' using errcode = 'no_data_found';
    end if;

    delete from public.teaching_sessions
     where schedule_id = v_id and origin = 'generated' and status = 'scheduled' and session_date >= v_today;

    v_gen := public.generate_sessions_for_schedule(v_id, v_today, null);
  end if;

  return jsonb_build_object('id', v_id, 'generated', v_gen);
end;
$$;

-- Deleting a schedule removes its Scheduled sessions; completed / cancelled / rescheduled
-- history is kept (it just no longer points at a schedule).
create or replace function public.delete_teaching_schedule(p_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  select id into v_id from public.teaching_schedules where id = p_id and user_id = v_user;
  if v_id is null then
    raise exception 'Schedule not found.' using errcode = 'no_data_found';
  end if;
  delete from public.teaching_sessions
   where schedule_id = v_id and origin = 'generated' and status = 'scheduled';
  delete from public.teaching_schedules where id = v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- No-class days
-- ---------------------------------------------------------------------------
create or replace function public.add_no_class_day(
  p_year_id uuid, p_from date, p_to date, p_reason text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  y public.academic_years%rowtype;
  v_id uuid;
begin
  select * into y from public.academic_years where id = p_year_id and user_id = v_user;
  if not found then
    raise exception 'Academic year not found.' using errcode = 'no_data_found';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'The last day must not be before the first day.' using errcode = 'check_violation';
  end if;
  if p_from < y.start_date or p_to > y.end_date then
    raise exception 'No-class days must fall within the academic year (% to %).', y.start_date, y.end_date
      using errcode = 'check_violation';
  end if;

  insert into public.no_class_days (user_id, academic_year_id, date_from, date_to, reason)
  values (v_user, p_year_id, p_from, p_to, coalesce(btrim(p_reason), ''))
  returning id into v_id;

  -- Planned classes on those days will not happen. Anything already completed/cancelled/
  -- rescheduled is history and stays.
  delete from public.teaching_sessions
   where academic_year_id = p_year_id and origin = 'generated' and status = 'scheduled'
     and session_date between p_from and p_to;

  return v_id;
end;
$$;

create or replace function public.remove_no_class_day(p_id uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  n public.no_class_days%rowtype;
  s record;
  v_total integer := 0;
begin
  select * into n from public.no_class_days where id = p_id and user_id = auth.uid();
  if not found then
    raise exception 'No-class day not found.' using errcode = 'no_data_found';
  end if;
  delete from public.no_class_days where id = n.id;

  for s in select id from public.teaching_schedules where academic_year_id = n.academic_year_id loop
    v_total := v_total + public.generate_sessions_for_schedule(s.id, n.date_from, n.date_to);
  end loop;
  return v_total;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rescheduling: the original stays (status Rescheduled, never counted); a new Scheduled
-- session is created and linked to it.
-- ---------------------------------------------------------------------------
create or replace function public.reschedule_session(
  p_session_id uuid, p_date date, p_start time, p_end time
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  o public.teaching_sessions%rowtype;
  v_new uuid;
begin
  select * into o from public.teaching_sessions where id = p_session_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Session not found.' using errcode = 'no_data_found';
  end if;
  if o.status <> 'scheduled' then
    raise exception 'Only a Scheduled session can be rescheduled.' using errcode = 'check_violation';
  end if;
  if p_date is null or p_start is null or p_end is null or p_end <= p_start then
    raise exception 'Choose a date and a valid time range.' using errcode = 'check_violation';
  end if;

  insert into public.teaching_sessions
    (user_id, academic_year_id, subject_id, section_id, schedule_id, origin,
     session_date, start_time, end_time, rescheduled_from_id, notes)
  values (o.user_id, o.academic_year_id, o.subject_id, o.section_id, o.schedule_id, 'rescheduled',
          p_date, p_start, p_end, o.id, o.notes)
  returning id into v_new;

  update public.teaching_sessions set status = 'rescheduled' where id = o.id;
  return v_new;
end;
$$;

create or replace function public.undo_reschedule(p_original_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  o public.teaching_sessions%rowtype;
  r public.teaching_sessions%rowtype;
begin
  select * into o from public.teaching_sessions where id = p_original_id and user_id = auth.uid() for update;
  if not found or o.status <> 'rescheduled' then
    raise exception 'This session was not rescheduled.' using errcode = 'check_violation';
  end if;
  select * into r from public.teaching_sessions where rescheduled_from_id = o.id for update;
  if found and r.status <> 'scheduled' then
    raise exception 'The new session is already % and cannot be undone.', r.status
      using errcode = 'check_violation';
  end if;
  delete from public.teaching_sessions where rescheduled_from_id = o.id;
  update public.teaching_sessions set status = 'scheduled' where id = o.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Subjects and sections: atomic save with section assignments; guarded deletes
-- ---------------------------------------------------------------------------
create or replace function public.save_subject(
  p_id uuid, p_year_id uuid, p_name text, p_code text, p_grade text, p_description text,
  p_section_ids uuid[]
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_sections uuid[] := coalesce(p_section_ids, '{}');
begin
  if v_user is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;
  if not exists (select 1 from public.academic_years where id = p_year_id and user_id = v_user) then
    raise exception 'Academic year not found.' using errcode = 'no_data_found';
  end if;

  if p_id is null then
    insert into public.subjects (user_id, academic_year_id, name, code, grade_level, description)
    values (v_user, p_year_id, btrim(p_name), nullif(btrim(coalesce(p_code, '')), ''), p_grade,
            coalesce(btrim(p_description), ''))
    returning id into v_id;
  else
    update public.subjects
       set name = btrim(p_name), code = nullif(btrim(coalesce(p_code, '')), ''),
           grade_level = p_grade, description = coalesce(btrim(p_description), '')
     where id = p_id and user_id = v_user and academic_year_id = p_year_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Subject not found.' using errcode = 'no_data_found';
    end if;
  end if;

  -- Unassigning a section that still has schedules or sessions is refused by foreign keys.
  delete from public.subject_sections
   where subject_id = v_id and section_id <> all (v_sections);

  insert into public.subject_sections (subject_id, section_id, user_id, academic_year_id)
  select v_id, s, v_user, p_year_id from unnest(v_sections) as s
  on conflict do nothing;

  return v_id;
end;
$$;

create or replace function public.delete_subject(p_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_done integer;
begin
  if not exists (select 1 from public.subjects where id = p_id and user_id = v_user) then
    raise exception 'Subject not found.' using errcode = 'no_data_found';
  end if;
  select count(*) into v_done from public.teaching_sessions where subject_id = p_id and status = 'completed';
  if v_done > 0 then
    raise exception 'This subject has % completed session(s), which are part of your reports, so it cannot be deleted.', v_done
      using errcode = 'check_violation';
  end if;
  delete from public.teaching_sessions where subject_id = p_id;
  delete from public.teaching_schedules where subject_id = p_id;
  delete from public.subjects where id = p_id and user_id = v_user;
end;
$$;

create or replace function public.delete_section(p_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_done integer;
begin
  if not exists (select 1 from public.class_sections where id = p_id and user_id = v_user) then
    raise exception 'Section not found.' using errcode = 'no_data_found';
  end if;
  select count(*) into v_done from public.teaching_sessions where section_id = p_id and status = 'completed';
  if v_done > 0 then
    raise exception 'This section has % completed session(s), which are part of your reports, so it cannot be deleted.', v_done
      using errcode = 'check_violation';
  end if;
  delete from public.teaching_sessions where section_id = p_id;
  delete from public.teaching_schedules where section_id = p_id;
  delete from public.class_sections where id = p_id and user_id = v_user;
end;
$$;

-- Copy subjects, sections and their assignments from one academic year to another.
-- Schedules and sessions are never copied. Existing names in the target year are skipped.
create or replace function public.copy_year_classes(p_from uuid, p_to uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_subjects integer;
  v_sections integer;
  v_links integer;
begin
  if p_from = p_to then
    raise exception 'Choose two different academic years.' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.academic_years where id in (p_from, p_to) and user_id = v_user) <> 2 then
    raise exception 'Academic year not found.' using errcode = 'no_data_found';
  end if;

  with ins as (
    insert into public.subjects (user_id, academic_year_id, name, code, grade_level, description)
    select v_user, p_to, name, code, grade_level, description
      from public.subjects where academic_year_id = p_from and user_id = v_user
    on conflict (academic_year_id, grade_level, (lower(btrim(name)))) do nothing
    returning 1
  ) select count(*) into v_subjects from ins;

  with ins as (
    insert into public.class_sections (user_id, academic_year_id, name, grade_level, population, description)
    select v_user, p_to, name, grade_level, population, description
      from public.class_sections where academic_year_id = p_from and user_id = v_user
    on conflict (academic_year_id, grade_level, (lower(btrim(name)))) do nothing
    returning 1
  ) select count(*) into v_sections from ins;

  with ins as (
    insert into public.subject_sections (subject_id, section_id, user_id, academic_year_id)
    select ns.id, nc.id, v_user, p_to
      from public.subject_sections ss
      join public.subjects os on os.id = ss.subject_id
      join public.class_sections oc on oc.id = ss.section_id
      join public.subjects ns on ns.academic_year_id = p_to and ns.user_id = v_user
        and ns.grade_level = os.grade_level and lower(btrim(ns.name)) = lower(btrim(os.name))
      join public.class_sections nc on nc.academic_year_id = p_to and nc.user_id = v_user
        and nc.grade_level = oc.grade_level and lower(btrim(nc.name)) = lower(btrim(oc.name))
     where ss.academic_year_id = p_from and ss.user_id = v_user
    on conflict do nothing
    returning 1
  ) select count(*) into v_links from ins;

  return jsonb_build_object('subjects', v_subjects, 'sections', v_sections, 'assignments', v_links);
end;
$$;

-- ---------------------------------------------------------------------------
-- Editing an academic year must keep every session inside a term. save_academic_year
-- is replaced to re-derive each session's term from the new term dates; a session left
-- outside all terms aborts the whole save with a clear message.
-- ---------------------------------------------------------------------------
create or replace function public.save_academic_year(
  p_year_id uuid,
  p_name    text,
  p_start   date,
  p_end     date,
  p_terms   jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id   uuid;
  v_term jsonb;
begin
  if v_user is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  if jsonb_typeof(p_terms) <> 'array' or jsonb_array_length(p_terms) <> 3 then
    raise exception 'Exactly 3 terms are required.' using errcode = 'check_violation';
  end if;

  if p_year_id is null then
    insert into public.academic_years (user_id, name, start_date, end_date)
    values (v_user, p_name, p_start, p_end)
    returning id into v_id;
  else
    update public.academic_years
       set name = p_name, start_date = p_start, end_date = p_end
     where id = p_year_id and user_id = v_user
    returning id into v_id;

    if v_id is null then
      raise exception 'Academic year not found.' using errcode = 'no_data_found';
    end if;
  end if;

  for v_term in select * from jsonb_array_elements(p_terms) loop
    insert into public.academic_terms (academic_year_id, user_id, term_number, start_date, end_date)
    values (
      v_id, v_user,
      (v_term ->> 'term_number')::smallint,
      (v_term ->> 'start_date')::date,
      (v_term ->> 'end_date')::date
    )
    on conflict (academic_year_id, term_number)
    do update set start_date = excluded.start_date, end_date = excluded.end_date;
  end loop;

  -- No-op update: the session trigger re-derives term_id (or rejects a date outside all terms).
  update public.teaching_sessions set session_date = session_date where academic_year_id = v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-level security: own rows only. The anonymous role gets nothing.
-- ---------------------------------------------------------------------------
alter table public.subjects           enable row level security;
alter table public.class_sections     enable row level security;
alter table public.subject_sections   enable row level security;
alter table public.teaching_schedules enable row level security;
alter table public.no_class_days      enable row level security;
alter table public.teaching_sessions  enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'subjects', 'class_sections', 'subject_sections', 'teaching_schedules',
    'no_class_days', 'teaching_sessions'
  ] loop
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t || '_delete_own', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

revoke execute on function
  public.generate_sessions_for_schedule(uuid, date, date),
  public.save_teaching_schedule(uuid, uuid, uuid, integer, time, time, date, date, integer[]),
  public.delete_teaching_schedule(uuid),
  public.add_no_class_day(uuid, date, date, text),
  public.remove_no_class_day(uuid),
  public.reschedule_session(uuid, date, time, time),
  public.undo_reschedule(uuid),
  public.save_subject(uuid, uuid, text, text, text, text, uuid[]),
  public.delete_subject(uuid),
  public.delete_section(uuid),
  public.copy_year_classes(uuid, uuid)
from anon, public;

grant execute on function
  public.generate_sessions_for_schedule(uuid, date, date),
  public.save_teaching_schedule(uuid, uuid, uuid, integer, time, time, date, date, integer[]),
  public.delete_teaching_schedule(uuid),
  public.add_no_class_day(uuid, date, date, text),
  public.remove_no_class_day(uuid),
  public.reschedule_session(uuid, date, time, time),
  public.undo_reschedule(uuid),
  public.save_subject(uuid, uuid, text, text, text, text, uuid[]),
  public.delete_subject(uuid),
  public.delete_section(uuid),
  public.copy_year_classes(uuid, uuid)
to authenticated;
