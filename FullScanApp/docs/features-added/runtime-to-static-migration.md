# Runtime → Static Screen Migration

FullScan was originally built as a configuration-driven, server-driven-UI Runtime Platform (backend
sends screen/widget configuration, the app renders it through a Runtime Engine). That approach has been
dropped in favor of a normal screens-and-API app: each screen is a hand-written React component,
registered on a navigator. This file records what changed and why, for anyone picking this up later.

## Why

Decision made by the project owner: stop building the configuration-driven rendering runtime and
implement screens directly in code instead. No further rationale was recorded beyond that decision.

## What was removed

- **`src/runtime/`** (entirely) — the ten-engine platform core:
  - `configuration/` — Configuration Engine, `screens/login.json`, `screens/runtime-preview.json`
  - `engine/` — Verification Runtime Engine, Runtime Context
  - `registry/` — Widget Registry
  - `renderer/` — Dynamic Form Engine (`ScreenRenderer`, `SectionRenderer`, `ActionBar`, form state)
  - `validation/` — Validation Engine (required-field checks)
  - `workflow/` — Workflow Engine skeleton
- **`src/widgets/`** (entirely) — registered widget components (`text`, `textInput`/`email`/`password`,
  `checkbox`) and all placeholder widget folders (`dropdown`, `radio`, `camera`, `signature`, `map`,
  `attachment`, `barcode`, `qr`, etc.)
- **`src/contracts/`** — `screen-configuration.types.ts` and `widget.contract.ts` (the JSON screen/widget
  schema types the runtime rendered from)
- **`src/navigation/runtime-screen.tsx`** (+ its test) — the generic `screenId` → `ScreenRenderer` host
- **`src/app/ApplicationContext.ts`** — the `useRuntimeEngine()` context that threaded the
  `VerificationRuntimeEngine` instance down to navigation/screens

## What was added

Screen-wise implementation of Login under `src/features/authentication/`:

- `screens/login-screen.tsx` — a hand-written Gluestack screen: heading, welcome text, username,
  password, employee ID, remember-me checkbox, submit button
- `hooks/use-login-form.ts` — React Hook Form state and required-field validation rules. Error messages
  are localization keys (not resolved strings), so an already-shown error re-translates on language
  switch. Logs only non-identifying metadata (`rememberMe`, `hasEmployeeId`) — never credentials
- `types/login-form.types.ts` — `LoginFormValues` shape shared by the hook and the screen
- `index.ts` — feature's public surface (`LoginScreen`, `useLoginForm`, types)

Shared UI:

- `src/shared/components/form-text-field.tsx` — reusable labelled/validated text input built on
  Gluestack's `FormControl`, so every screen's fields look and behave consistently without a widget
  registry
- `src/shared/components/index.ts`

## What was rewired

- **`src/navigation/root-navigator.tsx`** — registers `LoginScreen` directly as `Stack.Screen`'s
  `component`, instead of resolving a `screenId` through the Runtime Engine. Route name changed from the
  `screenId` `login` to the conventional `Login`
- **`src/navigation/routes.ts`** — `ROUTE_NAMES.LOGIN` value updated to `'Login'`
- **`src/bootstrap/BootstrapService.ts`** — pipeline changed from one `runtime` step (which internally
  sequenced Configuration → Theme → Localization → Widget Registry, then registered built-in widgets) to
  three explicit steps: `theme` (`ThemeEngine.initialize()`), `localization`
  (`LocalizationEngine.initialize()`), `splash` (hide native splash)
- **`src/bootstrap/BootstrapContext.ts`** — now carries `themeMode`/`language` instead of a
  `runtimeEngine` instance
- **`src/app/ApplicationProvider.tsx`** — gates rendering on a boolean `isBootstrapped` flag instead of a
  `VerificationRuntimeEngine` instance; no longer provides `ApplicationContext`
- **`src/app/ApplicationShell.tsx`** — renders `<RootNavigator />` directly (no `runtimeEngine` prop)
- **Localization files** (`src/localization/{en,hi,te}/common.json`) — dropped
  `runtimePreview.*`, `section.login.credentials`, `error.screenNotFound` keys (all runtime-only); login
  keys flattened to `login.title`, `login.welcome`, `login.fields.*`, `login.actions.submit`,
  `validation.required`
- **Tests**:
  - `src/features/authentication/screens/login-screen.test.tsx` (new) — renders fields, blocks submit on
    empty required fields, clears errors once filled, keeps per-field values isolated, renders in Telugu
  - `src/navigation/root-navigator.test.tsx` (rewritten) — asserts Login renders via the real navigator
  - `src/localization/localization-engine.test.ts` — updated to resolve `login.*` keys instead of
    `runtimePreview.*`
  - Note: React Native Testing Library 14's `render`/`fireEvent` are async; the pre-existing runtime
    tests called them synchronously, which happened to still pass under `react-test-renderer` directly —
    the new tests use `@testing-library/react-native`'s `render`/`screen`/`fireEvent` correctly awaited

## Fixed incidentally

- `src/bootstrap/BootstrapPipeline.ts` had a pre-existing type error (a log call passed a raw string
  where a context object was expected) that blocked `tsc --noEmit`. Fixed as part of touching this file.

## Verified

- `npx tsc --noEmit` — clean
- `npx jest` — 20/20 passing across 6 suites

## Left stale (not deleted — flagged for a follow-up decision)

These still describe the abandoned runtime design and were not touched:

- `docs/04-Runtime/`, `docs/06-Contracts/`
- Skills: `fullscan-runtime-engine`, `fullscan-dynamic-form`, `fullscan-widget-development`,
  `fullscan-configuration-engine`, `fullscan-validation`, `fullscan-attachment-engine`,
  `fullscan-synchronization-engine`
- `.claude/agents/runtime-engineer.md`
- Slash commands `/create-widget`, `/create-runtime-engine`; `/create-feature`, `/create-screen`,
  `/create-api`, `/create-repository`, `/create-state` still contain some runtime-era instructions

`CLAUDE.md` was updated to describe the new screen-based architecture and explicitly calls out the above
as stale so future work (human or agent) doesn't get misled by them.
