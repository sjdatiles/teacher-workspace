-- Self-service account deletion. The app never holds Supabase's secret (service_role) key, so the
-- deletion is a narrow SECURITY DEFINER function that can only remove the *caller's own* user.
-- Every teacher table references auth.users with ON DELETE CASCADE, so all of the teacher's data
-- (profile, settings, years, terms, subjects, sections, schedules, sessions, events, tasks,
-- resources, notification states) is removed with the user.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Not signed in.';
  end if;
  delete from auth.users where id = v_user;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
