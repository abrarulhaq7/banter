-- Checks the migrations: seed data, constraints, and above all that one user can never
-- read or change another user's rows or files. Run with: npm run test:db
--
-- User A: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
-- User B: bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb

\set ON_ERROR_STOP on
\set QUIET on

-- =========================================================================================
-- Seed data
-- =========================================================================================
select tests.ok((select count(*) from public.modes) = 4, 'seed: four modes');
select tests.ok((select count(*) from public.tones) = 9, 'seed: nine tones, Spicy, Teasing, Mysterious and Sincere included');
select tests.ok((select count(*) from public.prompt_core where is_active) = 1,
  'seed: exactly one active version of the core rules');
select tests.ok(
  (select version from public.prompt_core where is_active) = (select max(version) from public.prompt_core)
  and (select count(*) from public.prompt_core) >= 2,
  'prompts: syncing from the app''s code adds a new version, makes it the active one and keeps the old one');
select tests.ok(
  (select count(*) from public.models where is_default) = 5
  and (select count(distinct provider) from public.models where is_default) = 5,
  'seed: one default model for each of the five providers');
select tests.ok(
  (select count(*) from public.models where rank is null) = 0
  and (select count(distinct rank) from public.models) = (select count(*) from public.models),
  'seed: every model has its own place in the best-first order');
select tests.ok(
  (select array_agg(model_id order by rank) from public.models where provider = 'gemini')
    = array['gemini-4-hydrogen', 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'],
  'seed: a Gemini key goes from its best free model down to Flash-Lite');
select tests.ok((select not public from storage.buckets where id = 'screenshots'),
  'storage: the screenshots bucket exists and is private');

-- =========================================================================================
-- Sign-up creates a profile
-- =========================================================================================
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@example.com'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@example.com');

select tests.ok((select count(*) from public.profiles) = 2, 'sign-up creates a profile row');
select tests.ok(
  (select theme from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = 'midnightPlum',
  'a new profile starts on the Midnight Plum theme');

-- =========================================================================================
-- User A creates one of everything
-- =========================================================================================
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);

insert into public.api_keys (id, provider, label, key, model)
  values ('a0000000-0000-4000-8000-000000000001', 'gemini', 'Main', 'test-key-not-real-0001', 'gemini-3.5-flash-lite');
insert into public.user_prompts (id, tone_id, content)
  values ('a0000000-0000-4000-8000-000000000002', 'flirty', 'My own idea of flirty.');
insert into public.user_prompts (id, label, content)
  values ('a0000000-0000-4000-8000-000000000003', 'Dry', 'Deadpan, short, no emoji.');
insert into public.people (id, username, context)
  values ('a0000000-0000-4000-8000-000000000004', 'some.one_99', 'stranger');
insert into public.interactions
  (id, person_id, mode_id, tone_id, user_prompt_id, tone_label, context, screenshot_path,
   screen_type, noticed, provider, model, api_key_id, api_key_label, prompt_version, duration_ms)
  values
  ('a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000004',
   'story_reply', 'flirty', 'a0000000-0000-4000-8000-000000000002', 'Flirty', 'stranger',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/a0000000-0000-4000-8000-000000000005.jpg',
   'story', 'A ramen bowl.', 'gemini', 'gemini-3.5-flash-lite',
   'a0000000-0000-4000-8000-000000000001', 'Main', 1, 2300);
insert into public.lines (interaction_id, position, text, hook) values
  ('a0000000-0000-4000-8000-000000000005', 1, 'Line one', 'ramen'),
  ('a0000000-0000-4000-8000-000000000005', 2, 'Line two', 'window'),
  ('a0000000-0000-4000-8000-000000000005', 3, 'Line three', 'caption');
insert into storage.objects (bucket_id, name)
  values ('screenshots', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/a0000000-0000-4000-8000-000000000005.jpg');

select tests.ok(
  (select user_id from public.api_keys) = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'A: new rows are owned by the signed-in user without the app sending user_id');
select tests.ok(
  tests.changed($$update public.profiles set display_name = 'A', age = 27, theme = 'ember'$$) = 1,
  'A: can update own profile, and only that one row is touched');
select tests.ok(
  (select count(*) from public.api_keys) = 1 and (select count(*) from public.user_prompts) = 2
  and (select count(*) from public.people) = 1 and (select count(*) from public.interactions) = 1
  and (select count(*) from public.lines) = 3 and (select count(*) from storage.objects) = 1,
  'A: sees own keys, prompts, people, interactions, lines and screenshot');

-- Reference tables are readable but not writable from the app.
select tests.ok(
  (select count(*) from public.models) > 0 and (select count(*) from public.modes) > 0
  and (select count(*) from public.tones) > 0 and (select count(*) from public.prompt_core) > 0,
  'A: can read models, modes, tones and core rules');
select tests.refused($$update public.tones set definition = 'changed'$$, 'A: cannot edit default tones');
select tests.refused($$update public.modes set instruction = 'changed'$$, 'A: cannot edit default modes');
select tests.refused($$update public.prompt_core set rules = 'changed'$$, 'A: cannot edit core rules');
select tests.refused($$insert into public.models (provider, model_id, label) values ('openai', 'x', 'X')$$,
  'A: cannot add models');
select tests.refused($$delete from public.models$$, 'A: cannot delete models');
select tests.refused($$insert into public.profiles (id) values (gen_random_uuid())$$,
  'A: cannot create profile rows directly');
select tests.refused($$delete from public.profiles$$, 'A: cannot delete profile rows directly');

-- History extras (Phase 5).
select tests.ok(tests.changed($$update public.lines set kept_at = now() where position = 2$$) = 1,
  'A: can keep a line');
select tests.ok((select count(*) from public.lines where kept_at is not null) = 1,
  'A: the kept line is saved as kept');
select tests.ok(
  tests.changed($$update public.interactions set prompt_version = 999$$) = 1,
  'interactions: a prompt version newer than the database''s copy can be recorded');

-- Constraints.
select tests.refused($$update public.profiles set age = 17$$, 'profile: age under 18 is rejected');
select tests.refused($$update public.profiles set theme = 'light'$$, 'profile: unknown theme is rejected');
select tests.refused($$insert into public.people (username) values ('Has Spaces')$$,
  'people: a username that is not a valid Instagram username is rejected');
select tests.refused($$insert into public.people (username) values ('some.one_99')$$,
  'people: the same username cannot be added twice');
select tests.refused($$insert into public.user_prompts (tone_id, content) values ('flirty', 'again')$$,
  'user_prompts: only one personal version per tone');
select tests.refused($$insert into public.user_prompts (content) values ('no label')$$,
  'user_prompts: a custom tone needs a label');
select tests.refused($$insert into public.api_keys (provider, label, key) values ('other', 'x', 'test-key-0000')$$,
  'api_keys: unknown provider is rejected');
select tests.refused(
  $$insert into public.api_keys (provider, label, key, model) values ('gemini', 'x', 'test-key-0000', 'no-such-model')$$,
  'api_keys: a model that is not in the models list is rejected');
select tests.refused($$update public.api_keys set status = 'broken'$$, 'api_keys: unknown status is rejected');
select tests.ok(
  tests.changed($$insert into public.api_keys (provider, label, key, model)
    values ('groq', 'Fast', 'test-key-not-real-0002', 'qwen/qwen3.8-27b'),
           ('openrouter', 'Free', 'test-key-not-real-0003', null)$$) = 2,
  'api_keys: Groq and OpenRouter keys can be added, with a model or automatic');
select tests.ok(
  tests.changed($$delete from public.api_keys where provider in ('groq', 'openrouter')$$) = 2,
  'api_keys: and deleted again');
select tests.ok(
  (select model_limits = '{}'::jsonb from public.api_keys),
  'api_keys: a new key has no models resting');
select tests.ok(
  tests.changed($$update public.api_keys
    set model_limits = '{"gemini-4-hydrogen": "2026-11-26T13:00:00Z"}'::jsonb$$) = 1,
  'A: can save that a model of own key hit its limit');
select tests.refused($$update public.api_keys set model_limits = '[]'::jsonb$$,
  'api_keys: model_limits must be an object');
select tests.refused($$update public.api_keys set model_limits = null$$,
  'api_keys: model_limits cannot be null');
select tests.refused(
  $$insert into public.interactions (mode_id, provider, model, screenshot_path)
    values ('opener', 'gemini', 'm', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/x.jpg')$$,
  'interactions: a screenshot path outside the user''s own folder is rejected');
select tests.refused(
  $$insert into public.lines (interaction_id, position, text)
    values ('a0000000-0000-4000-8000-000000000005', 1, 'duplicate position')$$,
  'lines: two lines cannot share a position');
select tests.refused(
  $$insert into storage.objects (bucket_id, name) values ('screenshots', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/planted.jpg')$$,
  'storage: A cannot upload into B''s folder');
select tests.refused(
  $$insert into storage.objects (bucket_id, name) values ('screenshots', 'loose-file.jpg')$$,
  'storage: files outside a user folder are rejected');

-- =========================================================================================
-- User B cannot see or touch anything of A's
-- =========================================================================================
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', false);

select tests.ok((select count(*) from public.api_keys) = 0, 'B: cannot read A''s API keys');
select tests.ok((select count(*) from public.user_prompts) = 0, 'B: cannot read A''s prompts');
select tests.ok((select count(*) from public.people) = 0, 'B: cannot read A''s people');
select tests.ok((select count(*) from public.interactions) = 0, 'B: cannot read A''s interactions');
select tests.ok((select count(*) from public.lines) = 0, 'B: cannot read A''s lines');
select tests.ok((select count(*) from storage.objects) = 0, 'B: cannot see A''s screenshot');
select tests.ok(
  (select count(*) from public.profiles) = 1
  and (select id from public.profiles) = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'B: sees only own profile');

select tests.ok(tests.changed($$update public.api_keys set key = 'stolen-key-000000'$$) = 0,
  'B: cannot change A''s API keys');
select tests.ok(tests.changed($$update public.api_keys set model_limits = '{}'::jsonb$$) = 0,
  'B: cannot change which of A''s models are resting');
select tests.ok(tests.changed($$update public.people set notes = 'x'$$) = 0, 'B: cannot change A''s people');
select tests.ok(tests.changed($$update public.lines set text = 'x'$$) = 0, 'B: cannot change A''s lines');
select tests.ok(tests.changed($$update public.lines set liked_at = now()$$) = 0, 'B: cannot like A''s lines');
select tests.ok(tests.changed($$update public.interactions set noticed = 'x'$$) = 0,
  'B: cannot change A''s interactions');
select tests.ok(tests.changed($$update public.user_prompts set content = 'x'$$) = 0,
  'B: cannot change A''s prompts');
select tests.ok(
  tests.changed($$update public.profiles set display_name = 'x' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$) = 0,
  'B: cannot change A''s profile');
select tests.ok(tests.changed($$delete from public.api_keys$$) = 0, 'B: cannot delete A''s API keys');
select tests.ok(tests.changed($$delete from public.people$$) = 0, 'B: cannot delete A''s people');
select tests.ok(tests.changed($$delete from public.interactions$$) = 0, 'B: cannot delete A''s interactions');
select tests.ok(tests.changed($$delete from public.lines$$) = 0, 'B: cannot delete A''s lines');
select tests.ok(tests.changed($$delete from public.user_prompts$$) = 0, 'B: cannot delete A''s prompts');
select tests.ok(tests.changed($$delete from storage.objects$$) = 0, 'B: cannot delete A''s screenshot');
select tests.ok(tests.changed($$update storage.objects set name = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/taken.jpg'$$) = 0,
  'B: cannot move A''s screenshot');

select tests.refused(
  $$insert into public.api_keys (user_id, provider, label, key)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'openai', 'planted', 'test-key-0000')$$,
  'B: cannot create a key in A''s name');
select tests.refused(
  $$insert into public.people (user_id, username) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'planted')$$,
  'B: cannot create a person in A''s name');
select tests.refused(
  $$insert into public.interactions (person_id, mode_id, provider, model)
    values ('a0000000-0000-4000-8000-000000000004', 'opener', 'gemini', 'm')$$,
  'B: cannot attach an interaction to A''s person');
select tests.refused(
  $$insert into public.interactions (api_key_id, mode_id, provider, model)
    values ('a0000000-0000-4000-8000-000000000001', 'opener', 'gemini', 'm')$$,
  'B: cannot attach an interaction to A''s key');
select tests.refused(
  $$insert into public.lines (interaction_id, position, text)
    values ('a0000000-0000-4000-8000-000000000005', 4, 'planted')$$,
  'B: cannot add a line to A''s interaction');

-- B's own data works, and B cannot hand a row over to A.
insert into public.people (id, username) values ('b0000000-0000-4000-8000-000000000001', 'b.friend');
insert into storage.objects (bucket_id, name)
  values ('screenshots', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/own.jpg');
select tests.ok((select count(*) from public.people) = 1 and (select count(*) from storage.objects) = 1,
  'B: can create and read own rows and files');
select tests.refused(
  $$update public.people set user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'B: cannot move a row to A');
select tests.ok(
  (select count(*) from public.usage_summary where key_label = 'Main') = 0,
  'B: cannot see A''s usage');

-- =========================================================================================
-- Signed-out visitors have no access at all
-- =========================================================================================
set role anon;
select set_config('request.jwt.claim.sub', '', false);

select tests.refused($$select 1 from public.profiles$$, 'signed out: cannot read profiles');
select tests.refused($$select 1 from public.api_keys$$, 'signed out: cannot read api_keys');
select tests.refused($$select 1 from public.user_prompts$$, 'signed out: cannot read user_prompts');
select tests.refused($$select 1 from public.people$$, 'signed out: cannot read people');
select tests.refused($$select 1 from public.interactions$$, 'signed out: cannot read interactions');
select tests.refused($$select 1 from public.lines$$, 'signed out: cannot read lines');
select tests.refused($$select 1 from public.models$$, 'signed out: cannot read models');
select tests.refused($$select 1 from public.prompt_core$$, 'signed out: cannot read core rules');
select tests.refused($$select 1 from public.modes$$, 'signed out: cannot read modes');
select tests.refused($$select 1 from public.tones$$, 'signed out: cannot read tones');
select tests.refused(
  $$insert into public.api_keys (user_id, provider, label, key)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'openai', 'planted', 'test-key-0000')$$,
  'signed out: cannot write api_keys');
select tests.refused($$select 1 from public.usage_summary$$, 'signed out: cannot read usage');
select tests.refused($$select public.delete_my_account()$$, 'signed out: cannot call delete_my_account');
select tests.ok((select count(*) from storage.objects) = 0, 'signed out: cannot see any screenshot');
select tests.refused(
  $$insert into storage.objects (bucket_id, name) values ('screenshots', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/anon.jpg')$$,
  'signed out: cannot upload');

-- =========================================================================================
-- A's data is untouched, and deletes clean up correctly
-- =========================================================================================
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);

select tests.ok(
  (select key from public.api_keys) = 'test-key-not-real-0001'
  and (select count(*) from public.people) = 1 and (select count(*) from public.lines) = 3
  and (select count(*) from storage.objects) = 1
  and (select display_name from public.profiles) = 'A',
  'A: everything is unchanged after B''s and the visitor''s attempts');

select tests.ok(
  tests.changed($$update public.lines set feedback = 'cringe' where position = 1$$) = 1,
  'A: can mark why a line was not for them');
select tests.refused($$update public.lines set feedback = 'boring' where position = 2$$,
  'lines: only the known feedback reasons are accepted');
select tests.ok(tests.changed($$update public.lines set liked_at = now() where position = 2$$) = 1,
  'A: can like a line');
select tests.ok((select liked_at is not null from public.lines where position = 2),
  'A: the liked line is saved as liked');
select tests.ok(
  (select count(*) from public.usage_summary) = 1
  and (select provider = 'gemini' and model = 'gemini-3.5-flash-lite' and key_label = 'Main'
              and generations = 1 and this_month = 1 and last_used_at is not null
       from public.usage_summary),
  'A: usage counts own generations per provider, model and key');

delete from public.api_keys where id = 'a0000000-0000-4000-8000-000000000001';
select tests.ok(
  (select api_key_id is null and api_key_label = 'Main' from public.interactions),
  'deleting a key keeps the history and the key''s label');
select tests.ok(
  (select generations = 1 and key_label = 'Main' from public.usage_summary),
  'usage still counts generations made with a key that was deleted');

delete from public.user_prompts where id = 'a0000000-0000-4000-8000-000000000002';
select tests.ok(
  (select user_prompt_id is null and tone_label = 'Flirty' from public.interactions),
  'deleting a personal tone keeps the history and the tone''s label');

delete from public.people where id = 'a0000000-0000-4000-8000-000000000004';
select tests.ok(
  (select count(*) from public.interactions) = 0 and (select count(*) from public.lines) = 0,
  'deleting a person deletes their interactions and lines');

-- =========================================================================================
-- Feedback: users send and see their own tickets; admins see and resolve all of them
-- =========================================================================================
reset role;
insert into auth.users (id, email) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'admin@example.com');
insert into public.admins (user_id) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);

insert into storage.objects (bucket_id, name)
  values ('screenshots', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/feedback-1.jpg');
-- The app never sends an email; even a made-up one is replaced by the login's.
insert into public.feedback (id, kind, message, context, email, screenshot_path)
  values ('f0000000-0000-4000-8000-000000000001', 'lines', 'Too cheesy.', '{"where": "results"}',
          'someone@else.com', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/feedback-1.jpg');
select tests.ok((select email from public.feedback) = 'a@example.com',
  'feedback: the email comes from the login, not from the app');
select tests.ok((select status = 'open' and resolution is null from public.feedback),
  'feedback: a new ticket is open');
select tests.refused($$insert into public.feedback (kind) values ('rant')$$, 'feedback: unknown kind is rejected');
select tests.refused(
  $$insert into public.feedback (kind, user_id) values ('bug', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$$,
  'feedback: cannot send a ticket as someone else');
select tests.refused($$insert into public.feedback (kind, status) values ('bug', 'resolved')$$,
  'feedback: cannot send a ticket that is already resolved');
select tests.refused(
  $$insert into public.feedback (kind, screenshot_path) values ('bug', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/x.jpg')$$,
  'feedback: the screenshot must be in the user''s own folder');
select tests.ok(tests.changed($$update public.feedback set status = 'resolved'$$) = 0,
  'feedback: a user cannot resolve tickets');
select tests.refused($$update public.feedback set message = 'changed'$$, 'feedback: a sent ticket cannot be edited');
select tests.refused(
  $$insert into public.admins (user_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  'admins: a user cannot make themselves an admin');
select tests.ok(not public.is_admin(), 'A is not an admin');

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', false);
select tests.ok((select count(*) from public.feedback) = 0, 'B: cannot see A''s tickets');

select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', false);
select tests.ok(public.is_admin(), 'the admin is an admin');
select tests.ok((select count(*) from public.feedback where email = 'a@example.com') = 1,
  'admin: finds a user''s tickets by their email');
select tests.ok(
  (select count(*) from storage.objects) = 1
  and (select name from storage.objects) = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/feedback-1.jpg',
  'admin: can open the reported screenshot, and no other');
select tests.ok(
  tests.changed($$update public.feedback set status = 'resolved', resolution = 'Fixed in the rules.', resolved_at = now()$$) = 1,
  'admin: can resolve a ticket');
select tests.refused($$update public.feedback set message = 'x'$$, 'admin: cannot change what the user wrote');

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
select tests.ok((select status = 'resolved' and resolution = 'Fixed in the rules.' from public.feedback),
  'A: sees that the ticket was resolved, and how');

reset role;
delete from auth.users where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);

-- Deleting the account removes every row the user owns, and nothing of anyone else's.
-- A does it themselves, through the one function that is allowed to.
select tests.refused($$delete from auth.users$$, 'A: cannot delete from auth.users directly');
select public.delete_my_account();
reset role;
select tests.ok(
  (select count(*) from auth.users where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = 0
  and (select count(*) from auth.users) = 1,
  'delete_my_account removes the caller''s login and nobody else''s');
select tests.ok(
  (select count(*) from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = 0
  and (select count(*) from public.user_prompts where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = 0
  and (select count(*) from public.feedback where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = 0,
  'deleting an account deletes its profile and remaining rows, tickets too');
select tests.ok(
  (select count(*) from public.profiles) = 1 and (select count(*) from public.people) = 1,
  'deleting an account leaves other users'' data alone');

-- Every public table must have row-level security on. Catches a table added later without it.
select tests.ok(
  (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity) = 0,
  'every table in public has row-level security turned on');
