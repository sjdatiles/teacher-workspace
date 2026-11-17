-- Teacher Workspace — M3: Calendar & Planner
-- Manually created events (meetings, school activities, deadlines, personal, other) with
-- optional repeating, plus per-occurrence changes ("exceptions") for repeating events.
-- Teaching sessions are NOT copied here: the calendar reads them from teaching_sessions,
-- so there is one record per class meeting and no duplicate calendar entries.

create table public.calendar_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  title           text not null check (char_length(btrim(title)) between 1 and 120),
  description     text not null default '' check (char_length(description) <= 1000),
  category        text not null
    check (category in ('meeting', 'school_activity', 'deadline', 'personal', 'other')),
  color           text check (color is null or color in ('orange', 'blue', 'green', 'amber', 'red', 'violet')),
  start_date      date not null,
  end_date        date not null,
  start_time      time,            -- null start and end = all-day
  end_time        time,
  location        text not null default '' check (char_length(location) <= 120),
  notes           text not null default '' check (char_length(notes) <= 1000),
  -- Reminder: minutes before the start (0 = at the start). Shown as notifications in M7.
  reminder_minutes integer check (reminder_minutes is null or reminder_minutes between 0 and 10080),
  repeat_freq     text not null default 'none' check (repeat_freq in ('none', 'daily', 'weekly', 'monthly')),
  repeat_interval smallint not null default 1 check (repeat_interval between 1 and 12),
  repeat_until    date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint calendar_events_dates_valid check (end_date >= start_date),
  constraint calendar_events_times_pair check ((start_time is null) = (end_time is null)),
  constraint calendar_events_times_valid
    check (start_time is null or end_date > start_date or end_time > start_time),
  -- A repeating event must end; at most two years, which keeps every calendar query bounded.
  constraint calendar_events_repeat_valid check (
    (repeat_freq = 'none' and repeat_until is null)
    or (repeat_freq <> 'none' and repeat_until is not null
        and repeat_until >= start_date and repeat_until <= start_date + 731)
  ),
  constraint calendar_events_id_user_unique unique (id, user_id)
);
create index calendar_events_user_dates_idx on public.calendar_events (user_id, start_date, end_date);
create index calendar_events_user_repeat_idx on public.calendar_events (user_id, repeat_until)
  where repeat_freq <> 'none';
create trigger calendar_events_set_updated_at before update on public.calendar_events
  for each row execute function public.set_updated_at();

-- One row per changed or skipped occurrence of a repeating event.
-- occurrence_date is the date the occurrence would normally start on.
create table public.calendar_event_exceptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  event_id        uuid not null,
  occurrence_date date not null,
  cancelled       boolean not null default false,
  -- Overrides (used when cancelled = false). Times null = all-day.
  title           text check (title is null or char_length(btrim(title)) between 1 and 120),
  description     text not null default '' check (char_length(description) <= 1000),
  start_date      date,
  end_date        date,
  start_time      time,
  end_time        time,
  location        text not null default '' check (char_length(location) <= 120),
  notes           text not null default '' check (char_length(notes) <= 1000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint calendar_exceptions_event_fk foreign key (event_id, user_id)
    references public.calendar_events (id, user_id) on delete cascade,
  constraint calendar_exceptions_unique unique (event_id, occurrence_date),
  constraint calendar_exceptions_complete check (
    cancelled or (title is not null and start_date is not null and end_date is not null)
  ),
  constraint calendar_exceptions_dates_valid check (end_date is null or end_date >= start_date),
  constraint calendar_exceptions_times_pair check ((start_time is null) = (end_time is null)),
  constraint calendar_exceptions_times_valid
    check (start_time is null or end_date > start_date or end_time > start_time)
);
create index calendar_exceptions_event_idx on public.calendar_event_exceptions (event_id);
create trigger calendar_exceptions_set_updated_at before update on public.calendar_event_exceptions
  for each row execute function public.set_updated_at();

-- Changing what defines the series (first date, frequency or interval) moves every
-- occurrence, so single-occurrence changes would no longer line up: drop them.
create or replace function public.reset_exceptions_on_series_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.start_date, new.repeat_freq, new.repeat_interval)
     is distinct from (old.start_date, old.repeat_freq, old.repeat_interval) then
    delete from public.calendar_event_exceptions where event_id = new.id;
  end if;
  return new;
end;
$$;
create trigger calendar_events_reset_exceptions
  after update on public.calendar_events
  for each row execute function public.reset_exceptions_on_series_change();

-- Row-level security: own rows only; nothing for anonymous visitors.
alter table public.calendar_events enable row level security;
alter table public.calendar_event_exceptions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['calendar_events', 'calendar_event_exceptions'] loop
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t || '_delete_own', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
