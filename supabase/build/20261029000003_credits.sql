-- Credits and plans for the build site.
--
--   * homeowners (consumer accounts) pay only in credits; contractors, property managers and builders
--     (business accounts) have a monthly plan tier that comes with credits and limits plans, floors and
--     square feet;
--   * an account's credits are its history: every change is one line in `credit_ledger` (bought, used,
--     the plan's monthly credits, welcome and referral bonuses), and the balance is the sum;
--   * people read their own account's plan and history. Nobody writes them from the page: the `credits`
--     edge function does, with the same rules and prices the page shows (web/src/lib/credits/), and
--     `credit_add` takes a lock so two spends at once can't both pass on the same credits.

create table public.credit_plans (
  account_id uuid primary key references public.accounts on delete cascade,
  kind text not null check (kind in ('consumer', 'business')),
  tier text not null default 'free' check (tier ~ '^[a-z_]{1,24}$'),
  period_start timestamptz not null default now(),
  -- the payment provider's ids, once there is one (Stripe customer and subscription)
  customer_ref text,
  subscription_ref text,
  updated_at timestamptz not null default now()
);

create table public.credit_ledger (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.accounts on delete cascade,
  delta integer not null,
  reason text not null check (reason in ('welcome', 'allowance', 'expired', 'purchase', 'spend', 'referral', 'refund')),
  action text check (action ~ '^[a-z_0-9]{1,32}$'),
  -- what the line is for, so it's only ever added once (a month's plan credits, a payment, a spend)
  ref text check (length(ref) between 1 and 120),
  note text check (length(note) <= 200),
  created_at timestamptz not null default now()
);
create index credit_ledger_account on public.credit_ledger (account_id, created_at);
create unique index credit_ledger_once on public.credit_ledger (account_id, ref) where ref is not null;

alter table public.credit_plans enable row level security;
alter table public.credit_ledger enable row level security;

create policy "members read their plan" on public.credit_plans for select to authenticated
  using (exists (select 1 from public.account_users u where u.account_id = credit_plans.account_id and u.user_id = (select auth.uid())));
create policy "members read their credits" on public.credit_ledger for select to authenticated
  using (exists (select 1 from public.account_users u where u.account_id = credit_ledger.account_id and u.user_id = (select auth.uid())));

-- Add one line, if the account has the credits for it (a spend) or always (a grant). Returns the new
-- balance, or null when there weren't enough credits. A ref already used returns the balance unchanged.
create function public.credit_add(a uuid, d integer, why text, what text default null, r text default null, words text default null, must_cover boolean default false)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  bal integer;
begin
  perform pg_advisory_xact_lock(hashtext('credits:' || a::text));
  select coalesce(sum(delta), 0) into bal from public.credit_ledger where account_id = a;
  if r is not null and exists (select 1 from public.credit_ledger where account_id = a and ref = r) then return bal; end if;
  if must_cover and d < 0 and bal + d < 0 then return null; end if;
  insert into public.credit_ledger (account_id, delta, reason, action, ref, note) values (a, d, why, what, r, words);
  return bal + d;
end $$;
revoke execute on function public.credit_add(uuid, integer, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.credit_add(uuid, integer, text, text, text, text, boolean) to service_role;
