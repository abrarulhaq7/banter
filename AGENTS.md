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
npm run e2e            # Maestro flows in .maestro/ (simulator booted, dev server running)
npm run lines -- samples/   # run sample screenshots through the generation engine (needs keys.local.json)
npm run db:prompts     # write supabase/paste-prompts.sql from src/engine/default-prompts.ts
```

- Colours come only from `useTheme()`. Colour values are written only in `src/theme/`; lint fails anywhere else.
- Build screens from `src/components/ui` (`Screen`, `AppText`, `Button`, `Chip`, `Card`, `TextField`) and the `spacing`, `radius` and `typography` tokens.
- Never commit keys, `.env` files or anything in `samples/`.
- Database changes go in a new file in `supabase/migrations/`, with checks added to `supabase/tests/access_test.sql`. Every table needs row-level security.
- Only the Supabase publishable key belongs in the app. Never a secret key.
- `src/engine/` must stay free of React Native imports: the command-line tool runs it in Node.
- Default prompts live in `src/engine/default-prompts.ts`. After changing them, raise `DEFAULT_CORE.version` if the core changed and run `npm run db:prompts`.
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

When a flow fails, read the failure screenshot and the `screen-hierarchy` JSON under `.maestro/artifacts/<run>/` before changing app code.
