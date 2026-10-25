-- Rorker Phase 1: companies, jobs, plans and the plan-reading queue, pins and tasks, job stages.
-- Every row belongs to a company; members of the company can see and change it (RLS).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- companies and people
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_path text,
  brand_color text not null default '#ff6a1f',
  phone text,
  email text,
  license_no text,
  website text,
  address text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create type public.member_role as enum ('owner', 'admin', 'member');

create table public.company_members (
  company_id uuid not null references public.companies on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);
create index on public.company_members (user_id);

create or replace function public.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from company_members where company_id = cid and user_id = auth.uid());
$$;

-- ---------------------------------------------------------------- stage templates
create table public.stage_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies on delete cascade,
  name text not null,
  job_type text not null,
  stages jsonb not null default '[]',  -- [{"name": "Demolition", "description": "..."}]
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.stage_templates (company_id);

-- ---------------------------------------------------------------- jobs
create type public.job_status as enum ('lead', 'active', 'on_hold', 'done');

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies on delete cascade,
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  client_name text,
  client_email text,
  client_phone text,
  job_type text not null default 'renovation',
  status public.job_status not null default 'active',
  start_date date,
  current_plan_id uuid,
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);
create index on public.jobs (company_id);

create type public.stage_status as enum ('not_started', 'active', 'done');

create table public.job_stages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs on delete cascade,
  company_id uuid not null references public.companies on delete cascade,
  position int not null,
  name text not null,
  description text,
  status public.stage_status not null default 'not_started',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.job_stages (job_id, position);

-- ---------------------------------------------------------------- plans and the reading queue
create type public.run_status as enum ('queued', 'running', 'needs_answers', 'done', 'failed');

create table public.plan_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs on delete cascade,
  company_id uuid not null references public.companies on delete cascade,
  kind text not null default 'read' check (kind in ('read', 'answers')),
  file_path text,
  file_name text,
  input jsonb not null default '{}',
  status public.run_status not null default 'queued',
  error text,
  worker text,
  plan_id uuid,
  metrics jsonb not null default '{}',
  created_by uuid references auth.users,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index on public.plan_runs (status, created_at);
create index on public.plan_runs (job_id);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs on delete cascade,
  company_id uuid not null references public.companies on delete cascade,
  version int not null,
  data jsonb not null,
  run_id uuid references public.plan_runs on delete set null,
  created_at timestamptz not null default now(),
  unique (job_id, version)
);

alter table public.jobs add constraint jobs_current_plan_fk
  foreign key (current_plan_id) references public.plans on delete set null;

-- status colour of any plan element (red not built, amber in progress, green done, grey existing)
create type public.element_status as enum ('existing', 'not_built', 'in_progress', 'done', 'demolish');

create table public.element_states (
  job_id uuid not null references public.jobs on delete cascade,
  company_id uuid not null references public.companies on delete cascade,
  element_id text not null,
  status public.element_status not null,
  updated_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  primary key (job_id, element_id)
);

-- ---------------------------------------------------------------- pins and tasks
create type public.pin_kind as enum ('task', 'issue', 'note', 'material');
create type public.pin_status as enum ('open', 'in_progress', 'done');

create table public.pins (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs on delete cascade,
  company_id uuid not null references public.companies on delete cascade,
  number int not null,
  element_id text,               -- plan element (G-R03, 1-W12 ...), null = whole building
  floor_id text,
  x double precision,            -- position on the plan, mm, optional
  y double precision,
  anchor jsonb,                  -- spot outside the floor plans: {"view": "site" | "exterior" | "wall", "side": "G-R04:2", "x": mm, "y": mm}
  kind public.pin_kind not null default 'task',
  title text not null,
  body text,
  status public.pin_status not null default 'open',
  priority int not null default 2 check (priority between 1 and 3),
  due_date date,
  assignee_id uuid references auth.users,
  close_requirement text not null default 'confirm' check (close_requirement in ('confirm', 'photo')),
  stage_id uuid references public.job_stages on delete set null,
  links jsonb not null default '[]',   -- [{"title": "...", "url": "..."}] (shopping list, specs)
  created_by uuid references auth.users,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (job_id, number)
);
create index on public.pins (job_id, element_id);

create table public.pin_comments (
  id uuid primary key default gen_random_uuid(),
  pin_id uuid not null references public.pins on delete cascade,
  company_id uuid not null references public.companies on delete cascade,
  author_id uuid references auth.users,
  body text,
  photos jsonb not null default '[]',  -- storage paths in pin-photos
  created_at timestamptz not null default now()
);
create index on public.pin_comments (pin_id, created_at);

-- pin numbers count up per job (#1, #2 ...)
create or replace function public.next_pin_number() returns trigger
language plpgsql as $$
begin
  if new.number is null then
    select coalesce(max(number), 0) + 1 into new.number from pins where job_id = new.job_id;
  end if;
  return new;
end $$;
create trigger pins_number before insert on public.pins for each row execute function public.next_pin_number();

-- ---------------------------------------------------------------- RLS
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.company_members enable row level security;
alter table public.stage_templates enable row level security;
alter table public.jobs enable row level security;
alter table public.job_stages enable row level security;
alter table public.plan_runs enable row level security;
alter table public.plans enable row level security;
alter table public.element_states enable row level security;
alter table public.pins enable row level security;
alter table public.pin_comments enable row level security;

create policy "members read company" on public.companies for select using (public.is_member(id));
create policy "admins update company" on public.companies for update using (
  exists (select 1 from public.company_members m where m.company_id = id and m.user_id = auth.uid() and m.role in ('owner', 'admin')));

create policy "own profile" on public.profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "teammates read profiles" on public.profiles for select using (
  exists (select 1 from public.company_members a join public.company_members b using (company_id)
          where a.user_id = auth.uid() and b.user_id = profiles.user_id));

create policy "members read members" on public.company_members for select using (public.is_member(company_id));

do $$
declare t text;
begin
  foreach t in array array['stage_templates', 'jobs', 'job_stages', 'plan_runs', 'plans', 'element_states', 'pins', 'pin_comments']
  loop
    execute format('create policy "members all" on public.%I for all using (public.is_member(company_id)) with check (public.is_member(company_id))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- functions
-- Sign-up step 2: create the company, make the caller its owner, seed default stage templates.
create or replace function public.create_company(
  p_name text, p_phone text default null, p_email text default null, p_license text default null,
  p_website text default null, p_color text default '#ff6a1f', p_full_name text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into companies (name, phone, email, license_no, website, brand_color)
    values (p_name, p_phone, p_email, p_license, p_website, coalesce(p_color, '#ff6a1f')) returning id into cid;
  insert into company_members (company_id, user_id, role) values (cid, auth.uid(), 'owner');
  insert into profiles (user_id, full_name) values (auth.uid(), p_full_name)
    on conflict (user_id) do update set full_name = coalesce(excluded.full_name, profiles.full_name);
  insert into stage_templates (company_id, name, job_type, is_default, stages)
  select cid, t.name, t.job_type, true, t.stages from default_stage_templates() t;
  return cid;
end $$;

create or replace function public.default_stage_templates()
returns table (name text, job_type text, stages jsonb) language sql immutable as $$
  values
  ('Full renovation', 'renovation', '[{"name":"Survey and plan"},{"name":"Demolition"},{"name":"Structural and framing"},{"name":"Rough-in: plumbing, electrical, HVAC"},{"name":"Inspection"},{"name":"Insulation and drywall"},{"name":"Finishes: flooring, tile, paint"},{"name":"Fixtures and trim"},{"name":"Punch list"},{"name":"Handover"}]'::jsonb),
  ('Kitchen remodel', 'kitchen', '[{"name":"Design and measure"},{"name":"Demolition"},{"name":"Rough-in: plumbing and electrical"},{"name":"Drywall and paint"},{"name":"Cabinets"},{"name":"Countertops"},{"name":"Backsplash and tile"},{"name":"Appliances and fixtures"},{"name":"Punch list"},{"name":"Handover"}]'::jsonb),
  ('Bathroom remodel', 'bathroom', '[{"name":"Design and measure"},{"name":"Demolition"},{"name":"Rough-in plumbing and electrical"},{"name":"Waterproofing"},{"name":"Tile"},{"name":"Vanity, toilet and fixtures"},{"name":"Glass and accessories"},{"name":"Punch list"},{"name":"Handover"}]'::jsonb),
  ('New build', 'new_build', '[{"name":"Permits"},{"name":"Site work"},{"name":"Foundation"},{"name":"Framing"},{"name":"Roof and windows"},{"name":"Rough-in: plumbing, electrical, HVAC"},{"name":"Inspection"},{"name":"Insulation and drywall"},{"name":"Interior finishes"},{"name":"Exterior finishes"},{"name":"Final inspection"},{"name":"Handover"}]'::jsonb),
  ('Insurance restoration', 'restoration', '[{"name":"Inspection and damage report"},{"name":"Insurance approval"},{"name":"Mitigation and cleanup"},{"name":"Demolition of damaged areas"},{"name":"Structural repairs"},{"name":"Rough-in repairs"},{"name":"Drywall and finishes"},{"name":"Final walkthrough"},{"name":"Closeout with insurer"}]'::jsonb)
$$;

-- Create a job and copy the chosen template's stages onto it.
create or replace function public.create_job(
  p_company uuid, p_name text, p_address text, p_job_type text, p_template uuid,
  p_client_name text default null, p_client_email text default null, p_client_phone text default null,
  p_lat double precision default null, p_lng double precision default null, p_start date default null
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare jid uuid;
begin
  insert into jobs (company_id, name, address, job_type, client_name, client_email, client_phone, lat, lng, start_date, created_by)
    values (p_company, p_name, p_address, coalesce(p_job_type, 'renovation'), p_client_name, p_client_email, p_client_phone, p_lat, p_lng, p_start, auth.uid())
    returning id into jid;
  if p_template is not null then
    insert into job_stages (job_id, company_id, position, name, description)
    select jid, p_company, s.ord, s.value->>'name', s.value->>'description'
    from stage_templates t, jsonb_array_elements(t.stages) with ordinality as s(value, ord)
    where t.id = p_template and t.company_id = p_company;
  end if;
  return jid;
end $$;

-- Worker: take the oldest queued run (safe with several workers).
create or replace function public.claim_plan_run(worker text)
returns setof public.plan_runs
language plpgsql security definer set search_path = public as $$
begin
  return query
  update plan_runs set status = 'running', started_at = now(), worker = claim_plan_run.worker
  where id = (select id from plan_runs where status = 'queued' order by created_at for update skip locked limit 1)
  returning *;
end $$;
revoke execute on function public.claim_plan_run(text) from public, anon, authenticated;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public) values
  ('plan-files', 'plan-files', false),
  ('company-assets', 'company-assets', true),
  ('pin-photos', 'pin-photos', false)
on conflict (id) do nothing;

-- objects are stored under <company_id>/...
create policy "members use plan files" on storage.objects for all
  using (bucket_id in ('plan-files', 'pin-photos', 'company-assets') and public.is_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id in ('plan-files', 'pin-photos', 'company-assets') and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "public logos" on storage.objects for select using (bucket_id = 'company-assets');

-- live updates for the plan screen
alter publication supabase_realtime add table public.plan_runs, public.pins, public.element_states, public.pin_comments;
