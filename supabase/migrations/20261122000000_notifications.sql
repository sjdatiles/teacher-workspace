-- Teacher Workspace — M7: notifications
-- Notifications themselves are worked out on demand from the teacher's real sessions, events
-- (and their reminders) and tasks, so they can never go stale or contradict the records.
-- This table only remembers which ones the teacher has read or dismissed.
-- `key` identifies one notification, e.g. 'task-overdue:<task id>' or 'event:<event id>:2026-11-20'.

create table public.notification_states (
  user_id    uuid not null references auth.users (id) on delete cascade,
  key        text not null check (char_length(key) between 3 and 200),
  state      text not null check (state in ('read', 'dismissed')),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
create index notification_states_updated_idx on public.notification_states (user_id, updated_at);

alter table public.notification_states enable row level security;
create policy notification_states_select_own on public.notification_states for select to authenticated using (user_id = (select auth.uid()));
create policy notification_states_insert_own on public.notification_states for insert to authenticated with check (user_id = (select auth.uid()));
create policy notification_states_update_own on public.notification_states for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notification_states_delete_own on public.notification_states for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.notification_states from anon;
