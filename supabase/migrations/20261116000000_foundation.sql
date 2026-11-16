-- Teacher Workspace — M0 foundation schema
-- Profiles, user settings, academic years and exactly three academic terms per year.
-- Every teacher-owned table has RLS enabled and policies scoped to auth.uid().

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (one row per auth user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  job_title   text not null default 'Teacher' check (char_length(job_title) <= 80),
  school_name text not null default '' check (char_length(school_name) <= 160),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_settings (one row per auth user)
-- ---------------------------------------------------------------------------
create table public.user_settings (
  user_id                 uuid primary key references auth.users (id) on delete cascade,
  selected_academic_year_id uuid,  -- FK added below, after academic_years exists
  notify_upcoming_sessions boolean not null default true,
  notify_upcoming_events   boolean not null default true,
  notify_task_deadlines    boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- Create profile + settings automatically when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));

  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- academic_years
-- ---------------------------------------------------------------------------
create table public.academic_years (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 40),
  start_date date not null,
  end_date   date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_years_dates_valid check (start_date < end_date),
  constraint academic_years_user_name_unique unique (user_id, name),
  -- Lets terms reference (id, user_id) so a term can never belong to another teacher.
  constraint academic_years_id_user_unique unique (id, user_id)
);

create index academic_years_user_idx on public.academic_years (user_id, start_date desc);

create trigger academic_years_set_updated_at
  before update on public.academic_years
  for each row execute function public.set_updated_at();

alter table public.user_settings
  add constraint user_settings_selected_year_fk
  foreign key (selected_academic_year_id, user_id)
  references public.academic_years (id, user_id)
  on delete set null (selected_academic_year_id);

-- ---------------------------------------------------------------------------
-- academic_terms — DepEd three-term structure (Term 1..3, never quarters)
-- ---------------------------------------------------------------------------
create table public.academic_terms (
  id               uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null,
  user_id          uuid not null,
  term_number      smallint not null check (term_number between 1 and 3),
  start_date       date not null,
  end_date         date not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint academic_terms_dates_valid check (start_date <= end_date),
  constraint academic_terms_year_number_unique unique (academic_year_id, term_number),
  constraint academic_terms_year_fk
    foreign key (academic_year_id, user_id)
    references public.academic_years (id, user_id) on delete cascade,
  -- No two terms of the same year may overlap. Deferred so that dates can be
  -- shifted across several rows inside one transaction.
  constraint academic_terms_no_overlap
    exclude using gist (
      academic_year_id with =,
      daterange(start_date, end_date, '[]') with &&
    ) deferrable initially deferred
);

create index academic_terms_user_idx on public.academic_terms (user_id);

create trigger academic_terms_set_updated_at
  before update on public.academic_terms
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Integrity: every academic year has exactly three terms, numbered 1..3,
-- in chronological order, all inside the year's own date range.
-- Checked at COMMIT so a year and its terms can be written in one transaction.
-- ---------------------------------------------------------------------------
create or replace function public.check_academic_year_terms()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_year_id uuid;
  v_year    public.academic_years%rowtype;
  v_count   int;
  v_t1 public.academic_terms%rowtype;
  v_t2 public.academic_terms%rowtype;
  v_t3 public.academic_terms%rowtype;
begin
  v_year_id := case tg_table_name
    when 'academic_years' then coalesce(new.id, old.id)
    else coalesce(new.academic_year_id, old.academic_year_id)
  end;

  select * into v_year from public.academic_years where id = v_year_id;
  if not found then
    return null; -- year was deleted; terms cascade with it
  end if;

  select count(*) into v_count from public.academic_terms where academic_year_id = v_year_id;
  if v_count <> 3 then
    raise exception 'Academic year "%" must have exactly 3 terms (found %).', v_year.name, v_count
      using errcode = 'check_violation';
  end if;

  select * into v_t1 from public.academic_terms where academic_year_id = v_year_id and term_number = 1;
  select * into v_t2 from public.academic_terms where academic_year_id = v_year_id and term_number = 2;
  select * into v_t3 from public.academic_terms where academic_year_id = v_year_id and term_number = 3;

  if v_t1.start_date < v_year.start_date or v_t3.end_date > v_year.end_date then
    raise exception 'Terms of academic year "%" must fall within %–%.',
      v_year.name, v_year.start_date, v_year.end_date
      using errcode = 'check_violation';
  end if;

  if not (v_t1.end_date < v_t2.start_date and v_t2.end_date < v_t3.start_date) then
    raise exception 'Terms of academic year "%" must be in order (Term 1, then 2, then 3) without overlapping.',
      v_year.name
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

create constraint trigger academic_years_require_three_terms
  after insert or update on public.academic_years
  deferrable initially deferred
  for each row execute function public.check_academic_year_terms();

create constraint trigger academic_terms_require_valid_set
  after insert or update or delete on public.academic_terms
  deferrable initially deferred
  for each row execute function public.check_academic_year_terms();

-- ---------------------------------------------------------------------------
-- save_academic_year: atomic create/update of a year and its three terms.
-- SECURITY INVOKER (default) so RLS still applies to every statement.
-- p_terms: [{"term_number":1,"start_date":"...","end_date":"..."}, x3]
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

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-level security: a teacher can only ever see and change their own rows.
-- ---------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.user_settings  enable row level security;
alter table public.academic_years enable row level security;
alter table public.academic_terms enable row level security;

-- profiles: created by trigger; users may read and update only their own row.
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- user_settings
create policy user_settings_select_own on public.user_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy user_settings_update_own on public.user_settings
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- academic_years
create policy academic_years_select_own on public.academic_years
  for select to authenticated using (user_id = (select auth.uid()));
create policy academic_years_insert_own on public.academic_years
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy academic_years_update_own on public.academic_years
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy academic_years_delete_own on public.academic_years
  for delete to authenticated using (user_id = (select auth.uid()));

-- academic_terms
create policy academic_terms_select_own on public.academic_terms
  for select to authenticated using (user_id = (select auth.uid()));
create policy academic_terms_insert_own on public.academic_terms
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy academic_terms_update_own on public.academic_terms
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy academic_terms_delete_own on public.academic_terms
  for delete to authenticated using (user_id = (select auth.uid()));

-- Anonymous visitors get nothing; signed-in users only what RLS allows.
revoke all on public.profiles, public.user_settings, public.academic_years, public.academic_terms
  from anon;
revoke all on function public.save_academic_year(uuid, text, date, date, jsonb) from anon, public;
grant execute on function public.save_academic_year(uuid, text, date, date, jsonb) to authenticated;
