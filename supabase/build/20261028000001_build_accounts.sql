-- Real accounts and saved data for the build site (build.rorker.com).
--
-- The build site is one static page, so it keeps each job the way its screens already hold it: one row
-- per thing (a job, its plan, each pin, stage, wall item, material line, team member, share link, the
-- job's money) with the thing itself as JSON. Ids are the page's own, unique within an account.
--
-- Who sees what:
--   * the contractor's admins sign in and read and write everything in their account (row-level security);
--   * crew (employees and subs) and the contractor's clients open no-sign-in links. They never read these
--     tables: the `build` edge function opens the link and hands back only what that link may show
--     (crew: the plan and their tasks, never money or client details; clients: their job's progress and
--     their quotes, invoices and receipts, never crew details or costs).
--
-- These tables are separate from supabase/migrations (the full app's schema), which isn't on the live
-- project yet.

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  created_by uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

-- who can sign in to an account, and as which team member
create table public.account_users (
  account_id uuid not null references public.accounts on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  member_id text not null,
  role text not null check (role in ('admin', 'employee')),
  created_at timestamptz not null default now(),
  primary key (account_id, user_id)
);
create index account_users_user on public.account_users (user_id);

create table public.records (
  account_id uuid not null references public.accounts on delete cascade,
  -- job, plan, pin, stage, item, edits, states, run, billing, material, member, share, comment, settings
  kind text not null check (kind ~ '^[a-z_]{1,24}$'),
  id text not null check (length(id) between 1 and 80),
  job_id text,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (account_id, kind, id)
);
create index records_job on public.records (account_id, job_id);
create unique index records_share_token on public.records ((data->>'token')) where kind = 'share';

create function public.is_account_admin(a uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.account_users u where u.account_id = a and u.user_id = (select auth.uid()) and u.role = 'admin');
$$;

-- the first folder of a stored file is its account id
create function public.is_account_admin_path(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when p ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then public.is_account_admin(p::uuid) else false end;
$$;

alter table public.accounts enable row level security;
alter table public.account_users enable row level security;
alter table public.records enable row level security;

create policy "members read their account" on public.accounts for select to authenticated
  using (exists (select 1 from public.account_users u where u.account_id = id and u.user_id = (select auth.uid())));
create policy "admins rename their account" on public.accounts for update to authenticated
  using (public.is_account_admin(id)) with check (public.is_account_admin(id));

create policy "people see their own sign-ins, admins see the account's" on public.account_users for select to authenticated
  using (user_id = (select auth.uid()) or public.is_account_admin(account_id));

create policy "admins read records" on public.records for select to authenticated using (public.is_account_admin(account_id));
create policy "admins add records" on public.records for insert to authenticated with check (public.is_account_admin(account_id));
create policy "admins change records" on public.records for update to authenticated using (public.is_account_admin(account_id)) with check (public.is_account_admin(account_id));
create policy "admins delete records" on public.records for delete to authenticated using (public.is_account_admin(account_id));

-- A new contractor account, with the signed-in person as its owner (an admin). One per person for now:
-- asking again hands back the one they have.
create function public.create_account(account_name text, owner_member text default 'm0') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  found uuid;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  select account_id into found from public.account_users where user_id = me order by created_at limit 1;
  if found is not null then return found; end if;
  insert into public.accounts (name, created_by) values (coalesce(nullif(trim(account_name), ''), 'My company'), me) returning id into found;
  insert into public.account_users (account_id, user_id, member_id, role) values (found, me, owner_member, 'admin');
  return found;
end $$;
revoke execute on function public.create_account(text, text) from public, anon;
grant execute on function public.create_account(text, text) to authenticated;

-- photos, plan files and other uploads: build-files/<account id>/<job id>/...
insert into storage.buckets (id, name, public, file_size_limit) values ('build-files', 'build-files', false, 52428800)
  on conflict (id) do nothing;
create policy "admins read their files" on storage.objects for select to authenticated
  using (bucket_id = 'build-files' and public.is_account_admin_path((storage.foldername(name))[1]));
create policy "admins add files" on storage.objects for insert to authenticated
  with check (bucket_id = 'build-files' and public.is_account_admin_path((storage.foldername(name))[1]));
create policy "admins change files" on storage.objects for update to authenticated
  using (bucket_id = 'build-files' and public.is_account_admin_path((storage.foldername(name))[1]));
create policy "admins delete files" on storage.objects for delete to authenticated
  using (bucket_id = 'build-files' and public.is_account_admin_path((storage.foldername(name))[1]));

-- the checks above are only for signed-in people (they run inside the security rules)
revoke execute on function public.is_account_admin(uuid) from public, anon;
revoke execute on function public.is_account_admin_path(text) from public, anon;
grant execute on function public.is_account_admin(uuid) to authenticated;
grant execute on function public.is_account_admin_path(text) to authenticated;
