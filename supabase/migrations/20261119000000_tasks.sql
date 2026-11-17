-- Teacher Workspace — M4: Tasks & Responsibilities
-- Tasks are separate from teaching sessions: completing a task never counts toward
-- teaching accomplishment reports.

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 160),
  description  text not null default '' check (char_length(description) <= 1000),
  category     text not null
    check (category in ('teaching', 'administrative', 'school_activities', 'personal', 'other')),
  status       text not null default 'todo'
    check (status in ('todo', 'in_progress', 'for_review', 'completed')),
  priority     text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date     date,
  notes        text not null default '' check (char_length(notes) <= 1000),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint tasks_completed_at_matches check ((status = 'completed') = (completed_at is not null))
);
create index tasks_user_status_idx on public.tasks (user_id, status);
create index tasks_user_due_idx on public.tasks (user_id, due_date) where status <> 'completed';

create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- completed_at is kept by the database: set when a task becomes Completed, cleared when reopened.
create or replace function public.tasks_track_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'completed' then
    if tg_op = 'INSERT' or old.status <> 'completed' then
      new.completed_at := now();
    else
      new.completed_at := old.completed_at;
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;
create trigger tasks_track_completion before insert or update on public.tasks
  for each row execute function public.tasks_track_completion();

alter table public.tasks enable row level security;
create policy tasks_select_own on public.tasks for select to authenticated using (user_id = (select auth.uid()));
create policy tasks_insert_own on public.tasks for insert to authenticated with check (user_id = (select auth.uid()));
create policy tasks_update_own on public.tasks for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy tasks_delete_own on public.tasks for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.tasks from anon;
