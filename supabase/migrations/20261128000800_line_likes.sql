-- A like on a line: "more like this".
--
-- Set from the thumbs-up on a line. Liked lines go first among the examples of the user's
-- taste in every prompt, and Personalise reads them. The app never sets a like and a
-- "not for me" reason on the same line: choosing one clears the other.
alter table public.lines add column liked_at timestamptz;
comment on column public.lines.liked_at is
  'When the user liked this line, or null. Never set together with feedback.';
