-- Feedback: tickets the user sends from the app ("these lines are off", "this wording is
-- wrong", "this broke"), with everything needed to fix it attached by the app.
--
-- A user adds tickets and sees only their own. The email is filled in from their login by
-- the database, so it cannot be made up. Admins (a short list kept here, filled in by hand
-- in the SQL editor) can read every ticket, see the screenshot of a reported set, and mark
-- tickets resolved. Nobody can make themselves an admin from the app.

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
comment on table public.admins is
  'Accounts that can read and resolve every feedback ticket. Added by hand in the SQL editor only.';
alter table public.admins enable row level security;
-- New tables get every right by default; take them away first, then grant what is needed.
revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;
grant all on public.admins to service_role;
create policy "admins: see own row" on public.admins for select to authenticated
  using (user_id = auth.uid());

-- Whether the signed-in user is an admin. Security definer, so the check works whatever
-- the admins table lets the caller see.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Filled in from the login by the trigger below, never by the app.
  email text check (char_length(email) <= 320),
  kind text not null check (kind in ('lines', 'wording', 'bug', 'idea')),
  message text not null default '' check (char_length(message) <= 4000),
  -- What the app attaches: where it was sent from, the app and phone, and for a set of
  -- lines the options, the model, the lines with their marks, and the request sent.
  context jsonb not null default '{}'::jsonb
    check (jsonb_typeof(context) = 'object' and pg_column_size(context) <= 200000),
  -- The screenshot the ticket is about, in the user's own folder of the screenshots bucket.
  screenshot_path text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolution text check (char_length(resolution) <= 2000),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (screenshot_path is null or screenshot_path like user_id::text || '/%')
);
comment on table public.feedback is
  'Tickets sent from the app, with the context needed to fix them. Users see their own; admins see all.';
create index feedback_email_idx on public.feedback (lower(email), created_at desc);
alter table public.feedback enable row level security;

-- The email always comes from the login.
create function public.feedback_set_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email := (select email from auth.users where id = new.user_id);
  return new;
end;
$$;
revoke all on function public.feedback_set_email() from public;
create trigger feedback_set_email before insert on public.feedback
  for each row execute function public.feedback_set_email();

revoke all on public.feedback from anon, authenticated;
grant select, insert on public.feedback to authenticated;
-- Only these columns can ever change, and only by an admin (policy below).
grant update (status, resolution, resolved_at) on public.feedback to authenticated;
grant all on public.feedback to service_role;

create policy "feedback: users add their own" on public.feedback for insert to authenticated
  with check (user_id = auth.uid() and status = 'open' and resolution is null and resolved_at is null);
create policy "feedback: users see their own, admins see all" on public.feedback for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "feedback: admins resolve" on public.feedback for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- An admin can open the screenshot of a reported set, and no other screenshot.
create policy "screenshots: admins read reported ones" on storage.objects for select to authenticated
  using (
    bucket_id = 'screenshots'
    and public.is_admin()
    and exists (select 1 from public.feedback where feedback.screenshot_path = objects.name)
  );
