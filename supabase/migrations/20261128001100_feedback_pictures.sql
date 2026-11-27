-- Feedback pictures: up to three pictures of the user's own with a ticket (a screenshot of
-- the problem, say), next to the screenshot of a reported set.
--
-- Like that screenshot they live in the user's own folder of the screenshots bucket, named
-- after the ticket, and an admin can open them because a ticket points to them.

-- Whether a ticket's pictures are allowed: at most three, all in the sender's own folder.
-- (A check cannot hold a subquery, so it calls this.)
create function public.feedback_pictures_ok(pictures text[], owner uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(pictures), 0) <= 3
    and coalesce(bool_and(picture like owner::text || '/feedback-%'), true)
  from unnest(pictures) as picture;
$$;
grant execute on function public.feedback_pictures_ok(text[], uuid) to authenticated;

alter table public.feedback
  add column pictures text[] not null default '{}'
    check (public.feedback_pictures_ok(pictures, user_id));
comment on column public.feedback.pictures is
  'Pictures the user added to the ticket, in their own folder of the screenshots bucket. At most three.';

-- An admin can open the screenshot and the pictures of a ticket, and no other file.
drop policy "screenshots: admins read reported ones" on storage.objects;
create policy "screenshots: admins read reported ones" on storage.objects for select to authenticated
  using (
    bucket_id = 'screenshots'
    and public.is_admin()
    and exists (
      select 1 from public.feedback
      where feedback.screenshot_path = objects.name or objects.name = any (feedback.pictures)
    )
  );
