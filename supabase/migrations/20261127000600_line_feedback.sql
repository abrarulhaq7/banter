-- Better replies: why the user did not like a line.
--
-- Set from the thumbs-down on a line, with one reason. Banter puts the latest disliked
-- lines into the prompt ("avoid what made these miss") and Personalise reads them.
alter table public.lines add column feedback text
  check (feedback in ('too_much', 'too_tame', 'cringe', 'not_me', 'too_long', 'generic'));
comment on column public.lines.feedback is
  'Why the user did not like this line, or null. One of too_much, too_tame, cringe, not_me, too_long, generic.';
