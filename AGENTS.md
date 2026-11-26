This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Banter project rules

Read `PLAN.md` first. It holds the product plan, the phases, the verified risks and the working agreements.

```bash
npm run check          # typecheck + lint + unit tests. Must pass before a phase is called done
npm run test:db        # applies supabase/migrations to a throwaway local Postgres and checks the access rules
npm run ios            # build and install the development build on the iOS simulator
npm start              # dev server for the development build
source scripts/env.sh  # Java 17 and Android SDK paths (needed for Maestro and Android builds)
npm run e2e            # offline Maestro flows in .maestro/ (simulator booted, dev server running)
npm run e2e:live       # Maestro flows against the real Supabase project; starts its own production-mode server
npm run lines -- samples/   # run sample screenshots through the generation engine (needs keys.local.json)
npm run db:prompts     # write supabase/paste-prompts.sql from src/engine/default-prompts.ts
```

- Colours come only from `useTheme()`. Colour values are written only in `src/theme/`; lint fails anywhere else.
- Build screens from `src/components/ui` and the `spacing`, `radius` and `typography` tokens. The parts: `Screen` (with `footer` and `fill`), `ScreenHeader`, `AppText`, `Button`, `IconButton`, `BarButton`, `Icon`, `Chip`, `ChipRow`, `SegmentedControl`, `OptionList`, `Card`, `ListRow`, `Avatar`, `Banner`, `Sheet`, `Dialog`, `TextField`, and `useToast()`.
- Icons come only from `Icon` (`src/components/ui/icon.tsx`, built on `expo-symbols`). Add a name there, with both the iOS and the Android symbol; do not use `@expo/vector-icons`.
- Colours with a meaning: `info`, `warning`, `success`, `danger`, each with a `…Soft` background. Use `Banner` for notices instead of red text on a card.
- The tab bar is `Tabs` from `expo-router/js-tabs` (the `expo-router` export of `Tabs` is deprecated in SDK 58). Tab screens pass `edges={['top', 'left', 'right']}` to `Screen`.
- Screens are components in `src/components/<area>/`; files in `src/app/` only read route params and render them. That is what lets the screens be unit tested.

## Layout rules (PLAN.md, Phase 5.5)

Do not add a feature by appending another block to an existing screen. Decide where it belongs first.

1. One job per screen.
2. Lists scroll; nothing else should need to. A screen that is not a list fits on one phone screen (`<Screen fill>`); a longer form is split into steps.
3. The main action is pinned to the bottom (`<Screen footer={…}>`).
4. Detail is one tap deeper, not unfolded in place: a list shows short rows, a row opens its own screen.
5. A rarely changed choice is one `ListRow` showing its value, and opens a `Sheet`.
6. Small edits and confirmations happen in a `Sheet` or a `Dialog`. Deleting and signing out always ask first.
- Never commit keys, `.env` files or anything in `samples/`.
- Made-up keys in tests and flows must look fake (`fake-gemini-key-for-tests`), never like a real key. GitHub flags key-shaped strings even when they are invented; `scripts/__tests__/no-key-shaped-strings.test.js` fails the check if one appears.
- Database changes go in a new file in `supabase/migrations/`, with checks added to `supabase/tests/access_test.sql`. Every table needs row-level security.
- Only the Supabase publishable key belongs in the app. Never a secret key.
- `src/engine/` must stay free of React Native imports: the command-line tool runs it in Node.
- Default prompts live in `src/engine/default-prompts.ts`. After changing them, raise `DEFAULT_CORE.version` if the core changed and run `npm run db:prompts`.
- Tones, modes and core rules come from `usePrompts()` (`src/prompts/`): Supabase's defaults when they are at least as new as the app's, else the app's copy, with the user's own tones on top. Screens and `use-generate` must not read `DEFAULT_TONES`, `DEFAULT_MODES` or `DEFAULT_CORE` directly. A tone is identified by `Tone.key` (the default tone's id, or the row id of a tone the user made).
- "Personalise for me" (`src/engine/personalise.ts`) sends text only: no screenshot, no usernames, not the user's name or city. Keep it that way.
- Provider requests must keep `store: false` (OpenAI, Gemini). Never send temperature or other sampling settings to Claude.

## Maestro on iOS: things that cost time

Maestro reads the accessibility tree, which does not know what is actually covered or clipped. Each of these looked like an app bug and was not:

- **Keyboard covers a button:** Maestro still reports the button as visible and the tap lands on a keyboard key. Run `common/close-keyboard.yaml` after typing, before tapping anything lower on the page.
- **Field hidden behind the top of the scroll area:** `scrollUntilVisible` with `direction: UP` returns at once and the tap misses. Use `common/scroll-to-top.yaml` to go up; use `scrollUntilVisible` only to go down.
- **Tap during scroll momentum:** it stops the scroll instead of tapping. Put `waitForAnimationToEnd` after every `scrollUntilVisible`.
- **Tappable card with a label:** its child texts are not in the tree. Assert on the card's `id` and state instead.
- **iOS prompts:** "Open in Banter?" after `openLink` and "Save/Update Password?" after typing a password cover the screen. `common/accept-open-link.yaml` and `common/dismiss-password-prompt.yaml` handle them.
- **`launchApp` with `clearState`:** reopens the Expo dev menu over the app. Use `common/ensure-signed-out.yaml` to get a clean start instead.
- **Secure text fields** are blank in screenshots. That is iOS, not an empty field.
- **Dev server:** start it without `CI=1`, or code changes are not picked up.
- **A tap that "COMPLETED" but did nothing, in development mode:** about one live run in three lost the first tap on Results after the lines arrived (2026-11-26). The tap never reached the app: no touch event at all, nothing on screen in a recording. It did not happen in 8 runs with the app's code in production mode. It was not the screen transition, vibration, a remount or a visible overlay; the exact cause in the development build is not known. So `npm run e2e:live` runs against its own production-mode server on port 8082 (`expo start --no-dev --minify`), started and stopped by `scripts/e2e-live.sh`. The offline flows need development-only screens and use the dev server on 8081. If this shows up in an offline flow, rerun before changing app code.
- **Which server a flow uses:** `common/open-app.yaml` reads `METRO_PORT` (default 8081).
- **`ListRow` is a tappable card with a label**, so the pitfall above applies: its subtitle's `testID` is not in the tree. The row's label is "title, value, subtitle"; assert on the row's `id` with `text: ".*what you expect.*"`.
- **A `ListRow` with `actions`** (the key rows with up and down arrows): the row's `id` is on its tappable part, and each action button keeps its own `id` beside it.
- **A button in a sheet, after typing:** the simulator's keyboard can slide up a moment after the typing, and the sheet moves with it. Maestro then taps where the button was and hits the space bar (seen 2026-11-26: a trailing space in the field, the sheet still open). Use `common/tap-after-typing.yaml` with `ID`, which waits, taps, and taps again if the button is still there.
- **Replacing the text in a multi-line field:** a tap puts the cursor mid-text, so `eraseText` leaves the rest. `longPressOn` the field, tap "Select All", then `inputText`.
- **Sheets and dialogs** are React Native `Modal`s. Their content is in the tree while open; close a sheet with `sheet-close`.
- **Flows that seed a real key** (`live/generate.yaml`, `live/history.yaml`) remove the key and the saved history in `onFlowComplete`, which runs even when the flow fails. Keep it that way: a failed run must not leave a real key in a test account.

When a flow fails, read the failure screenshot and the `screen-hierarchy` JSON under `.maestro/artifacts/<run>/` before changing app code.
