-- Shared job links: a team member or a one-time sub opens a job without signing in and sees the plan
-- plus only the pins that are theirs. The app reads a link by its token with the service key and cuts
-- the job down to that scope in code (web/src/lib/share.ts); nothing here is readable without signing in.
create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs on delete cascade,
  company_id uuid not null references public.companies on delete cascade,
  token text not null unique,          -- 24 random bytes, base64url
  label text not null,                 -- who it's for: "Marco (electrician)", "Ace Drywall"
  member_id uuid references public.company_members on delete cascade,  -- their tagged pins, now and later
  pin_ids uuid[] not null default '{}',  -- plus these pins (a one-time sub with no team row)
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);
create index on public.share_links (job_id);

alter table public.share_links enable row level security;
create policy "members read links" on public.share_links for select using (public.is_member(company_id));
create policy "admins make links" on public.share_links for insert with check (public.is_admin(company_id));
create policy "admins revoke links" on public.share_links for update using (public.is_admin(company_id)) with check (public.is_admin(company_id));
create policy "admins delete links" on public.share_links for delete using (public.is_admin(company_id));
