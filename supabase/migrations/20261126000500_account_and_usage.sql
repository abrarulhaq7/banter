-- Phase 7: deleting an account, and the usage view.

-- ---------------------------------------------------------------------------------------
-- Delete my account
-- ---------------------------------------------------------------------------------------
-- Removes the signed-in user's login. Every user table hangs off auth.users with
-- "on delete cascade", so the profile, keys, tones, people, interactions and lines go with
-- it. Screenshots are files, not rows: the app deletes those first.
--
-- The function runs with its owner's rights because a user cannot touch auth.users
-- directly. It can only ever delete the caller: there is no argument to point it elsewhere.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;
comment on function public.delete_my_account() is
  'Deletes the signed-in user and, by cascade, every row they own. Called by Settings > Your data.';

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- Usage: how many generations per provider, model and key
-- ---------------------------------------------------------------------------------------
-- Counted in the database, so the numbers are exact however long the history is.
-- security_invoker: the view is read with the caller's own rights, so the row-level
-- security on interactions applies and a user sees only their own counts.
create view public.usage_summary
with (security_invoker = true) as
select
  user_id,
  provider,
  model,
  -- The key's name at the time. Null when no name was recorded.
  api_key_label as key_label,
  count(*)::integer as generations,
  (count(*) filter (where created_at >= date_trunc('month', now())))::integer as this_month,
  max(created_at) as last_used_at
from public.interactions
group by user_id, provider, model, api_key_label;
comment on view public.usage_summary is
  'Generations per provider, model and key, for the signed-in user. Read by Settings > Your data > Usage.';

revoke all on public.usage_summary from public, anon, authenticated;
grant select on public.usage_summary to authenticated;
grant all on public.usage_summary to service_role;
