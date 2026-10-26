-- A person's own link: everything tagged to them on every job of the company, not just one job.
-- It has no job_id. Each person has at most one live one, so the same link can be copied from any
-- task they're tagged on.
alter table public.share_links alter column job_id drop not null;
create index on public.share_links (company_id);
create unique index share_links_one_per_person on public.share_links (company_id, member_id)
  where job_id is null and revoked_at is null;
