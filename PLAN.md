# Banter — Build Plan

Status: **Phase 3 engine works with real screenshots on Gemini (2026-11-25). Waiting for your judgement of the lines, and for profile and chat screenshots** (see "Phase 3 result so far").
Last updated: 2026-11-25

## 1. What we are building

Banter is a mobile app (iOS and Android) that looks at a screenshot from Instagram and
writes short lines you can send: a reply to her story, an opener from her profile, the
next message in a chat, or a read of how the chat is going.

- You take a screenshot in Instagram and open Banter.
- You pick a mode and a tone.
- Banter shows three lines. You tap one to copy it and paste it in Instagram.
- Banter remembers each person by their Instagram username, so the next line fits
  what you already said to them.

The app uses the user's own AI key (Gemini, OpenAI or Claude). Each user pays for
their own usage.

## 2. Decisions already made

| Topic | Decision |
|---|---|
| Name | Banter |
| Framework | Expo SDK 58 (React Native 0.88), TypeScript, Expo Router, development builds (not Expo Go) |
| Backend | Supabase: login, database, screenshot storage, remote prompts |
| Login | Required. Email and password. Email confirmation off during testing |
| AI providers | Gemini, OpenAI, Claude. User adds own keys and picks the provider for each |
| Key storage | In Supabase (each user sees only their own keys), cached on the phone |
| Key limits | Several keys per user. When one hits its limit, the app moves to the next |
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

1. Sign in / Sign up
2. Onboarding: about you, then add your first API key
3. Generate (home): screenshot, mode, tone, context, results
4. People: list of everyone you have used Banter with
5. Person: timeline of screenshots, lines, chosen line, result
6. My tones: edit what each tone means, add your own, reset
7. Keys: add, order, disable, delete keys; pick model per provider
8. Settings: profile, theme, data controls, sign out

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

- One common interface with three small adapters (Gemini, OpenAI, Claude). Each sends
  the image and prompt and returns the same structure.
- The phone calls the provider directly. Screenshots do not pass through our server.
- Errors are mapped to plain cases: wrong key, limit reached, no internet, model
  refused, answer unreadable.
- On "limit reached", the key is marked `limited`, the app tries the next key, and
  refreshes the key list from Supabase. If you replace a key in the database, the app
  picks it up.
- Model names live in the `models` table, so a new model needs no new build.

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

### Phase 6 — Personal prompts

Goal: each user shapes the tones, and you can change defaults at any time.

1. My tones screen: edit each tone's definition, add a custom tone, reset to default.
2. "Personalise for me": the model reads your profile and your history (which lines you
   chose, which got replies) and suggests changes to your tones. You accept or reject.
3. The app fetches default prompts from Supabase on start and keeps a copy for
   when there is no internet.

How I test: edit Flirty in the app and confirm the next prompt uses the new text. Change
a default in Supabase and confirm the app picks it up without a rebuild.

### Phase 7 — Settings and polish

Goal: the app feels finished for daily personal use.

1. Settings: profile, keys, data controls (stop saving screenshots, delete a person,
   delete all history, delete account data).
   Theme picker: three preview cards, tap to switch. The choice is saved in the user's
   profile so it follows them to another phone, and cached on the phone so the app
   opens in the right colours before sign-in finishes.
2. Usage view: how many generations per provider, model and key.
3. Empty states, loading states, small animations, haptics.
4. App icon and splash screen for Banter.

How I test: full Maestro run of every flow. Deletions confirmed in the database and
in storage.

### Phase 8 — Phone builds

Goal: Banter on your iPhone 16 and your Android 10 phone.

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
  `npm run e2e:live` (both need the real Supabase project; `e2e:live` creates three test
  accounts per run).
- Git: commits in this repo are made as `abrarulhaq7` and no other name. The GitHub repo
  `abrarulhaq7/banter` is public. The `reference/` images stay on this Mac and are not in
  git, because they show another person and another company's app.
- Pushing works over SSH only (`git@github.com:abrarulhaq7/banter.git`). This Mac's personal-folder git setup signs in with an SSH key; an `https://` remote address fails because no GitHub password or token is saved.
- The first iOS build downloads about 260 MB of React Native files into `ios/Pods`.
  On 2026-11-25 these downloads hung once and had to be restarted.
- Test devices: iPhone 16 (free Apple ID, 7-day installs) and an Android 10 phone.
