-- Banter database: all tables from PLAN.md section 5.
--
-- Security model
--   * Every table has row-level security turned on.
--   * User tables: a signed-in user can read and write only rows where user_id is their own id.
--   * Reference tables (models, prompt_core, modes, tones): signed-in users can read them.
--     Nobody can change them through the app; they are edited in the Supabase dashboard.
--   * Signed-out visitors (the "anon" role) have no access to any table.
--   * Links between user tables carry user_id as well, so a row can never point at another
--     user's row.

-- ---------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Reference tables (read-only for the app)
-- ---------------------------------------------------------------------------------------

create table public.models (
  provider text not null check (provider in ('gemini', 'openai', 'claude')),
  model_id text not null check (char_length(model_id) between 1 and 100),
  label text not null check (char_length(label) between 1 and 100),
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider, model_id)
);
comment on table public.models is 'Models offered per AI provider. Edited in the dashboard only.';

-- At most one default model per provider.
create unique index models_one_default_per_provider on public.models (provider) where is_default;

create table public.prompt_core (
  version integer primary key check (version > 0),
  rules text not null,
  output_format text not null,
  is_active boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);
comment on table public.prompt_core is
  'Fixed rules and output format that every prompt starts with. One version is active.';

-- At most one active version.
create unique index prompt_core_one_active on public.prompt_core ((true)) where is_active;

create table public.modes (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{0,39}$'),
  label text not null check (char_length(label) between 1 and 60),
  instruction text not null,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.modes is 'Story reply, Opener, Reply, Analyse: default instruction for each.';

create table public.tones (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{0,39}$'),
  label text not null check (char_length(label) between 1 and 60),
  definition text not null,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.tones is 'Casual, Funny, Flirty, Confident, Safe: default definition for each.';

create trigger models_set_updated_at before update on public.models
  for each row execute function public.set_updated_at();
create trigger modes_set_updated_at before update on public.modes
  for each row execute function public.set_updated_at();
create trigger tones_set_updated_at before update on public.tones
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------
-- User tables
-- ---------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  age smallint check (age between 18 and 120),
  city text check (char_length(city) <= 120),
  work text check (char_length(work) <= 200),
  interests text check (char_length(interests) <= 1000),
  texting_style text check (char_length(texting_style) <= 2000),
  theme text not null default 'midnightPlum'
    check (theme in ('midnightPlum', 'ember', 'deepSea')),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'One row per user: about-you facts used in prompts, and settings.';

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- A profile row is created automatically when a user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider text not null check (provider in ('gemini', 'openai', 'claude')),
  label text not null check (char_length(label) between 1 and 60),
  key text not null check (char_length(key) between 8 and 500),
  -- Null means "use the provider's default model".
  model text,
  sort_order integer not null default 0,
  status text not null default 'active'
    check (status in ('active', 'limited', 'invalid', 'disabled')),
  last_error text check (char_length(last_error) <= 1000),
  limited_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (provider, model) references public.models (provider, model_id)
    on update cascade on delete set null (model)
);
comment on table public.api_keys is
  'The user''s own AI provider keys. Protected by row-level security, not encrypted.';

create index api_keys_user_order on public.api_keys (user_id, sort_order);

create trigger api_keys_set_updated_at before update on public.api_keys
  for each row execute function public.set_updated_at();

create table public.user_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Set tone_id for the user's version of a default tone, mode_id for their version of a
  -- mode. Both null means a custom tone the user made, which then needs a label.
  tone_id text references public.tones (id) on delete cascade,
  mode_id text references public.modes (id) on delete cascade,
  label text check (char_length(label) between 1 and 60),
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (num_nonnulls(tone_id, mode_id) <= 1),
  check (num_nonnulls(tone_id, mode_id) = 1 or label is not null)
);
comment on table public.user_prompts is
  'A user''s own version of a tone or mode, and the custom tones they made.';

-- One personal version per default tone and per mode.
create unique index user_prompts_one_per_tone on public.user_prompts (user_id, tone_id)
  where tone_id is not null;
create unique index user_prompts_one_per_mode on public.user_prompts (user_id, mode_id)
  where mode_id is not null;
create index user_prompts_user on public.user_prompts (user_id);

create trigger user_prompts_set_updated_at before update on public.user_prompts
  for each row execute function public.set_updated_at();

create table public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Instagram username: lowercase, no leading @.
  username text not null check (username ~ '^[a-z0-9._]{1,30}$'),
  context text check (context in ('stranger', 'mutual_follow', 'know_her', 'already_talking')),
  notes text check (char_length(notes) <= 2000),
  last_interaction_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, username)
);
comment on table public.people is 'Everyone the user has used Banter with, keyed by Instagram username.';

create index people_user_recent on public.people (user_id, last_interaction_at desc nulls last);

create trigger people_set_updated_at before update on public.people
  for each row execute function public.set_updated_at();

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Null until the username is known.
  person_id uuid,
  -- For "New lines", "Shorter" and "Bolder": the interaction this one adjusts.
  parent_id uuid,
  adjustment text check (adjustment in ('new_lines', 'shorter', 'bolder')),
  mode_id text not null references public.modes (id),
  -- Null for Analyse, which has no tone.
  tone_id text references public.tones (id),
  -- The personal or custom tone that was used, if any.
  user_prompt_id uuid,
  -- The tone's name at the time, kept even if the tone is later renamed or deleted.
  tone_label text check (char_length(tone_label) <= 60),
  context text check (context in ('stranger', 'mutual_follow', 'know_her', 'already_talking')),
  screenshot_path text,
  screen_type text check (screen_type in ('story', 'profile', 'chat', 'other')),
  noticed text check (char_length(noticed) <= 2000),
  -- Analyse result: interest level, signals, advice.
  analysis jsonb check (analysis is null or jsonb_typeof(analysis) = 'object'),
  provider text not null check (provider in ('gemini', 'openai', 'claude')),
  model text not null check (char_length(model) between 1 and 100),
  api_key_id uuid,
  -- The key's label at the time, kept even if the key is later deleted.
  api_key_label text check (char_length(api_key_label) <= 60),
  prompt_version integer references public.prompt_core (version),
  duration_ms integer check (duration_ms >= 0),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  -- Screenshots live in the user's own folder: "<user id>/<file>".
  check (screenshot_path is null or screenshot_path like user_id::text || '/%'),
  foreign key (person_id, user_id) references public.people (id, user_id) on delete cascade,
  foreign key (parent_id, user_id) references public.interactions (id, user_id)
    on delete set null (parent_id),
  foreign key (api_key_id, user_id) references public.api_keys (id, user_id)
    on delete set null (api_key_id),
  foreign key (user_prompt_id, user_id) references public.user_prompts (id, user_id)
    on delete set null (user_prompt_id)
);
comment on table public.interactions is 'One row per generation.';

create index interactions_user_recent on public.interactions (user_id, created_at desc);
create index interactions_person_recent on public.interactions (person_id, created_at desc);
create index interactions_parent on public.interactions (parent_id) where parent_id is not null;
create index interactions_api_key on public.interactions (api_key_id) where api_key_id is not null;
create index interactions_user_prompt on public.interactions (user_prompt_id)
  where user_prompt_id is not null;

create table public.lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  interaction_id uuid not null,
  position smallint not null check (position between 1 and 20),
  text text not null check (char_length(text) between 1 and 2000),
  -- The detail in the screenshot this line hooks to.
  hook text check (char_length(hook) <= 500),
  -- Set when the user copies the line. Null means not copied.
  copied_at timestamptz,
  result text check (result in ('replied', 'no_reply')),
  result_at timestamptz,
  created_at timestamptz not null default now(),
  unique (interaction_id, position),
  foreign key (interaction_id, user_id) references public.interactions (id, user_id)
    on delete cascade
);
comment on table public.lines is 'The lines of each interaction, which one was copied, and the result.';

create index lines_user on public.lines (user_id);

-- ---------------------------------------------------------------------------------------
-- Access: privileges and row-level security
-- ---------------------------------------------------------------------------------------

-- Reference tables: signed-in users read, nobody writes through the app.
do $$
declare
  t text;
begin
  foreach t in array array['models', 'prompt_core', 'modes', 'tones'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || ': signed-in users read', t
    );
  end loop;
end;
$$;

-- User tables: the owner has full access to their own rows and nothing else.
do $$
declare
  t text;
begin
  foreach t in array array['api_keys', 'user_prompts', 'people', 'interactions', 'lines'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using ((select auth.uid()) = user_id)',
      t || ': owner reads', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check ((select auth.uid()) = user_id)',
      t || ': owner inserts', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)',
      t || ': owner updates', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using ((select auth.uid()) = user_id)',
      t || ': owner deletes', t
    );
  end loop;
end;
$$;

-- Profiles: the owner reads and updates their own row. The row is created by the sign-up
-- trigger and removed when the account is deleted, so the app has no insert or delete.
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

create policy "profiles: owner reads" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "profiles: owner updates" on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
