-- "Shared with you": a signed-in person keeps a link they were sent in their own account.
-- The `build` edge function writes one `access` row in the link owner's account for each person who
-- saved the link (who they are, when). The owner's admins read them like any other row (to see whose
-- account a link is in); the person's own list is read by the function, looked up by their user id.
create index records_access_user on public.records ((data->>'user_id')) where kind = 'access';
