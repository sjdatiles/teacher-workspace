-- Teacher Workspace — M5: Resources (links only — no files are uploaded or stored)

-- Per-teacher folders. The six default folders are created once per teacher by
-- ensure_resource_categories(); after that the teacher owns them (rename, delete, add).
create table public.resource_categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resource_categories_id_user_unique unique (id, user_id)
);
create unique index resource_categories_name_unique on public.resource_categories (user_id, lower(btrim(name)));
create trigger resource_categories_set_updated_at before update on public.resource_categories
  for each row execute function public.set_updated_at();

alter table public.user_settings add column resource_categories_seeded boolean not null default false;

-- Lets resources point at a subject with an ownership-checked foreign key.
alter table public.subjects add constraint subjects_id_user_unique unique (id, user_id);

create table public.resource_links (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  title         text not null check (char_length(btrim(title)) between 1 and 160),
  -- Only web links: http(s), no whitespace. Rejects javascript:, data:, file: and the like.
  url           text not null check (char_length(url) <= 2000 and url ~* '^https?://[^\s/$.?#][^\s]*$'),
  description   text not null default '' check (char_length(description) <= 500),
  resource_type text not null default 'website'
    check (resource_type in ('website', 'google_drive', 'document', 'video', 'reference', 'other')),
  category_id   uuid,
  subject_id    uuid,
  tags          text[] not null default '{}',
  is_favorite   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint resource_links_category_fk foreign key (category_id, user_id)
    references public.resource_categories (id, user_id) on delete set null (category_id),
  constraint resource_links_subject_fk foreign key (subject_id, user_id)
    references public.subjects (id, user_id) on delete set null (subject_id)
);
create index resource_links_user_created_idx on public.resource_links (user_id, created_at desc);
create index resource_links_category_idx on public.resource_links (user_id, category_id);
create index resource_links_subject_idx on public.resource_links (user_id, subject_id) where subject_id is not null;
create index resource_links_favorite_idx on public.resource_links (user_id) where is_favorite;
create trigger resource_links_set_updated_at before update on public.resource_links
  for each row execute function public.set_updated_at();

-- Tags are kept tidy by the database: trimmed, lower-case, no blanks, no duplicates,
-- at most 10 per link and 30 characters each.
create or replace function public.resource_links_clean_tags()
returns trigger
language plpgsql
set search_path = ''
as $$
declare cleaned text[];
begin
  select coalesce(array_agg(t order by first_pos), '{}')
    into cleaned
    from (select t, min(ord) as first_pos
            from (select lower(btrim(x)) as t, ord from unnest(new.tags) with ordinality as u(x, ord)) s
           where t <> ''
           group by t) d;
  if cardinality(cleaned) > 10 then
    raise exception 'A link can have at most 10 tags' using errcode = '23514';
  end if;
  if exists (select 1 from unnest(cleaned) t where char_length(t) > 30) then
    raise exception 'A tag can be at most 30 characters' using errcode = '23514';
  end if;
  new.tags := cleaned;
  return new;
end;
$$;
create trigger resource_links_clean_tags before insert or update on public.resource_links
  for each row execute function public.resource_links_clean_tags();

-- Creates the default folders the first time a teacher opens Resources. Runs as the teacher
-- (SECURITY INVOKER), so row-level security still applies, and runs at most once per teacher.
create or replace function public.ensure_resource_categories()
returns void
language plpgsql
set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then return; end if;
  if exists (select 1 from public.user_settings where user_id = uid and resource_categories_seeded) then
    return;
  end if;
  insert into public.resource_categories (user_id, name)
  select uid, n from unnest(array['Lesson Materials', 'Teaching References', 'Curriculum Resources',
                                  'Online Tools', 'Assessment Resources', 'Other']) as n
  on conflict do nothing;
  update public.user_settings set resource_categories_seeded = true where user_id = uid;
end;
$$;
revoke all on function public.ensure_resource_categories() from public, anon;
grant execute on function public.ensure_resource_categories() to authenticated;

alter table public.resource_categories enable row level security;
create policy resource_categories_select_own on public.resource_categories for select to authenticated using (user_id = (select auth.uid()));
create policy resource_categories_insert_own on public.resource_categories for insert to authenticated with check (user_id = (select auth.uid()));
create policy resource_categories_update_own on public.resource_categories for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy resource_categories_delete_own on public.resource_categories for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.resource_categories from anon;

alter table public.resource_links enable row level security;
create policy resource_links_select_own on public.resource_links for select to authenticated using (user_id = (select auth.uid()));
create policy resource_links_insert_own on public.resource_links for insert to authenticated with check (user_id = (select auth.uid()));
create policy resource_links_update_own on public.resource_links for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy resource_links_delete_own on public.resource_links for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.resource_links from anon;
