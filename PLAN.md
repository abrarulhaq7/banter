# Banter — Build Plan

Status: **Phase 8 under way (2026-11-27): the EAS project is linked to the personal account, updates over the air are set up (`npm run ota`), and the first Android APK was built on EAS and checked on the emulator.** Next: install it on the phone, then send the Android keyboard fix as the first update over the air.
Last updated: 2026-11-27

## 1. What we are building

Banter is a mobile app (iOS and Android) that looks at a screenshot from Instagram and
writes short lines you can send: a reply to her story, an opener from her profile, the
next message in a chat, or a read of how the chat is going.

- You take a screenshot in Instagram and open Banter.
- You pick a mode and a tone.
- Banter shows three lines. You tap one to copy it and paste it in Instagram.
- Banter remembers each person by their Instagram username, so the next line fits
  what you already said to them.

The app uses the user's own AI key (Gemini, Groq, OpenRouter, OpenAI or Claude). Each
user pays for their own usage; Gemini, Groq and OpenRouter have free tiers.

## 2. Decisions already made

| Topic | Decision |
|---|---|
| Name | Banter |
| Framework | Expo SDK 58 (React Native 0.88), TypeScript, Expo Router, development builds (not Expo Go) |
| Backend | Supabase: login, database, screenshot storage, remote prompts |
| Login | Required. Email and password. Email confirmation off during testing |
| AI providers | Gemini, Groq, OpenRouter, OpenAI, Claude. User adds own keys; the provider follows from the key |
| Key storage | In Supabase (each user sees only their own keys), cached on the phone |
| Key limits | Several keys per user. The best model any key can use goes first; when it hits its limit, the app moves to the next |
| Prompts | Stored in Supabase. You change them without a new build |
| Personal prompts | Each user can change what each tone means to them, and reset it |
| History | Everything saved: screenshot, mode, tone, provider, model, key used, lines, chosen line, result |
| Memory | Per person, keyed by Instagram username read from the screenshot |
| Language | English only for now |
| Line rules | No hard rules on emoji, length or casing for now. Defaults come from the research |
| Theme | Dark only. Three themes the user can switch between in Settings: Midnight Plum (default), Ember, Deep Sea. See section 11 |
| Target app | Instagram only |
| First capture method | Screenshot, then open Banter (iOS) or share to Banter (Android) |
| Testing order | iOS simulator first, then physical devices |

## 3. How the app is used

1. In Instagram, take a screenshot of her story, profile or chat.
2. Open Banter. It offers your newest screenshot. (On Android you can also share the
   screenshot straight to Banter.)
3. Pick a mode: **Story reply**, **Opener**, **Reply**, **Analyse**.
4. Pick a tone: **Casual**, **Funny**, **Flirty**, **Confident**, **Safe**, or one you made.
5. Pick the context once per person: **Stranger**, **Mutual follow**, **Know her**,
   **Already talking**. Banter remembers it for that person.
6. Banter shows what it noticed in the image and three lines.
7. Tap a line to copy it. Use **New lines**, **Shorter** or **Bolder** to adjust.
8. Later, mark the result (**Replied** / **No reply**), or screenshot the chat and Banter
   updates it for you.

**Analyse** works differently: it reads a chat screenshot and tells you how interested
she seems, which signals it used, what to do next (including "leave it" when the signs
are cold) and one suggested reply.

## 4. Screens

Up to Phase 5 the app had one long Generate screen holding everything. From Phase 5.5
the screens are these (the rules behind the split are in Phase 5.5):

Bottom tab bar: **Generate · People · My tones · Settings**

1. Sign in and sign up: one screen, logo on top, a switch between the two forms
2. Onboarding, three short steps: about you, how you sound, your first API key
3. Generate (tab): the screenshot and the choices for it. Nothing else
4. Results (opens after "Get lines"): the lines for this screenshot, one set at a time
5. People (tab): list of everyone you have used Banter with
6. Person: who she is, and one row per screenshot you used Banter on
7. Screenshot detail: the lines written for one screenshot, which were used, how it went
8. My tones (tab): one row per tone; a row opens the tone. "Add a tone" is pinned
   - One tone: its definition (and its name, for a tone you made), Save pinned; Reset or
     Delete asks first
   - Personalise for me: what the AI will read, then its suggestions as rows; a row opens
     a sheet to compare and accept or skip
9. Settings (tab): a short list that opens About you, AI keys, Theme, Your data, Sign out
10. About you: one row per fact; a row opens a sheet to change it
11. AI keys: one row per key, in the order they are tried; a row opens its key
12. One key: name, model, on or off, check again, delete
13. Add a key: provider, the key, model
14. Your data: save screenshots on or off, Usage, Delete all history, Delete my account
15. Usage: generations per key and model, this month or all time

## 5. Data in Supabase

Every user table has row-level security: a user can read and write only their own rows.

| Table | Holds | Who can change it |
|---|---|---|
| `profiles` | name, age, city, work, interests, texting style, settings | the user |
| `api_keys` | provider, label, key, model, order, status (`active`, `limited`, `invalid`, `disabled`), last error | the user |
| `models` | list of models per provider, default model | only you (dashboard) |
| `prompt_core` | fixed rules and output format, with a version number | only you |
| `modes` | Story reply, Opener, Reply, Analyse: default instruction for each | only you |
| `tones` | Casual, Funny, Flirty, Confident, Safe: default definition for each | only you |
| `user_prompts` | a user's own version of a tone or mode, and custom tones | the user |
| `people` | Instagram username, context, notes, last interaction | the user |
| `interactions` | one row per generation: person, mode, tone, context, screenshot path, what was noticed, provider, model, key used, prompt version, time taken | the user |
| `lines` | the lines of each interaction: text, what it hooks to, copied or not, result | the user |

Storage: one private bucket `screenshots`, files saved as `user-id/interaction-id.jpg`.
Screenshots are resized (longest side about 1280 px) before sending and uploading.

## 6. How a prompt is built

The prompt is assembled from layers, in this order:

1. **Core rules** (same for everyone, only you edit): be specific to one thing in the
   image, make it easy to answer, no looks-only compliments, keep it short, stay
   respectful, never push after silence.
2. **Mode instruction** (default, or the user's own version).
3. **Tone definition** (default, or the user's own version).
4. **Context**: stranger, mutual follow, know her, already talking.
5. **About the user**: profile facts, used only when they help.
6. **Memory**: the last five interactions with this person and their results.
7. **Output format** (fixed): the model must answer in a set structure.

The model returns, in one call: the username it read, the screen type (story, profile,
chat), what it noticed, and three lines each with the detail it hooks to. For Analyse it
returns interest level, signals, advice and one suggested reply.

Splitting the fixed parts from the editable parts means a user's edit cannot break
the output format.

## 7. AI providers and keys

- One common interface with small adapters (Gemini, OpenAI, Claude, and one for the
  Chat Completions format that Groq and OpenRouter share). Each sends the image and
  prompt and returns the same structure.
- The phone calls the provider directly. Screenshots do not pass through our server.
- Errors are mapped to plain cases: wrong key, limit reached, no internet, model
  refused, answer unreadable.
- The best model any key can use goes first (`models.rank`). On "limit reached", only
  that model rests (`api_keys.model_limits`) and the app moves to the next model at once.
  A key is marked `limited` only when the whole key has no credit. If you replace a key
  in the database, the app picks it up.
- Model names and their order live in the `models` table, so a new model needs no new
  build.

## 8. Phases

Each phase ends with me showing you simulator screenshots and test results. The next
phase starts only after you say it is good.

### Phase 0 — Project setup and design

Goal: an empty Banter app running on the iOS simulator with the chosen colours.

1. Move the two reference images into `reference/`.
2. Start git, add `.gitignore`, keep all keys out of git.
3. Create the Expo SDK 58 app with TypeScript and Expo Router.
4. Check that SDK 58 supports Android 10 (your test phone). If not, use the newest
   SDK that does. **Checked: it does** (minimum is Android 7; see section 10).
5. Add the theme system with all three themes from section 11: colours, type sizes,
   spacing. Every screen reads colours from the active theme, never fixed values, so
   switching themes works everywhere from the start.
6. Add the basic building blocks: button, chip, card, text input, screen layout.
7. Set up checks: TypeScript strict mode, lint, unit tests.
8. Install the test tools: Java 17 (also needed for Android builds) and Maestro for
   automatic tap-through tests on the simulator.

How I test: the app starts on the iPhone 17 simulator; lint, type check and unit tests pass.
From you: nothing. (Folder rename to `banter` is done by you before Phase 0 starts.)

**Result (2026-11-25):**

- Built with Xcode 27.2 and runs on the iPhone 17 simulator (iOS 27.0). 0 build errors.
- `npm run check` passes: type check, lint, 60 unit tests.
- Maestro flow `.maestro/foundation.yaml` passes: app starts, all three themes switch,
  chips select, line card toggles. Screenshots in `.maestro/artifacts/phase-0/`.
- Home screen is a temporary "Foundation preview" showing the themes and building blocks.
- Not done in this phase: no Android build was made (planned for Phase 8). Android 10
  support was confirmed from the SDK's minimum version, not by running on a device.
- Nothing is committed to git yet. The repository is started and `.gitignore` is in place.
- App ID is `com.banterlines.app` (a placeholder; easy to change before Phase 8).

### Phase 1 — Supabase and login

Goal: sign up, sign in, stay signed in, and a secure database ready for all later phases.

1. Database setup written as migration files in `supabase/migrations/`.
2. All tables from section 5 with row-level security.
3. Private `screenshots` bucket with per-user access rules.
4. First version of core rules, modes, tones and the model list loaded as seed data.
5. Sign up, sign in, sign out and "stay signed in" in the app.
6. Signed-out users see only the sign-in screens.

How I test: sign up on the simulator, restart the app, still signed in. A script creates
two test users and confirms that one cannot read the other's rows or files.
From you: create a Supabase project and give me the project URL and the
**publishable key** (starts with `sb_publishable_`; new projects no longer have an
"anon" key). Turn off "Confirm email". Either log in to the Supabase CLI once so I can
apply migrations, or paste the SQL I give you into the SQL editor.

**Phase 1 result (2026-11-25):**

Done and tested without a Supabase project:

- Three migrations in `supabase/migrations/`: all ten tables, access rules, the private
  `screenshots` bucket, and the first core rules, modes, tones and model list.
- `npm run test:db` applies them to a throwaway local Postgres and runs 78 checks: user B
  cannot read, change or delete anything of user A's (rows or files), a signed-out
  visitor can reach nothing, default prompts cannot be edited from the app, and deletes
  clean up correctly. Supabase's login and file storage are imitated in this test, so it
  proves the rules, not the real project.
- Sign in, sign up, sign out and "stay signed in" in the app. The session is kept in the
  phone's secure storage. Signed-out users can open only the sign-in screens.
- `npm run check` passes: type check, lint, 120 unit tests.
- Maestro on the iPhone 17 simulator passes: sign-in and sign-up screens, their error
  messages, and the design preview. Screenshots in `.maestro/artifacts/phase-1/`.

Done against the real project (`fpgmhjnekiherrotofwn`, Sydney) on 2026-11-25:

- Database created by pasting `supabase/paste-into-sql-editor.sql` into the SQL Editor.
  "Confirm email" is off. No GitHub repository is connected to the project, so nothing
  changes the database on push. **A new migration must be pasted by hand** (paste only
  the new file, never the whole bundle again).
- `npm run test:privacy` passes: 52 checks with two real test users. One cannot read,
  change, take over or delete the other's rows or screenshots; a signed-out visitor
  reaches nothing.
- `npm run e2e:live` passes on the iPhone 17 simulator: sign up, land in the app, restart
  the app and still be signed in, sign out, sign in again, wrong password refused.
- Found by the live test and fixed: iOS's "strong password" suggestion on the sign-up
  password field dropped typed characters. Password autofill is now offered only on
  sign-in.
- Test accounts left in Supabase (Authentication > Users): two `banter.privacy.*` and
  one `banter.e2e.*`. Safe to delete.
- `.env.local` holds the project URL and publishable key. It is not in git.

Choices made in this phase that you may want to change:

- **Age must be 18 or over** if it is filled in (the database refuses lower values).
- **Passwords need 8 characters** to sign up.
- **Sign out** ends the session on that phone only.
- Each generation can record which earlier generation it adjusted ("New lines",
  "Shorter", "Bolder"), ready for Phase 4.
- The core rules tell the model to write no lines when the person looks under 18, has
  asked the sender to stop, or the screenshot cannot be read.
- The design preview from Phase 0 is now a development-only screen (`banter://foundation`).

### Phase 2 — Profile and API keys

Goal: the app knows who you are and has a working key.

1. Onboarding: name, age, city, work, interests, how you text (free text).
2. Add key: paste key, pick provider, give it a label. The app checks the key with a
   tiny test call before saving.
3. Keys screen: list, reorder, disable, delete, pick model.
4. Keys saved in Supabase and cached in the phone's secure storage.

How I test: unit tests for key checking and caching with fake provider answers. On the
simulator: add a key, restart, key still there; add a wrong key, see a clear error.
From you: type one real key into the app on the simulator. I do not need to see it.

**Phase 2 result (2026-11-25):**

- **Onboarding:** new users get two steps, "About you" then "Your AI key". Only the name
  is required. The key step can be skipped with "Add a key later".
- **Adding a key:** pick the provider, paste the key, optionally name it and pick a model.
  The provider switches by itself to match the key's prefix. The key is checked with the
  provider before it is saved, and a key the provider rejects is not saved.
- **The check is free.** It asks the provider for its list of models, which uses none of
  the key's allowance, and it also confirms the key can use the chosen model.
- **Keys screen:** order with Up and Down, and an Edit screen to rename, change model,
  check again, turn off or delete.
- **Storage:** keys and the profile live in Supabase and are copied to the phone's secure
  storage. The app shows the copy at once on start and works from it without internet.
  Signing out removes the copy from the phone.
- **Checks:** `npm run check` passes (type check, lint, 202 unit tests).
- **Simulator, against the real project:** all five Maestro flows pass. They cover the
  onboarding rules, Gemini and OpenAI each rejecting a made-up key with a clear message,
  the profile and keys surviving an app restart, and reorder, check again, turn off and
  delete on the keys screens. Screenshots in `.maestro/artifacts/phase-2/`.

Real key check (done by you on 2026-11-25):

- A real Gemini key was added in the app and saved as "Active" on Gemini 3.5 Flash-Lite.
  Pressing "Check this key again" afterwards returned "Gemini accepted this key."
- This confirms `gemini-3.5-flash-lite` is a correct model name. The other names in the
  `models` table (`gemini-4-hydrogen`, `gpt-6-luna` and the three Claude models) have not
  been confirmed with a real key yet. The app checks each one when a key is added with it.

Choices made in this phase that you may want to change:

- The age rule (18 or older) is enforced in the form as well as in the database.
- A key that is rate limited or has no credit at the moment of adding is not saved; the
  app asks you to try again later.
- Keys are shown in full while you paste them, and masked (last four characters) after.
- Claude is called with plain web requests, not Anthropic's library, because that library
  does not support React Native.
- Test accounts are left in Supabase after each simulator run (`banter.e2e.*`). Safe to
  delete under Authentication > Users.

### Phase 3 — Generation engine

Goal: screenshot in, good lines out, on all three providers. No screens yet.

1. Prompt builder that assembles the layers from section 6.
2. Three provider adapters with the shared interface.
3. Checking and repairing the model's answer so the app always gets a valid structure.
4. Key switching when a limit is hit.
5. Image resize before sending.
6. Prompts written from the research: specific hook, easy to answer, short, light
   humour, subtle flirting with strangers, stop on silence.
7. A command-line test tool that runs a folder of sample screenshots through any
   provider, mode and tone and prints the lines. I use this to tune the prompts.

How I test: unit tests for the prompt builder, answer checking, key switching and error
mapping. Then the test tool on your sample screenshots for every mode and tone, and
I show you the output so you can judge the lines.
From you: 10 to 15 real screenshots (stories, profiles, chats) in a `samples/` folder
that stays out of git, and one test key per provider in a local file that stays out of git.

**Phase 3 result so far (2026-11-25):**

Built, in `src/engine/`:

- **Prompt builder:** assembles the layers of section 6. The fixed rules and the answer
  format go in the system prompt; everything a user can edit goes in the message with
  the screenshot, so an edit cannot change the rules or the format (there is a test).
- **Three adapters:** Claude (Messages API), OpenAI (Responses API) and Gemini
  (Interactions API). Each sends the screenshot and asks for the same fixed structure.
- **No copies kept by the provider:** OpenAI and Gemini store each request by default.
  Both adapters turn that off (`store: false`), because screenshots show other people.
- **Answer checking:** finds the answer even inside a code block, drops extra, blank and
  repeated lines, cleans the username, and replaces bad values with safe ones.
- **Key switching:** a key at its limit or rejected is reported and the next is tried.
  A refusal or no internet stops at once. An unreadable answer is asked for once more.
- **Test tool:** `npm run lines -- samples/` runs screenshots through any provider, mode
  and tone and prints the lines. `--help` lists the options.
- **Prompt sync:** the default prompts now live in `src/engine/default-prompts.ts`.
  `npm run db:prompts` writes `supabase/paste-prompts.sql` to copy them into Supabase.

Checked:

- `npm run check` passes: type check, lint, 297 unit tests (95 for the engine).
- `npm run test:db` passes: 79 checks, including that the prompt sync loads.
- Each provider's real generation address was called with a made-up key; all three
  answer "wrong key". That found one bug, now fixed: Gemini wraps its error in a list
  on this address, and a wrong key was being reported as a bad request.

First real runs (2026-11-25, Gemini 3.5 Flash-Lite, your 16 story screenshots):

- **It works.** The first real request was accepted and parsed with no change to the
  adapter. About 70 requests were made in total; typical answer time 2 to 4 seconds
  (median 2.4, slowest 10.5).
- **Usernames:** read on all 16. I checked them against the screenshots by eye and they
  match, including one where a sign partly covers the name.
- **Gemini was sometimes too busy.** 5 of the first 20 requests failed with "high demand,
  try again later". The engine now asks again twice (after 1.5 and 4 seconds); the next
  47 requests had no failure. This is the provider, and it may come back.
- **Prompt went through three rounds** (versions 2, 3 and 4), each run on all 16:
  - Version 2: specific hooks, but some comments on her looks ("that colour suits you"),
    invented facts ("that new store downtown") and interview questions ("where is it from?").
  - Version 3: fixed those, but overcorrected into flat statements with nothing to reply
    to ("Heavy shadows today."), and invented a fact about the sender.
  - Version 4 (current): at least one question and at most two per set, no flat verdicts,
    no claims about the sender's own life.
- **Still imperfect in version 4:** an occasional invented detail ("for a Tuesday", "in
  this cold"), an occasional weak line ("What song is playing?"), and Confident reads
  much like Casual.
- Full output is in `samples/out/` (not in git).

Not done yet:

- **Your judgement of the lines.** This is the point of the phase.
- **Opener, Reply and Analyse are untested.** All 16 samples are stories. These modes
  need profile and chat screenshots.
- **OpenAI and Claude have never produced lines.** Claude has no key yet. The OpenAI key
  added on 2026-11-25 is accepted but its account has no credit, so OpenAI answers "no
  credits remaining". That did confirm the address, the sign-in and the error handling:
  the engine now reports "no credit" separately from "rate limit". The request format
  itself is still unproven until a key with credit is used.
- **Failure handling:** every provider problem becomes one of nine plain cases with a
  plain message (wrong key, limit, no credit, no internet, refused, unreadable, provider
  down, request not accepted, no key), and the engine never throws anything else. A
  screen that crashes shows "Something went wrong" with a "Try again" button instead of
  taking the app down (checked on the simulator with a screen that fails on purpose).
  The Generate screen that shows these messages is Phase 4.
- **Resizing in the app** is wired in Phase 4 together with the screenshot picker (both
  need the same native rebuild). The size rule (1280 px longest side) and the test tool's
  resizing are done.
- **Supabase still has prompt version 1.** After tuning, run `npm run db:prompts` and
  paste the file once. It must be done before Phase 5 saves any history.

Choices made in this phase that you may want to change:

- **A refusal is not retried with another key or model.** Anthropic offers an automatic
  fallback to another Claude model when one declines; it is not switched on, so a
  refusal is shown as "the AI declined" and nothing extra is billed.
- The model's reasoning effort is left at each provider's default. Speed against quality
  is tuned once real runs can be timed.

### Phase 4 — Generate screen

Goal: the main flow works end to end on the simulator.

1. "Use latest screenshot" and "Pick from gallery".
2. Mode tabs, tone chips, context chips.
3. Results: what was noticed, three line cards, tap to copy.
4. New lines, Shorter, Bolder.
   **Nothing is replaced** (asked for on 2026-11-25): trying another tone, or New lines,
   Shorter or Bolder, adds a new set of lines above the earlier ones, each set labelled
   with its tone. Earlier sets stay on screen for that screenshot.
   **Keep:** every line has a one-tap Keep button. Kept lines are pinned in a "Kept"
   strip at the top while other tones are tried, and are saved with the person's history
   in Phase 5 (needs a `kept_at` column on `lines`, a small migration).
5. Analyse result view.
6. Clear messages for: no key, all keys at their limit, no internet, model refused,
   could not read the image.

How I test: sample screenshots loaded into the simulator's photo library. Maestro runs
the flow for each mode and takes screenshots, which I check and show you.
From you: try it on the simulator and tell me what feels slow or confusing.

**Phase 4 result (2026-11-25):**

- **Generate is now the home screen.** The old home (account, keys, theme, sign out)
  moved to a Settings screen, opened from the top right.
- **Screenshot:** "Use latest screenshot" finds the newest screenshot in the photo
  library (the newest photo if nothing is marked as a screenshot). "Pick from gallery"
  opens the system picker, which needs no photo permission. Either way the image is
  resized to 1280 px on the longest side before it is sent.
- **Photo access:** if access is refused, or only "Limited access" is given, the app says
  so and offers the gallery instead of showing an old screenshot.
- **Options:** mode, tone and "How you know her" chips. Analyse hides the tones.
- **Results:** what was noticed, the username, and three line cards. Tap a line to copy.
  The page scrolls to the new lines by itself.
- **Nothing is replaced, and Keep:** each new tone or adjustment adds a set above the
  earlier ones. Keep pins a line in a strip above the results. A new screenshot starts over.
- **New lines, Shorter, Bolder** act on the newest set and keep its mode and tone.
- **Analyse:** her interest level, the signals, the advice and one suggested reply.
- **Problems:** each of the nine engine cases shows its plain message with the right next
  step (Add a key, Manage keys, Try again, or Pick from gallery).
- **Keys:** a key that hits its limit is saved as limited, skipped, and tried again by
  itself after 15 minutes.
- **Checks:** `npm run check` passes (352 unit tests, 26 of them for this screen).
- **Simulator:** all seven Maestro flows pass. The new `generate` flow runs the whole
  screen against real Gemini: newest screenshot, lines, copy, keep, a second tone with
  the first set still there, Shorter, and Analyse. Screenshots in
  `.maestro/artifacts/phase-4/`.

Not done in this phase:

- **Only tested with the newest photo in the simulator.** The gallery picker itself has
  not been driven on the simulator (it is Apple's screen); it is covered by unit tests
  with a stand-in. Photos added to a simulator are not marked as screenshots, so the
  "newest screenshot" path is only proven by its fallback. Both need a check on a real
  phone in Phase 8.
- **Context is per session.** "Banter remembers it for that person" needs Phase 5.
- **Kept lines are not saved yet.** They last until a new screenshot is chosen or the app
  restarts. Saving them needs Phase 5.
- **Prompts come from the app's own copy**, not from Supabase yet (Phase 6).

Also on 2026-11-25:

- **GitHub "secret detected" email:** a false alarm. The flagged string was a made-up
  test key shaped like a Google key. No real key has ever been committed (checked across
  the whole history). The fake keys now look fake, and a test fails the check if any
  key-shaped string appears in the project.
- **Test accounts** now get a random password per run, so nobody can sign in to them.
- **Logo and splash: set.** You chose option C (a bold B in a speech bubble) in the
  "C3 Sunset" colours: the bubble fades from purple to pink on the Midnight Plum
  background. It is the app icon and the splash screen now, on iOS and Android, checked
  on the simulator. `python3 scripts/brand-assets.py` redraws every image from one
  description of the logo, so a colour change is one edit. (This was item 4 of Phase 7,
  done early.) The options you chose from are in `reference/`.

### Phase 5 — People and history

Goal: Banter remembers each person and uses that memory.

1. Save every generation: interaction, lines and screenshot upload.
2. Match the person by username. You can confirm or correct the username on the
   result screen.
3. People list and person timeline.
4. Mark a result as Replied or No reply. A later chat screenshot of the same person
   updates it automatically.
5. The last five interactions with that person go into the next prompt, so lines do not
   repeat and can refer back.
6. If an upload fails, it waits on the phone and retries.

How I test: generate twice for the same username and confirm the second prompt
contains the first interaction. A script checks the rows and the stored file, and
repeats the two-user privacy check for history and screenshots.

**Phase 5 result (2026-11-25):**

- **Every generation is saved:** the person, the interaction, its lines and the
  screenshot. One screenshot is stored once, however many tones are tried on it.
- **Saving never blocks the lines.** Everything goes through a queue kept on the phone.
  With no internet the lines still appear, the changes wait, and they are sent in order
  the next time the app can reach Supabase. The People screen says how many are waiting.
- **"Saved under @username"** sits above the lines. "Change" corrects it (or "Add
  username" when the AI could not read one). What was already saved moves to the right
  person, and the misread one is removed if nothing else is under it.
- **Copy and Keep are saved**, so kept lines survive a restart in the history.
- **"How you know her" is remembered per person** and chosen by itself the next time.
- **Memory:** the last five interactions with the person go into the prompt, with which
  line was copied and how it went.
- **People screen** (top right of Generate): everyone, most recent first. Tapping one
  opens the timeline: each set with its tone and mode, the screenshot, what was noticed,
  and each line marked Copied, Not used or Kept. A copied line can be marked Replied or
  No reply; tapping the mark again clears it.
- **Automatic result:** the AI now reports whether a chat screenshot shows her answer to
  the last line that was sent (`sent_line_status`, prompt version 5). If it does, that
  line is marked Replied or No reply without being asked.
- **Database:** one small migration (`20261125000400_history.sql`): a `kept_at` column on
  `lines`, an index, and the prompt version becomes a plain record instead of a link, so
  saving no longer depends on which prompt copy Supabase holds.
- **Checks:** `npm run check` passes (419 unit tests). `npm run test:db` passes
  (82 checks). The three offline Maestro flows pass with the new header.
- **Live run:** the migration is on the real project (you pasted it on 2026-11-25).
  `.maestro/live/history.yaml` passes: it generates twice with real Gemini, corrects the
  username, copies one line and keeps another. A script then reads Supabase and confirms
  one person, two interactions under that person sharing one stored screenshot, six
  lines, one copied and one kept. It opens People and the timeline, marks the copied line
  Replied, and confirms that in Supabase too. Everything it saved is deleted at the end.
  Screenshots in `.maestro/artifacts/phase-5/`.
- **Privacy:** `npm run test:privacy` passes on the real project (52 checks; history
  rows and screenshots included).
- **A bug the tests caught:** the person screen could show no "How you know her" choice
  when it opened before the people list had loaded. Fixed.

Known limits:

- **Memory is proven by unit tests, not by the live run.** The tests confirm the second
  prompt contains the first interaction. The live run cannot see the prompt. In it, one
  of the three Flirty lines reused the hook (the 48 degrees) of the Casual line that had
  been copied, although the prompt tells the AI not to. Worth watching when you judge
  the lines.
- **The other live flows were not rerun** after this phase, to save the Gemini free
  limit. The history flow uses the same Generate screen steps.

- **The first set for a new screenshot has no memory.** The username is only known once
  the AI has read the screenshot, so memory starts with the second set (another tone,
  New lines, Shorter, Bolder) and every later screenshot of a person whose username was
  typed or read before.
- **The automatic result is untested on real chats.** There are no chat screenshots in
  `samples/` yet. It is covered by unit tests with stand-in answers.
- **A person cannot be deleted or renamed from the People screen yet**, and there are no
  notes. Say if you want these in this phase.

### Phase 5.5 — App feel

Goal: Banter looks and behaves like a phone app: icons, a bottom tab bar, dialogs and
sheets, more than one colour, and no screen you have to scroll through to use.

Added on 2026-11-25 at your request, before Phase 6, so My tones and the rest of
Settings are built with these parts from the start instead of being redone.

**Layout rules** (they apply to every screen from now on, and I check them in tests):

1. **One job per screen.** Choosing a screenshot is one job; reading the lines is another.
2. **Lists scroll. Nothing else should need to.** A screen that is not a list fits on one
   phone screen. A form too long for that is split into steps.
3. **The main button is pinned to the bottom**, always in reach without scrolling.
4. **Detail is one tap deeper, not unfolded in place.** A list shows short rows; tapping a
   row opens its own screen.
5. **A choice that is rarely changed shows as one row** with its current value, and opens
   a sheet to change it.
6. **Small edits and confirmations happen in a sheet or a dialog**, not on a new page and
   not inline in the middle of other content.

**Step A: building blocks.** Built and shown on the dev-only gallery screen first, so you
approve the look before any real screen changes.

1. Icons: one `Icon` component on `expo-symbols`, which Expo recommends (Apple's symbols
   on iOS, Google's on Android). `@expo/vector-icons` is being retired, so it is not used.
2. Colours: every theme gets info, warning, success and danger, each as a soft background
   with a matching text colour. Still defined only in `src/theme`.
3. Cards and rows: raised, outlined and tinted cards. A list row with an icon or an
   initial on the left, two lines of text, and an arrow on the right.
4. Controls: a segmented control (for the four modes), a one-line chip row that scrolls
   sideways (for tones), and a bottom action bar that stays pinned.
5. Dialog: a confirm dialog, in the danger colour for deleting and signing out.
6. Sheet: a bottom sheet for small edits and pickers (Expo Router's `formSheet`).
7. Toast: a short message at the bottom for "Copied", "Kept", "Saved".
8. Vibration: a light tap on Copy, Keep and errors (`expo-haptics`).

**Step B: navigation.** The tab bar and the new routes, with today's content moved into
them unchanged, so the structure can be tested before the screens are redrawn.

1. Bottom tab bar in the app's own theme colours: Generate, People, Settings. The
   system-drawn tab bar is not used: on new iPhones its colour cannot be set and it does
   not follow the in-app theme. (I read Expo's page for the system one; I will read the
   page for the themed one before building.)
2. The tab bar is hidden on screens opened on top of a tab (Results, Person, Screenshot
   detail, key and profile forms), which have a Back button instead.
3. The current screenshot and its line sets are held above both Generate and Results, so
   going back and forth loses nothing.

**Step C: the screens, one at a time.**

1. **Generate:** a large screenshot area (tap for the latest, or pick from the gallery),
   the modes as a segmented control, the tones as one row of chips, "How you know her" as
   one row that opens a sheet, and "Get lines" pinned to the bottom. No scrolling.
2. **Results:** opens when the lines arrive. The screenshot as a thumbnail and "Saved
   under @username" at the top (tap to correct it in a sheet). One set of three lines on
   screen. Earlier sets are still never replaced: a row of chips ("Casual", "Flirty",
   "Flirty · Shorter") switches between them instead of stacking them down the page.
   Another tone, New lines, Shorter and Bolder sit in the pinned bottom bar. Kept lines
   open from a "Kept (2)" button into a sheet. Copy shows a toast and a tap.
3. **People:** rows with an initial, the username, how you know her and when. A search
   field once the list is long.
4. **Person:** her name and how you know her at the top (changed in a sheet), then one
   short row per screenshot: thumbnail, date, tones tried, and an icon for how it went.
5. **Screenshot detail:** opens from a row. The same layout as Results, with Copied, Kept,
   Replied and No reply. This replaces the long timeline.
6. **Settings:** a short list with icons: Profile, API keys, Theme, Sign out. Sign out and
   every delete ask in a dialog first.
7. **Keys, Profile, Sign in, Onboarding:** icons, the new cards, pinned main buttons, and
   any form longer than one screen split into steps.

How I test: each layout rule that can be checked is checked. On the smallest phone the
app supports, a Maestro flow confirms the main button of Generate and of Results is
visible without scrolling, and that three lines fit on Results. Every existing flow is
updated for the tab bar and must still pass, including the two live ones for Generate
and history. Unit tests cover the new parts. Screenshots of every screen in all three
themes at the end of each step.

What it costs: no database changes. One rebuild of the simulator app, because icons and
vibration are native parts. Nothing that Phase 5 saves changes.

**Phase 5.5 result (2026-11-26):** built, tested on the simulator, approved and pushed. `npm run check` passes (528 unit tests). The offline Maestro flows pass.
The five live flows pass against the real Supabase project with real Gemini answers.
Screenshots in `.maestro/artifacts/phase-5.5/`.

Built:

- **Tab bar:** Generate, People, Settings, in the theme's colours, with icons.
- **Generate tab:** only the screenshot and the choices. Modes are a segmented control,
  tones one row of chips, "How you know her" one row that opens a sheet. "Get lines" is
  pinned to the bottom. It fits on one screen.
- **Results screen:** opens the moment "Get lines" is tapped and shows "Reading the
  screenshot…" until the lines arrive. One set of three lines on screen; chips switch
  between sets, so nothing is replaced and nothing stacks. Tone, New lines, Shorter and
  Bolder are pinned to the bottom and act on the set being looked at. Kept lines open in
  a sheet from a counter at the top. The username is corrected in a sheet. A failed
  request is explained here, with Try again repeating exactly what failed.
- **People tab:** rows with an initial, the username, how you know her and when; a search
  field from eight people on.
- **Person:** her name, "How you know her" as one row, then one short row per screenshot
  with the tones tried and how it went (She replied, No reply, Sent, Not used).
- **Screenshot detail:** opens from a row. The screenshot is a thumbnail (tap to see it
  large); the sets are behind chips; a copied line can be marked She replied or No reply.
  This replaces the long timeline.
- **Settings tab:** a short menu with icons: About you, AI keys, Theme (its own screen),
  Sign out. Sign out asks in a dialog first.
- **About you:** six rows showing what is saved (Name, Age, City, Work or study,
  Interests, How you text). A row opens a sheet with that one field and Save.
- **AI keys:** one row per key with its state and model, and up and down arrows for the
  order. "Add a key" is pinned to the bottom. A row opens the key.
- **One key:** a short menu: Name and Model open sheets, then Turn off, Check again and
  Delete. Delete asks in the app's own dialog. What the provider said about a rejected
  key is shown here in a red notice, not in the list.
- **Add a key:** provider as a segmented control, the key, Model as one row that opens a
  sheet, an optional name. "Check and save" is pinned.
- **Onboarding:** three steps that each fit on one screen with Continue pinned: about you
  (name, age, city, work), how you sound (interests, how you text; optional), your key.
  It was two steps with one long form.
- **Sign in and sign up:** buttons pinned to the bottom; problems shown as notices.
- **Building blocks** (`src/components/ui`): icons, icon buttons, banners in four colours,
  list rows, avatar, segmented control, chip row, option list, sheet, dialog, toast,
  pinned footer, raised and tinted cards. All shown on the dev-only gallery screen.
- **Feedback:** a toast for Copied, Kept and Saved, and a light vibration on copy, keep
  and when lines arrive or fail.
- **Colours:** info and warning joined success and danger, each with a soft background,
  in all three themes. Contrast is checked by tests.

Changed from the plan above, with the reason:

- **Sheets and dialogs are React Native's `Modal`, not Expo Router's `formSheet`.** A
  sheet has to hand a value back to the screen under it and be covered by unit tests; a
  route cannot do the first simply.
- **Results opens on the tap, not when the lines arrive.** Better feedback, and one screen
  less that appears by itself.
- **The tab bar is `Tabs` from `expo-router/js-tabs`.** Read from the installed package:
  the `expo-router` export I knew is deprecated in SDK 58.

Not done in this phase:

- **The "Could not load your account" and crash screens** were left as they were.
- **Only the iPhone 17 simulator was used.** The "fits without scrolling" check has not
  been run on a small phone, and nothing was run on Android.
- **Screenshots in all three themes** exist for the gallery only.
- **My tones tab** comes with Phase 6.

Found while testing, and what was done:

- **A lost first tap in development mode.** About one live run in three, the first tap on
  Results after the lines arrived did nothing, and the next tap worked. With logging in
  the app, the tap never arrived at all; a screen recording showed nothing on screen. It
  was not the screen sliding in, the vibration, or the screen being rebuilt. With the
  app's code in production mode it did not happen in 8 runs. The exact cause inside the
  development build is not known. The live flows now run in production mode, as the app
  ships (`npm run e2e:live` starts its own server on port 8082). This should be watched
  for on a real phone in Phase 8.
- **A Phase 5 bug: the AI refused to write a second tone.** A line copied a moment ago,
  for the screenshot still being worked on, was passed to the AI as "sent, waiting for a
  reply". It read that as silence and answered "do not chase". Fixed: sets made for the
  same screenshot are now passed as "already offered", never as sent, and the prompt says
  that only "sent, no reply" counts as unanswered.
- **The automatic Replied / No reply from a chat screenshot does not work yet.** It needs
  the person's history in the prompt, and for a new screenshot the person is only known
  after the AI has answered. Phase 5 listed "the first set has no memory" as a limit; this
  is its consequence, and I had not seen it then. Marking by hand works. A fix: have the
  AI report the sender's last message in the chat and whether she answered it, and match
  that to the saved line afterwards. To be decided with Phase 6.
- **A failed live run can no longer leave your key in a test account:** the flows that
  use the real key remove it and the saved history however the flow ends.

### Phase 6 — Personal prompts

Goal: each user shapes the tones, and you can change defaults at any time.

1. My tones screen, as its own tab: a list of tones; tapping one opens it to edit its
   definition. Add a custom tone, reset to default.
2. "Personalise for me": the model reads your profile and your history (which lines you
   chose, which got replies) and suggests changes to your tones. You accept or reject.
3. The app fetches default prompts from Supabase on start and keeps a copy for
   when there is no internet.

How I test: edit Flirty in the app and confirm the next prompt uses the new text. Change
a default in Supabase and confirm the app picks it up without a rebuild.

**Phase 6 result (2026-11-26):** built, tested on the simulator, approved and pushed. `npm run check` passes (593 unit tests). The three offline
Maestro flows pass, and all six live flows pass in one run against the real Supabase
project with real Gemini answers. Screenshots in
`.maestro/artifacts/phase-6/`. No database change was needed: the `user_prompts` table
from Phase 1 already holds edited and own tones.

Built:

- **My tones tab:** Banter's five tones, then the ones you made, each as one row showing
  what it says. An edited tone is marked "Edited", your own "Yours".
- **One tone:** one text box and a pinned Save. One of Banter's tones can be reset (the
  dialog shows the text that comes back). A tone you made also has a name and can be
  deleted. Names must be unique; a definition is at most 600 characters.
- **Your tones are used everywhere tones are chosen:** the chips on Generate and the Tone
  sheet on Results. Shorter and Bolder stay in the tone of the set they adjust. An edit
  takes effect on the very next request.
- **History records which version wrote the lines** (`interactions.user_prompt_id`). Lines
  written with a tone you later delete are kept.
- **Personalise for me:** first shows what will be read (how many lines you copied, how
  many got a reply, whether "How you text" is filled in). The AI then returns a short
  summary and suggestions, one row per tone, each with its reason. A row opens a sheet
  with "Now" against "Suggested"; nothing changes until you tap "Use this".
- **What Personalise sends:** your tones, your age, work, interests and "How you text",
  and up to 40 recent sets of lines with what you did with each. No screenshot, no
  usernames, not your name or city. It goes to your own AI provider with your own key,
  like a generation.
- **Limits on what the AI may suggest:** style only (length, wording, punctuation, emoji,
  directness). It may not remove a safeguard a tone already has ("never sexual"), put
  facts or example lines into a definition, or tell the writer to push after silence. One
  or two lines do not count as a pattern. Suggesting nothing is allowed.
- **Defaults from Supabase:** on start the app reads the active core rules, the modes and
  the tones, keeps a copy on the phone, and falls back to the copy built into the app.
  The first time My tones is opened after a start, they are read again.
- **Toasts moved to the top of the screen.** At the bottom they covered the pinned button.

Decided during the phase, with the reason:

- **Supabase's defaults are used only when they are at least as new as the app's own**
  (by the core rules' version number), and complete. Supabase holds version 1 today and
  the app version 5 (confirmed live on 2026-11-26), so without this rule the app would go
  back to the first prompts. Once Supabase is at the app's version or above, a change
  made there to any tone, mode or rule is picked up on the next start, with no new build.
- **Only tones can be personalised, not modes.** The table allows a personal version of a
  mode; the app does not offer it. A mode says what the screenshot is and what to return,
  and a user edit there can break the answer.
- **Own tones are saved straight to Supabase, not through the offline queue.** Like keys:
  editing a tone without internet shows "No connection" and keeps the text on screen.

What you need to do:

- **Done on 2026-11-26** (as part of the Phase 7 update): Supabase's prompts are at
  version 5. Previously: **paste `supabase/paste-prompts.sql` into Supabase > SQL Editor and press Run.** It
  brings Supabase's prompts to version 5 (safe to run twice). Until then the app keeps
  using its own copy, and "change a default in Supabase" has no effect. After it, to test:
  change the Casual definition in the `tones` table, reopen the app, open My tones.
  This is the one part of the phase I could not test end to end, because only you can
  write to those tables. The reading and the choosing between the two copies are tested.

Not done in this phase:

- **Automatic Replied / No reply from a chat screenshot** (found in Phase 5.5) is still
  open. The fix changes the core rules and the answer format for all three providers, and
  cannot be checked without chat screenshots. It waits for those.
- **Personalise was run live with thin evidence only** (one copied line and a filled-in
  "How you text"). How good its suggestions are with weeks of real use is not known.
- **One rare path is written but not tested:** lines made offline with a tone of your
  own, which you then delete before the phone is online again. They should be saved
  without the link to the tone.
- **No small-phone or Android check**, as in Phase 5.5.

Found while testing, and what was done:

- **The live flow proved the edit reaches the AI.** Flirty was changed to end every line
  with one odd word; all three lines Gemini wrote ended with it.
- **Two Maestro traps, both in the flows and not in the app** (now in AGENTS.md): a tap
  on a multi-line field puts the cursor mid-text, so "erase" leaves half of it; and the
  simulator's keyboard can slide up just after typing, so a tap on a sheet's button lands
  on the space bar. `common/tap-after-typing.yaml` handles the second in every flow that
  saves from a sheet.

### Phase 7 — Settings and polish

Goal: the app feels finished for daily personal use.

1. Settings: profile, keys, data controls (stop saving screenshots, delete a person,
   delete all history, delete account data).
   Theme picker: three preview cards, tap to switch. The choice is saved in the user's
   profile so it follows them to another phone, and cached on the phone so the app
   opens in the right colours before sign-in finishes.
2. Usage view: how many generations per provider, model and key.
3. Empty states, loading states, small animations. (Haptics, icons, dialogs and the
   tab bar moved to Phase 5.5.)
4. App icon and splash screen for Banter. **Done on 2026-11-25** (see Phase 4 result).

How I test: full Maestro run of every flow. Deletions confirmed in the database and
in storage.

**Phase 7 result (2026-11-26):** built, tested, approved and committed. `npm run check` passes (621 unit tests) and
`npm run test:db` passes (89 checks). The three offline
Maestro flows and the six earlier live flows pass. The new live flow (`live/data.yaml`)
passes against the real project after you applied the update on 2026-11-26: theme
remembered after a restart; screenshots off (lines saved, no file stored) and on again;
Usage counting two generations; a person deleted; all history deleted; the account
deleted, after which the same email and password are refused. Each step is confirmed by
reading Supabase and its storage directly, not only the screen. Screenshots in `.maestro/artifacts/phase-7/`.

Built:

- **Theme is remembered.** Before this phase it went back to Midnight Plum on every
  start. Now the choice is kept on the phone (so the app opens in the right colours, even
  on the sign-in screen) and saved in the profile (so it follows you to another phone).
- **Settings > Your data:** a short menu.
  - *Save screenshots* on or off. Off: lines are saved as before, the picture is not sent
    to Supabase. Sets made from one screenshot still stay together in her history.
  - *Usage* opens its own screen.
  - *Delete all history*: every person, line and stored screenshot, and anything still
    waiting on the phone to be sent. Keys, tones and the profile stay.
  - *Delete my account*: the stored screenshots, then the login itself; every row goes
    with it. The app then signs out.
  Both deletions ask first, in the danger colour.
- **Delete a person:** a bin button on her screen. Her lines and screenshots go with her.
- **Usage screen:** a total, then one row per key and model, for this month or all time.
  Counted in the database (a view), so the numbers are exact however long the history is.
- **Empty states** with an icon, a title, a sentence and, where there is one obvious next
  step, a button: People, a person with nothing saved, Results, Keys, Usage.
- **Small animations:** lines arrive one after the other with a short fade; toasts and
  empty states fade in.
- **Sign in and sign up on one screen** (asked for on 2026-11-26): the logo, then a
  "Sign in | Sign up" switch, then the form, all in the middle of the screen. Switching
  changes the form in place and keeps the email typed. The separate sign-up screen is
  gone. This screen keeps its button inside the form, under the fields, instead of pinned
  to the bottom: a short centred form is easier to take in at a glance, and the keyboard
  never covers a centred button for long.
- **Clear button on Generate** (asked for on 2026-11-26): a ✕ on the screenshot's corner
  goes back to no screenshot, ready for a new one. The person, context and lines on screen
  go; mode and tone stay. Nothing is deleted: every set was saved to People when it
  arrived. Before this, the only way to start over was to pick another screenshot.

Database change (`20261126000500_account_and_usage.sql`):

- `delete_my_account()`: a function that deletes the signed-in user. It takes no
  argument, so it can only ever delete the caller. Signed-out visitors cannot call it.
- `usage_summary`: a view over `interactions`, read with the caller's own rights, so a
  user sees only their own counts.

Changed from the plan above, with the reason:

- **"Delete account data" became "Delete my account".** Emptying an account but leaving
  its login behind helps nobody, and app stores require that an account made in the app
  can be deleted in the app.
- **No usage per day or cost.** Banter does not know what a request cost; the provider's
  own dashboard does. The screen says so.

Not done in this phase:

- **The "Could not load your account" and crash screens** are still as they were.
- **No small-phone or Android check**, as before.
- **Screens are not animated between each other beyond what the system does.**

### Phase 7.5 — Bolder flirting

Added on 2026-11-26 at your request. You tried Flirty on a story of a close friend you
flirt with, and the lines were about the wallpaper and the song. The cause was our own
rules, not the AI: they banned any comment on how she looks and anything suggestive
without a chat, for everyone, and the AI did not know she was a close friend.

Built:

- **The rules depend on how well you know her** (core rules version 6). Stranger or
  mutual follow, or not set: as before, nothing about how she looks. Know her or already
  talking: a confident compliment on how she looks is fine, and tension, teasing and
  innuendo when the tone asks for heat. Whatever the context: never specific body parts,
  never rating her body, never crude, nothing explicit unless she is already there in the
  chat. No pressure, no chasing after silence, and the under-18 stop, as before.
- **A sixth tone, Spicy**, after Flirty. Bold flirting with real heat: says what seeing her
  does to him, teases, dares her a little, innuendo rather than spelling it out, a little
  cocky, never needy. With a stranger the heat comes from confidence and wit only. Flirty
  stays the warm, light one.
- **"About her": a note per person** on her screen ("close friend, we flirt a lot, she
  flirts back"). It goes into the prompt, and the AI uses it to judge how bold to be. It
  is never quoted to her. Saved through the offline queue like the rest of her history.
- **"Who is she" on Generate**, once a screenshot is chosen and anyone is saved: pick her
  before asking, so the very first set already knows her note, how you know her, and what
  you sent her before. Before this, all of that reached only the second set, because her
  username is read from the AI's first answer. This also gives the automatic Replied / No
  reply (Phase 5.5 finding) what it needs, when you pick her.
- **The three lines may take different angles on the same detail** (core rule 10), so a
  selfie can get three lines about her instead of one about her and two about the room.
- **A tone missing from Supabase no longer loses lines.** Spicy is new in the app; until
  Supabase's tones table has it, a Spicy set is saved without the link (its name is kept).
- `npm run lines` takes `--her "note"` and `--tone spicy`.

Measured on your sample IMG_5214 (Gemini 3.5 Flash-Lite, Story reply, Know her, with a
note), three runs each:

- Before (version 5, Flirty): "Are you ever going to show your face in these mirror pics…",
  "Playing Adele while plotting a whole wall takeover with paper butterflies".
- After (version 6, Spicy): "that black dress is dangerous, do you even want me to survive
  today", "adele in the background plus that outfit? you are actually trying to ruin me",
  "you know what that black dress does to me".
- Spicy with Stranger stays clean: no comment on her looks, no innuendo.
- The cheap model still sometimes spends one line on the background. A stronger model
  should do better; Gemini 4 Hydrogen was overloaded (HTTP 503) on every try that day,
  so that comparison is still to do.

Supabase: you pasted `supabase/paste-prompts.sql` on 2026-11-26. Supabase now holds core
rules version 6 and six tones, Spicy included (checked the same day).

Added the same day, at your request:

- **Choose which tones show on Generate.** The tone row starts with a "Tones" button that
  opens every tone in a sheet: tap one to use it, tap its eye to show it on Generate or
  hide it. A search field appears from eight tones on, so 50 tones stay manageable. The
  tone in use always shows, even a hidden one. Hidden tones are kept in your profile's
  settings, so the choice follows you; a tone you make, or one Banter adds later, shows
  until you hide it. Each tone's own screen has the same switch ("Show on Generate"), and
  My tones marks hidden ones. Results' "Another tone" uses the same sheet.
- **"New tone" in that sheet**, so a tone can be made from Generate. No build is ever
  needed for a new tone: your own in My tones > Add a tone; one for every user as a row in
  Supabase's `tones` table (picked up on the next start, once Supabase is at version 6).
- **Image formats checked on the simulator:** a HEIC, a PNG, a JPG and a JPEG, each put
  in the photo library and opened with "Use latest". All four opened as their own picture.
  The app converts every picture to JPEG (at most 1280 px) before it is shown, sent or
  stored, so the format of the original does not matter. Found on the way: "Use latest"
  orders by the time a picture was taken, not when it was added; `scripts/sim-photos.sh`
  said otherwise and now says this.
- **Seen once, not explained:** in one live Generate run, tapping the older set's chip on
  Results landed the app back on Generate (with everything kept). The rerun passed, as did
  every earlier run of that step. Nothing in the app navigates on that tap. To watch for
  on the phone in Phase 8, like the lost first tap of Phase 5.5.

### Phase 7.6 — Learn a tone from an example

Added on 2026-11-26 at your request: you see a line you like on Instagram but do not know
what to call its style.

Built:

- **My tones > Learn from an example** (also "From an example" in the Tones sheet on
  Generate). Give it a screenshot of the comment or message, or paste the line.
- **The AI finds the line** (up to three when the screenshot has several; chips switch
  between them) and shows: the line, a name for the style, what makes it work in plain
  words, the style written as a tone, and two lines in that style about other things.
- **New tone** opens the tone editor filled in: the name, and the style with the example
  after it, marked "never to be copied word for word" (an example teaches the move better
  than a description alone). **Add to a tone** opens a chosen tone with the style added
  to its description. Either way you see and can change the text before saving, and
  nothing is saved until you press Save. After saving, Back goes to My tones.
- **Limits:** it learns the structure, the wit and the confidence, never the example's
  words. A crude example is either cleaned up or declined; harassment, threats, anything
  aimed at someone who may be under 18, and screenshots with no line from a person are
  declined with the reason.
- No database change: a learned tone is saved like one you make yourself. One AI request
  on your own key, with the screenshot or the text, like getting lines.

Tested:

- `npm run check` passes (671 unit tests).
- With real Gemini answers: "you look like you'd steal my hoodie and then act like it was
  always yours" became "Playful assumption", with new lines like "you look like you would
  eat all the fries off my plate after saying you were not hungry". A crude line about
  her body was declined, and so was a story screenshot with no message on it.
- The live tones flow now also learns from a pasted line, saves it as a tone and finds it
  in My tones. Passes against the real Supabase project.
- Found on the way: the live flows assumed the app starts on a tab. If someone has used
  the simulator in between, it can open on any screen; `common/ensure-signed-out.yaml`
  now goes Back until the tabs show.

### Phase 7.7 — Tune my tones

Added on 2026-11-26 at your request: Banter asks what you want from it, and rewrites its
own tones to fit.

Built:

- **About you > "What you want from Banter"**, the first row. Its sheet asks for who you
  message, what you want to happen and how you want to come across, and counts the words:
  20 or more are needed to tune. Kept in the profile's settings (no database change).
- **It also goes into every line prompt** ("What he wants from these chats"), and into
  Personalise for me.
- **About you > Tune my tones** opens a screen that says exactly what will change: Banter's
  six tones, by name, and that the tones you made stay as they are (listed by name). With
  fewer than 20 words it says so and cannot run. The AI rewrites the six from Banter's own
  wording every time (so tuning twice does not drift), keeping each tone's character and
  every safeguard. Each result opens a sheet with "Now" against "Tuned"; nothing is saved
  until **Save all**. A tone you had already changed is replaced.
- **About you > Reset tones** (after a dialog) puts Banter's six tones back to Banter's
  wording. Your own tones stay. Disabled when nothing is changed.
- A tuned definition that runs long loses whole sentences from the end, never half a
  word, so a safeguard is never cut in two (found in the first real run: Spicy was cut
  mid-word in its last sentence).

Tested: `npm run check` passes (692 unit tests). The new live flow `live/tune.yaml` passes
against the real Supabase project with real Gemini answers: write a goal, tune, compare,
save all, see Banter's tones marked Edited in My tones, reset, see them back.

### Better replies (built on the branch `better-replies`, merged 2026-11-26)

Added on 2026-11-26 at your request, before the phone builds: help take a chat somewhere,
and learn from what you pick. Kept on its own branch until you approve it.

Built:

- **"Where to take it" on Generate, in Reply mode:** Keep it going (as before), **Turn up
  the heat**, or **Ask her out**. Shown under the title, so long choices are not cut off.
  Back to Keep it going with each new screenshot: it is a choice about one conversation.
- **Turn up the heat:** the AI first reads where the chat stands and says it ("Where it
  stands", above the lines), then writes three lines one step hotter than the chat is now,
  each a different move (turn the topic to the two of you, a tease or dare, a "what if"
  question), each leaving her an easy way to match or laugh it off. Suggestive, not
  explicit, unless she has already gone further. If she is cold or deflecting it says so
  and writes warm lines instead. With a stranger it stays clean. Shorter and Bolder on
  such a set stay on the heat.
- **Ask her out:** a read of whether it is warm enough, then three specific, low-pressure
  ways to suggest meeting, tied to the chat where possible.
- **Your taste in every prompt:** up to five lines you chose before, with anyone (the ones
  that got a reply first), as examples of your taste and voice, never to be copied; and up
  to three you turned down, with why. Read again at most every five minutes, or at once
  after you copy, keep or mark a line.
- **"Not for me" on every line** (thumbs down): too much, too tame, cringe, not like me, too
  long, too generic. Shown on the line, can be taken back, saved with the line, used in
  the next prompts and read by Personalise for me.

Added the same day, at your request (using the "Not for me" reasons):

- **Fix it right away.** After choosing a reason, the sheet offers one tap to a new set
  made for it: too much → softer, too tame → Bolder, too long → Shorter, cringe → less
  cringe, not like me → more like you, too generic → more specific. Or "Just note it".
  The set is named for the fix ("Casual · Story reply · Softer").
- **Each tone calibrates itself.** Banter counts your reasons per tone over your latest 40
  sets. Two or more of the same reason add a note to that tone in the prompt ("Lately he
  marked lines in this tone as too much (4 times). So: keep this tone a notch lower"). No
  extra AI request, and it follows your newest marks.
- Tested with real Gemini on the made-up warm chat: "just waiting for an excuse to come
  take care of those dead legs", marked too much, became "you might just give me a reason
  to change that"; Spicy after four "too much" marks gave "keeping my evening wide open
  for the right offer". `npm run check` passes (722 unit tests).

Added the same day, at your request: **People > Saved.**

- A **People | Saved** switch at the top of the People tab. Saved lists every line you
  saved, for anyone, most recently saved first, each with who it was for, the tone and
  when ("@her · Flirty · 2 hours ago"). Tap to copy; the bookmark takes it out of Saved.
  Read again every time the tab is opened, after sending anything still waiting, so a line
  saved a moment ago shows. One request returns the lines with the person and the tone
  (checked against the real project with a throwaway account).
- "Keep" is now called "Save" everywhere (the bookmark, the toast, the sheet on Results),
  to match. A line's spoken label now includes its caption, so a screen reader hears who
  a saved line was for (and test tools can see it).
- The live history flow checks Saved after saving a line on Results. Passes against the
  real project. `npm run check` passes (728 unit tests).

Added the same day, at your request:

- **Reply language: English or Roman Urdu.** A "Language" pill on Generate switches it; the
  choice is saved in the profile's settings and used for every request until switched
  back (Shorter, Bolder and the fixes too). Roman Urdu means Urdu in English letters, the
  way people in Pakistan text, with English words mixed in naturally; never Urdu script or
  Hindi words. Everything else in the answer stays English. Real Gemini output on the
  made-up chat: "Soch lo, agar main aa gaya toh phir sirf baatein nahi hongi"; on your
  sample story: "Adele ke gaane aur itna black? Serious mood lag raha hai". No database
  or core-rules change (the instruction goes in the per-request part of the prompt).
- **A calmer Generate screen.** "Use latest" and "From gallery" moved into the screenshot
  area (two buttons while it is empty; two small icons on the preview once chosen, next to
  the ✕). Who is she, How you know her, Where to take it and Language are now small pills
  on one wrapped line instead of a full row each; each opens its own choice as before, and
  Language just flips. The screen went from ten blocks to six, and the screenshot gets
  back the room the rows took.
- **Saved: open where a line came from.** Each saved card has an icon that opens the
  screenshot it was saved from (People > her > that screenshot). Not shown for a line
  saved before her username was known.

Database and prompts (`supabase/paste-update.sql`, pasted by you on 2026-11-26 and checked: version 7 active, a reason saves, an unknown one is refused):

- `20261127000600_line_feedback.sql`: a `feedback` column on lines, limited to those six
  reasons. Until it is pasted, a "Not for me" mark shows in the app but is not saved.
- Core rules version 7: the answer format gains "read" (left empty unless a direction
  asks for it). Until pasted, the app uses its own copy of the prompts, as designed.

Tested:

- `npm run check` passes (714 unit tests); `npm run test:db` passes (91 checks).
- With real Gemini, on a made-up chat between two invented people ("what are you up to
  tonight" after flirting about the gym): Spicy + Turn up the heat gave "just figuring out
  how to convince you to let me come over and take care of those dead legs", with the read
  "She is matching his playful energy". On a made-up cold chat ("maybe", "busy") it backed
  off: "She is pulling back… keep it completely low-pressure", and wrote "All good, enjoy
  your weekend". Ask her out gave "free tonight if you want to grab dinner and I can carry
  you to the table".
- New live flow `live/heat.yaml` passes: Reply, Turn up the heat, Already talking, Spicy,
  the read on screen, then Not for me with a reason. It needs a chat screenshot as the
  newest photo in the simulator (the made-up one is in this session's scratchpad only).
- In Reply mode with Who is she, Where to take it and How you know her all showing, the
  screenshot area on Generate gets small, and on a phone smaller than the iPhone 17, or
  with the no-key notice showing, the screen scrolls a little.

### More providers, best model first (branch `more-providers`, merged 2026-11-27)

Asked for on 2026-11-26: the Gemini free tier was hitting its limits ("You have reached a
rate limit" on Gemini 4 Hydrogen, 5 a minute and 20 a day). Find free providers, add
them, and "always start with the best model; when it is finished, move to the next one
automatically".

What was found (each provider's own docs, read 2026-11-26):

| Provider | Free | Reads a screenshot, keeps to a JSON schema | Added |
|---|---|---|---|
| Gemini | Per model: Hydrogen, 3.8 Flash, 3.6 Flash 20 a day each, Flash-Lite 500 | Yes | 2 more models |
| Groq | Free plan, very fast; limits per model | Qwen 3.8 27B (preview). Llama 4 Scout was shut down 2026-07-17 | Yes |
| OpenRouter | Free models: 50 a day for the account, 1,000 after a one-off $10 top-up | Nemotron 3.5 Super VL, Ling 3.2 Flash | Yes |
| xAI (Grok) | No free credit in its docs: credit must be bought first | Grok 4.7 | No |
| NVIDIA (build.nvidia.com) | Trial credits; amount, key check and image limits not in its docs | Nemotron VL, Kimi | Not yet: needs a key to test with |
| GitHub Models | Shut down 2026-07-30 | | No |
| Mistral | Free API access ended around 2026-11 | | No |

Built:

- **Best model first, by itself.** Each model has a place in one order across all
  providers (`models.rank`, editable in the dashboard). A key with no model chosen is
  now **Automatic**: it offers every model of its provider. Banter tries the best model
  any of your keys can use first. With one Gemini key that means Hydrogen, then 3.8 Flash,
  3.6 Flash and Flash-Lite: about 560 free requests a day instead of 500, best first.
  Picking one model for a key still works (to keep a paid key on a cheap model).
- **A limit rests only that model.** When a model hits its limit, Banter moves straight to
  the next and remembers the rest on the key (`api_keys.model_limits`): as long as the
  provider says (Gemini's retry time, Groq's "try again in", a Retry-After header); for a
  daily limit until the time Gemini gives for the reset, or else an hour (tried again
  every hour, because providers reset at different times); five minutes when it says
  nothing. Resting models are still tried last, so a request
  never fails while something might answer. The key's own status changes only when the
  whole key is affected: rejected, or out of credit.
- **A busy model is passed over at once** (Gemini's "high demand" 503), and waited for only
  when nothing else answers. **A model that takes too long** is passed over too (60
  seconds while another waits in line, 90 for the last) and rests 10 minutes, instead of
  ending the request as "no connection".
- **Groq and OpenRouter keys.** One new adapter for both (OpenAI's Chat Completions format,
  `src/engine/adapters/chat-completions.ts`). OpenRouter requests go only to hosts that
  keep to the schema (`require_parameters`); Groq's Qwen is told to keep its thinking out
  of the answer. A key is checked before it is saved: Groq by its model list, OpenRouter by
  the key's own details (its model list is public and would accept any key). Keys starting
  `gsk_` and `sk-or-` are recognised.
- **Add key:** the provider is one row that opens a sheet saying what each costs (five
  providers no longer fit side by side), filled in from how the key starts. The model row
  starts on Automatic. The key's screen shows which models are at their limit and until
  when.

Tested:

- `npm run check` passes (808 unit tests); `npm run test:db` passes (100 checks).
- Live, with your Gemini key: Hydrogen answered "high demand", Banter moved on at once,
  and Gemini 3.6 Flash wrote the lines. Asked alone, 3.8 Flash gave no answer within 90
  seconds, which used to end the request.
- With your Groq and OpenRouter keys (2026-11-26): both pass the key check (OpenRouter:
  free tier, 50 free requests a day). One real story each: Groq's Qwen answered in 2.3
  seconds, OpenRouter's Nemotron in 25 seconds, both with good lines in the right format.
  Ling's free host answered "temporarily rate-limited upstream": now told apart from the
  key's own limit ("OpenRouter's free model is busy right now"), rested one minute.
- The whole order live, every free key in one request: Hydrogen "high demand" (2 s), 3.8
  Flash no answer for 90 s, 3.6 Flash answered (110 s in all). So: a model now gets 60
  seconds while another waits in line (the last one still 90), and one that took too long
  rests 10 minutes, so only one request waits for it.
- Qwen filled in "Where it stands" without being asked; a read is now dropped unless
  "Where to take it" asked for one.

Database (`supabase/paste-update.sql`, pasted by you on 2026-11-26 and checked: 11 models
in order, `model_limits` on keys): `20261128000700_more_providers.sql` allows the two
providers, adds `models.rank` and `api_keys.model_limits`, and adds the five models.

The order (`rank`, 1 is best) is a first guess, to be checked with your keys on your own
samples: Claude Opus, Claude Sonnet, Gemini 4 Hydrogen, GPT-6 Luna, Gemini 3.8 Flash,
Claude Haiku, Gemini 3.6 Flash, Gemini 3.5 Flash-Lite, Groq Qwen 3.8, then OpenRouter's
free models.

Added on 2026-11-27, at your request, on the same branch:

- **Show the password:** an eye button in the password field on sign in and sign up.
- **Like a line (👍)** next to "Not for me" on Results: "Liked" on the card and a toast.
  Liked lines go first among the examples of your taste in every prompt (then lines that
  got a reply, then copied ones), and Personalise reads them. A line is liked or "not for
  me", never both: the newer choice replaces the other. Needs
  `20261128000800_line_likes.sql` (`lines.liked_at`).
- **Her note from the first set.** Until it is known who a screenshot is of, the prompt
  lists the notes on people (up to 20, newest first, 300 characters each, with how you
  know each one). The AI uses a note only if the screenshot clearly shows that username,
  and never mentions the notes. Once her username is known, only her own note goes in,
  as before. No extra request. Live on Flash-Lite: her "only replies when I joke" note
  turned the first set lighter; a list with only someone else's "flirts back hard" note
  changed nothing.
- **The order, from real lines** (four of your screenshots, Flirty, every free model,
  2026-11-27): Gemini 3.6 Flash and OpenRouter's Nemotron wrote the best lines (both slow,
  15 to 70 seconds); Flash-Lite good and fast (2.5 s); Groq's Qwen fastest but weakest
  (wordy, misread text, one line cut off); Ling busy every time. Hydrogen and 3.8 Flash
  were busy or at their 20-a-day limit and could not be compared. So Nemotron moves above
  Flash-Lite (`20261128000900_model_order.sql`).
- Groq's free plan allows 1,000 output tokens a minute on Qwen (about one request a
  minute). Its refusal links to its billing page, which Banter read as "no credit" and
  would have set the whole key aside; it is now a one-minute rest for that model.

### Better lines: research and core rules version 8 (2026-11-27)

Asked for on 2026-11-27: "our AI responses are basic, we need to level up". Research first,
then the build.

What the research found (sources in the session; studies and data first, books through
detailed notes): specific lines win (Hinge: a like with a comment is twice as likely to
lead to a date); short (40 to 90 characters did best on OkCupid); humour helps (a funny
opener got 12% more replies in a Tinder test; women prefer men who make the jokes);
compliment her choices, not her body (OkCupid: "beautiful", "sexy" got fewer replies);
statements with a point of view beat interview questions (Manson's Models, coaches);
playful assumptions, teasing, challenges, made-up scenarios and callbacks are the moves
that work; matching her texting style goes with mutual interest (Ireland et al. 2011);
heat comes from imagination and anticipation (Perel), one step at a time; never needy;
comedy craft: true detail, exaggerate, funny word last, never explain. Turn-offs:
negging, early sexual messages, dry replies, anything that sounds written by an AI.

Why the lines were basic: the rules were mostly guardrails with one line on craft, so
almost every line was "a verdict on an object + a question about it" ("That sweatshirt
goes hard. Where did you find it?"), with AI words ("elite", "iconic", "goes hard").

Built:

- **Core rules version 8:** what makes a line good (specific, a point of view, easy to
  answer, makes sense at once, fresh, short, not needy, funny part last); thirteen named
  moves (playful assumption, tease, exaggeration, misplaced focus, made-up frame,
  challenge, compliment with a twist, genuine notice, unfinished hint, honest reaction,
  plain interest, implication, build on her words), three different ones per set, chosen
  to fit the tone; five made-up examples of weak against strong; words that sound like an
  AI are banned (`AI_WORDS`), and stock jokes ("judging you", "plotting an escape"). Every
  safety rule is kept; the stranger rule now also covers makeup, expression and pose, and
  teasing about her body or weight is banned even indirectly. Light teasing about a
  harmless choice is a move with anyone; heat (sexual tension, innuendo) still only when
  they know each other or are already talking.
- **The answer names its move:** each line is now `hook`, then `move`, then `text`, so the
  model picks the detail and the move before writing (also the alphabetical order, which
  some providers use).
- **A final check from the app's code** at the end of every request (not editable in the
  database): real detail, makes sense, three different moves, none of the AI words, and,
  unless they know each other, nothing about her looks. Small models follow what they read
  last best.
- **Modes:** Story reply names the moves that suit a story; Opener asks for curiosity and
  nothing about her looks; Reply texts the way she texts (length, capitals, emoji, slang)
  and builds on what she said.
- **Tones rewritten** with what works for each, and each names its moves. **Three new
  tones** at the end of the list (so the order of the others does not change): Teasing
  (playful banter), Mysterious (says less, leaves her curious) and Sincere (warm, genuine).

Tested on your four sample stories (Flirty, "follow each other") and the made-up chats:

- Before, Flash-Lite: "That sweatshirt goes hard. Where did you find it?", "okay the black
  outfit is working". After: "table twenty four is judging your herb to noodle ratio",
  "name 3 other songs by them or the aux gets revoked" (Teasing), "that song reminds me of
  a terrible decision I almost made" (Mysterious), "anyone who finds the exact right meal
  for a 48 degree day has proper priorities" (Sincere).
- After, Gemini 3.6 Flash: "those bangles look like they announce your arrival three rooms
  away", "i bet you steal the aux cord without asking". Nemotron: "great taste in quotes,
  slightly alarming life philosophy", "violently remove you? that's a lot for a tuesday".
- Chats: "free tonight if you can still walk", "you get 5 minutes to negotiate my payment";
  the cold chat with Turn up the heat still backs off ("she is cooling off… do not push").
- Rounds of fixes from the tests: tones all sounded like jokes until each tone named its
  own moves; a weight joke ("those bracelets weigh more than you do") led to the indirect
  body rule; copied example openers ("you seem like…", "settle this") led to new examples
  and a rule to vary openings. Flash-Lite still uses a banned word in about one line in
  fifteen; the bigger models keep to the rules better.
- `npm run check` passes (829 unit tests); `npm run test:db` passes (103 checks).

Database: `supabase/paste-prompts.sql` (version 8, the four modes and nine tones), pasted by
you on 2026-11-27 and checked: version 8 active, modes and all nine tones match the app.

**Guide** (asked for the same day): a "?" button at the top right of Generate opens it.
Best setups first, one row per situation (her story when she doesn't know you, her story
when you're close, a first message, a chat going well, wanting it hotter, wanting to meet
her, not sure she's into you, Roman Urdu); each opens a page with the options to pick
(shown as they read on Generate), why it works, and a made-up example line. Then what
each option does: what you screenshot, tones, how you know her, where to take it, and the
rest. The words live in one file (`src/components/guide/guide-content.ts`); a test fails if
the guide names an option or a tone that Generate does not have.

### Feedback tickets (2026-11-27)

Asked for before the phone builds: one tap to report a problem, with everything needed to
fix it attached, plus a note; later, find the tickets by email and resolve them.

- **Report these lines** (under the lines on Results) and **Send feedback** (Settings). The
  kind: Lines, Wording, Bug or Idea, and a note (optional for a reported set). From Results
  the app attaches the set: mode, tone, how you know her, direction, fix, the model and the
  rules version, what it noticed, every line with its hook, move and what you did with it
  (liked, not for me and why, copied, saved), and the request exactly as sent. The
  screenshot too, unless switched off. Always: where it was sent from, the app version, the
  phone. "What's attached" lists it in plain words before sending.
- **Supabase** (`20261128001000_feedback.sql`): `feedback` and `admins`. A user adds tickets
  and sees only their own; the email is set by the database from the login; a sent ticket
  cannot be edited; only admins resolve, and an admin may open only reported screenshots.
  Nobody can make themselves an admin. 120 database checks.
- **Finding and resolving:** `npm run tickets -- someone@example.com` (or `--open`) signs in
  as the admin account (`admin-account.local.json`, not in git), prints each ticket with
  its set and lines, and saves the screenshot in `tickets.local/`. `npm run tickets --
  --resolve <id> "what was done"` resolves one; the user sees the resolution.
- The admin account is made with `npm run admin:setup`, which writes
  `supabase/paste-admin.sql` to paste once.

### Android share menu (2026-11-27)

Share a screenshot from Instagram or Photos straight to Banter: it opens Generate with the
image as the screenshot. Built on Expo's own `expo-sharing` (receiving is new and marked
experimental in SDK 58): its config plugin adds Android's share target for images, Expo
Router's `+native-intent` sends the share to Generate, and a hook hands the image to the
session once Generate is idle (a share that arrives while lines are being written waits).
Android only: an iOS share extension needs the paid Apple account. The module is loaded
only on Android, so builds made before it was added keep working.

### Phase 8 — Phone builds

Goal: Banter on your iPhone 16 and your Android 10 phone.

Decided 2026-11-27: Android first, with an APK made by EAS in the cloud; iPhone later (free
Apple ID from this Mac, or the paid account at Phase 9).

Ready (2026-11-27):

- `eas.json`: `preview` makes an internal APK (version code raised by EAS each build);
  `production` for later. Builds read the Supabase address and publishable key from EAS
  variables (plaintext: they ship inside the app); `.env.local` is never uploaded.
- **Never the work Expo account.** This Mac is signed in to Expo for work (a company
  account). EAS runs only through `npm run eas -- …` (`scripts/eas.sh`): the personal token
  from `expo-token.local` (not in git), a separate settings folder, and a stop if the token
  is the work login. Tested: no token stops it; a fake token is refused and the work login
  is not used in its place.
- Permissions: Banter does not need "display over other apps" or biometrics, which Expo's
  template and the secure-store module add; `android.blockedPermissions` removes them.
- The whole app ran on the Android emulator for the first time: sign-in, Generate, the
  Guide button, the new tones, and the share menu (a real share from Google Photos).
- Linked (2026-11-27): the EAS project `banter` under the personal account, its id in
  `app.json`; the personal token checked (`npm run eas -- whoami`); the two Supabase values
  set for preview and production.

Updates over the air (EAS Update, set up 2026-11-27):

- A JavaScript-only change (screens, wording, prompts, styles, images) reaches installed
  builds without a new build: `npm run ota -- "what changed"` (`scripts/ota.sh`). It runs
  `npm run check` first, then `eas update` on the `preview` channel (the APK) through the
  wrapper; `--channel production` is for store builds later.
- The phone downloads the update the next time Banter opens and runs it from the launch
  after that (Expo's default: it never holds up the launch). Settings shows
  "Banter 0.1.0 · updated 27 Nov, 14:05" once it runs one, and feedback tickets carry the
  update's id (`npm run tickets` prints it).
- Which builds an update fits is the runtime **fingerprint** (`runtimeVersion.policy`), a hash
  of everything native: native libraries, `app.json` plugins and permissions, the Expo SDK.
  Change any of those and the fingerprint changes: the update then reaches no installed
  build (nothing breaks), and a new build is needed. Checked: with `android/` and `ios/`
  gitignored, the fingerprint leaves them out (expo-updates treats the project as
  "managed"), so the one computed on this Mac matches the build's. See it with
  `npx expo-updates runtimeversion:resolve --platform android`.
- Development builds do not use updates: they load JavaScript from the dev server. The app
  reads expo-updates through a guarded `require` (`src/feedback/app-info.ts`), so a
  development build made before expo-updates was added keeps working.

The first APK (2026-11-27):

- Built on EAS: version 0.1.0 (code 2), 90 MB, channel `preview`, runtime fingerprint
  `c72739de…` (the same as computed on this Mac). Expo made and keeps the signing key.
  Before it, the Expo packages were brought to SDK 58's expected versions (`expo` 58.1.0)
  and Android was compiled locally with expo-updates.
- Checked on the emulator: it opens, signs in (so the Supabase values are in it), asks
  Expo for an update on launch ("No update available"), and has none of the blocked
  permissions.
- Found there: on Android the keyboard covered the sign-in password and button, every
  pinned footer, and the sheets. Android no longer shrinks the window for the keyboard
  (edge to edge) and `Screen` and `Sheet` handled it on iOS only. Fixed in both (checked
  on the emulator); to reach the phone as the first update over the air.
- First update over the air (2026-11-27, group `7fe347f2`): the keyboard fix. On the
  emulator with the real APK it downloaded on the first open and ran from the next one;
  Settings showed "Banter 0.1.0 · updated 27 Nov, 09:47".
- `npm run ota` publishes Android, then iOS, as two updates: `--platform all` also builds
  for the web, because Expo counts web as a platform when react-dom is installed.
  Declaring `"platforms": ["ios", "android"]` in `app.json` fixes that, but it changes the
  runtime fingerprint (checked), so it waits for the next build.
- Emulator tips: started without a window it can fall back to software drawing
  ("SwiftShader" in its log) and run about ten times slower (Android's own Settings took
  16 s to open). This office network also blocks outside DNS servers, which can leave the
  emulator unable to look up any name (updates then fail with "Unable to resolve host").
  Start it with `emulator -avd Pixel_8_Pro -gpu host -dns-server <the Mac's DNS server>`;
  `scutil --dns` shows it.

To build:

1. ~~Token in `expo-token.local`~~ and ~~`npm run eas:setup`~~: done 2026-11-27.
2. `npm run eas -- build -p android --profile preview`, then open the link on the phone.
3. On the phone: opening Banter from a share while it is closed (a development build
   cannot show this), the share menu from Instagram, Use latest, and sign-in.
4. Then one small JavaScript change through `npm run ota`, to see it arrive.

1. iPhone: build from this Mac with your free Apple ID. It needs reinstalling every
   7 days with one command.
2. Android: build an APK, test on the Android emulator first, then install on your phone.
3. Android only: share a screenshot straight to Banter from the share menu.
4. One week of real use by you, then a prompt-tuning round based on which lines you
   chose and which got replies.

From you: plug in the iPhone, sign in to Xcode with your Apple ID, turn on Developer
Mode and trust the developer profile on the phone. Enable USB debugging on the
Android phone.

### Phase 9 — Friends beta

Goal: friends install the APK and use it with their own keys.

1. In-app guide for getting an API key from each provider.
2. "Report a bad line" button, saved for prompt tuning.
3. APK shared in your WhatsApp group.
4. Password reset: Supabase's built-in email only reaches your own team, so you reset
   passwords from the dashboard, or we add a free email service.

### Later, not in this plan

- Android keyboard with tone chips above the keys
- Android floating button over Instagram
- iOS keyboard (needs the paid Apple developer account)
- "Ask her out" mode
- Roman Urdu
- WhatsApp, X and other apps
- Before going public: paid Apple account, privacy policy, stronger key protection,
  and a rethink of storing screenshots that contain other people

## 9. What I need from you, and when

| When | What |
|---|---|
| Now | Rename the folder to `banter` and reopen it |
| Phase 1 | Supabase project URL and publishable key (`sb_publishable_…`). "Confirm email" off. CLI login or SQL paste |
| Phase 2 | Enter one real key in the app |
| Phase 3 | 10 to 15 sample screenshots. One test key per provider in a local file |
| Phase 5 | Paste `supabase/paste-update.sql` into the Supabase SQL editor (done 2026-11-25). Two or three chat screenshots in `samples/` |
| Phase 8 | iPhone and Android phone connected and set up for installs |

## 10. Risks and open points

All six risks were checked on 2026-11-25, before Phase 0. Sources are official docs
unless marked otherwise.

| Risk | Result | What we do about it |
|---|---|---|
| **Android 10 support in Expo SDK 58** | **Not a risk.** SDK 58 supports Android 7 and newer (`minSdk 24` in the installed React Native 0.88.1; Android 10 is 29). | Nothing. Stay on SDK 58. |
| **Username reading** can be wrong | Cannot be tested until Phase 3 (needs keys and real screenshots). | The confirm-or-correct step stays. Phase 3 measures how often the username is right on the sample screenshots. |
| **Gemini's free tier** is small | **Smaller than assumed.** Google no longer publishes the limits. Third-party readings from October 2026: about 20 requests a day on the Flash models, about 500 a day on `gemini-3.5-flash-lite`. Image input is allowed on the free tier. Free-tier content is used by Google to improve its products. | Default Gemini model is `gemini-3.5-flash-lite`. Read the real limits in AI Studio for your own project in Phase 2. Heavy prompt tuning in Phase 3 needs a paid key or another provider. |
| **Free Apple ID** | **Confirmed:** installs expire after 7 days. Also: 3 devices, 3 apps per device, 10 app IDs per 7 days. Push notifications, Sign in with Apple and universal links are not available. Photo access, App Groups and share/keyboard extensions are available. | No change. Nothing in this plan needs the unavailable features. |
| **Keys in the database** are protected by access rules, not encrypted | Unchanged. This is a design choice, fine for personal use. | Phase 1 privacy test (two users, one cannot read the other's keys) is the safeguard. Stronger protection before going public. |
| **Line quality** is the real product | Cannot be verified before Phase 3. | Phase 3 proves it with your screenshots and your judgement. |

Found during the check, not in the original list:

- **Supabase "anon key" no longer exists for new projects.** New projects give a
  publishable key (`sb_publishable_…`). Phase 1 uses that. Same safety: it is public and
  the access rules protect the data.
- **"Offer your newest screenshot" (iOS) needs full photo access.** If the user picks
  "Limited access", iOS hides new screenshots from Banter. Phase 4 must ask for full
  access, explain why, and fall back to "Pick from gallery" when it is refused. The photo
  library API also changed in SDK 58 (no filter for screenshots; use the Screenshots
  album), so this is tested early in Phase 4.
- **Supabase's built-in email** sends at most 2 emails an hour and only to your own team.
  This matches Phase 9 item 4 and is another reason "Confirm email" stays off.
- **Provider APIs changed.** Gemini's recommended interface is now the Interactions API;
  OpenAI's is the Responses API. All three accept an image plus a fixed answer structure
  in one call, called straight from the phone. Starting models for Phase 1 seed data:
  `gemini-3.5-flash-lite`, `gpt-6-luna`, `claude-haiku-5-5`. Confirm the names again when
  the `models` table is seeded.
- **Android "share to Banter"** is now built into Expo (`expo-sharing`, marked
  experimental). Phase 8 uses it and no extra library is needed.
- **Maestro must be version 2.12 or newer** to work with Xcode 27.

## 11. Themes

All three are dark. The user picks one in Settings. Midnight Plum is the default.
Visual reference: https://claude.ai/artifact/YEbqC3BmnFeCiSnJVuZGCg

| Role | Midnight Plum | Ember | Deep Sea |
|---|---|---|---|
| Background | `#120e1a` | `#141010` | `#0a1316` |
| Surface (cards) | `#1c1626` | `#1e1817` | `#111e22` |
| Raised (active tab, secondary button) | `#2a2038` | `#2c2321` | `#1a2c32` |
| Border | `#342a45` | `#3a2e2b` | `#24393f` |
| Text | `#f2ecfa` | `#f7eee8` | `#e8f4f3` |
| Muted text | `#9c90b0` | `#a59890` | `#86a0a3` |
| Accent (selected chip, main button) | `#b58cff` | `#ff7a59` | `#3ddbc4` |
| Text on accent | `#1a1030` | `#2a0f08` | `#04231f` |
| Second accent ("noticed" details) | `#ff8fb1` | `#ffc46b` | `#7fb2ff` |

| Danger (errors), added in Phase 0 | `#ff7a85` | `#ff6b7d` | `#ff7f8a` |
| Success ("Copied", "Replied"), added in Phase 0 | `#6fdca4` | `#7fd99a` | `#8fe07f` |

Fonts: Space Grotesk for headings, Inter for body text. Both are built into the app.

Danger and Success were not in the sketches. They were added because error messages and
"Replied" need a colour. A unit test checks that every text colour is readable (WCAG AA,
4.5:1) on every background it is drawn on, in all three themes.

## 12. Notes for the next session

This plan was made in a session tied to the old folder path (`rizzler`). After the
rename, a new session starts with no memory of that conversation, so the working
agreements are recorded here.

- Work one phase at a time. Show simulator screenshots and test results at the end
  of each phase and wait for approval before the next.
- Two servers: `npm start` is the dev server on port 8081 (development, offline flows).
  `npm run e2e:live` starts and stops its own production-mode server on port 8082.
- Screens follow the layout rules in Phase 5.5. The user's words on 2026-11-25: putting
  everything on one long scrolling screen "is stupidity"; make design decisions like a
  senior engineer, without being asked.
- Test on the iOS simulator first. Make physical device builds only in Phase 8.
- Ask the user when Supabase setup or any key is needed. Never commit keys.
- The two reference images (`IMG_5087.HEIC`, `IMG_5088.HEIC`) show a keyboard-style
  app the user saw. They are inspiration for a later keyboard phase, not for copying.
- State of this Mac after Phase 0 (2026-11-25): Xcode 27.2, iOS 27 simulators (iPhone 17,
  iPhone 18 Pro), Node 24, CocoaPods, EAS CLI, Homebrew, Android SDK with a
  Pixel 8 Pro emulator (Android 17 image only; no Android 10 image). Java 17
  (`brew install openjdk@17`) and Maestro 2.12.1 are installed. Not installed: Supabase CLI.
  `JAVA_HOME`, `ANDROID_HOME` and `adb` are not set globally; run `source scripts/env.sh`
  in a terminal to set them for that terminal.
- Commands: `npm run check` (type check, lint, unit tests), `npm run test:db` (database
  access rules on a local Postgres), `npm run lines -- samples/` (run screenshots through
  the engine; needs `keys.local.json`), `npm run db:prompts` (write the SQL that copies
  the default prompts into Supabase), `npm run ios` (build and install on the simulator),
  `npm start` (dev server), `npm run e2e` (Maestro), `npm run test:privacy` and
  `npm run e2e:live` (both need the real Supabase project; `e2e:live` creates seven test
  accounts per run, and its Generate flow uses the Gemini key from `keys.local.json`).
- Git: commits in this repo are made as `abrarulhaq7` and no other name. The GitHub repo
  `abrarulhaq7/banter` is public. The `reference/` images stay on this Mac and are not in
  git, because they show another person and another company's app.
- Pushing works over SSH only (`git@github.com:abrarulhaq7/banter.git`). This Mac's personal-folder git setup signs in with an SSH key; an `https://` remote address fails because no GitHub password or token is saved.
- The first iOS build downloads about 260 MB of React Native files into `ios/Pods`.
  On 2026-11-25 these downloads hung once and had to be restarted.
- Test devices: iPhone 16 (free Apple ID, 7-day installs) and an Android 10 phone.
