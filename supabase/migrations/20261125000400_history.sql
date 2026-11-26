-- Phase 5: history.

-- Keep: a line the user pinned while trying other tones (PLAN.md, Phase 4 item 4).
alter table public.lines add column kept_at timestamptz;
comment on column public.lines.kept_at is 'Set when the user keeps the line. Null means not kept.';

-- The prompt version is a plain record of what was used, not a link.
--
-- The app carries its own copy of the prompts, which can be newer than the copy in this
-- database. With the link, saving history failed whenever the two differed. History must
-- also outlive a prompt version being removed.
alter table public.interactions drop constraint interactions_prompt_version_fkey;
comment on column public.interactions.prompt_version is
  'Version of the core rules used for this generation. A record only; not linked to prompt_core.';

-- The person timeline lists a person's interactions with their lines.
create index lines_interaction on public.lines (interaction_id);
