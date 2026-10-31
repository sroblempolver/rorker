-- Early-access sign-ups from rorker.com. Anyone can add themselves; nobody can read the list through the
-- API (read it in the Supabase dashboard or with the service key).
create table if not exists public.early_access (
  id uuid primary key default gen_random_uuid(),
  email text not null check (length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  name text check (length(name) <= 120),
  company text check (length(company) <= 160),
  trade text check (length(trade) <= 60),
  crew_size text check (length(crew_size) <= 20),
  source text not null default 'rorker.com' check (length(source) <= 60),
  created_at timestamptz not null default now()
);
create unique index if not exists early_access_email on public.early_access (lower(email));
alter table public.early_access enable row level security;
drop policy if exists "anyone can sign up" on public.early_access;
create policy "anyone can sign up" on public.early_access for insert to anon, authenticated with check (true);
grant insert on public.early_access to anon, authenticated;
