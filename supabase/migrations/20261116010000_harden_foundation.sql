-- Hardening found by Supabase's security advisor after applying the foundation migration.

-- handle_new_user() is only meant to run as an auth.users trigger. Triggers do not need
-- EXECUTE privileges on the calling role, so remove public/RPC access to it.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Keep extensions out of the exposed public schema.
create schema if not exists extensions;
alter extension btree_gist set schema extensions;
