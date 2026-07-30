# FullScan Mobile Platform

FullScan is an enterprise React Native app used by Field Executives to perform physical background
verification of candidates, capturing tamper-proof GPS, camera, and biometric evidence.

FullScan is an **offline-first, screen-based** React Native app. Each screen is an ordinary React
component owned by its feature and registered on a navigator — there is **no configuration-driven
rendering runtime, no server-driven UI, and no widget registry**. That approach was explored and
deliberately dropped; do not reintroduce it.

Business/domain docs live under `docs/` — read them for domain rules this file doesn't cover, but note
that everything in `docs/04-Runtime/`, `docs/06-Contracts/` and the `.claude/skills/fullscan-*engine*`,
`fullscan-dynamic-form`, `fullscan-widget-development`, `fullscan-runtime-engine` and
`fullscan-configuration-engine` skills still describes the abandoned runtime design and is **stale**.

## Current status (read before assuming anything is implemented)

**Implementation has barely started.** `src/` is mostly empty folders — most files that exist are
placeholders. Do not assume a feature exists just because its folder is present; check first.

What works today: startup (`bootstrap` → theme + localization + splash), a `NavigationContainer` +
native-stack with `Login` as its only route, and a hand-written `LoginScreen` with React Hook Form
validation. Not built yet: authentication itself, networking, storage, business logic.

## Tech stack

| Category     | Choice                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework    | React Native (bare workflow), TypeScript strict                                                                                                  |
| UI           | **Gluestack UI** — use it for all components, never raw RN primitives (`View`, `Text`, `TouchableOpacity`) unless no Gluestack equivalent exists |
| Navigation   | React Navigation (native-stack, drawer)                                                                                                          |
| State        | Zustand (global app state) + Redux Saga (side effects)                                                                                           |
| Storage      | MMKV (non-sensitive), platform Keychain/Keystore (secrets)                                                                                       |
| Networking   | Axios, behind Repository pattern                                                                                                                 |
| Forms        | React Hook Form                                                                                                                                  |
| Localization | react-i18next — English, Hindi, Telugu                                                                                                           |
| Camera       | Vision Camera (capture only, gallery picker prohibited)                                                                                          |
| Testing      | Jest, React Native Testing Library, Detox                                                                                                        |

Path alias: `@/*` → `src/*` (defined in `babel.config.js` module-resolver). Note: `tsconfig.json` also
lists `@assets`, `@components`, `@screens`, `@navigation` aliases that don't correspond to real folders —
don't rely on them.

## Layered architecture (frozen)

```
Application → Bootstrap → Navigation → Features → Repositories → Infrastructure
```

Dependencies flow downward only. A lower layer must never import from a higher one. Screens never call
APIs directly — backend I/O goes through a repository.

## Repository structure (frozen — do not add new top-level `src/` folders without a real reason)

| Folder            | Owns                                                                                                                                          | Never contains                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `app/`            | Providers, navigation composition, application shell                                                                                          | Business logic                     |
| `bootstrap/`      | Startup sequencing — initializing services before the app becomes usable                                                                      | Business logic                     |
| `core/`           | `constants/`, `errors/`, `events/`, `types/`, `utils/` — generic reusable code                                                                | Business logic                     |
| `domain/`         | Business entities and business rules, independent of UI/infra                                                                                 | UI, transport code                 |
| `features/`       | Business functionality (authentication, verification, reports, dashboard, settings...) — each feature owns its `screens/`, `hooks/`, `types/` | Direct API calls                   |
| `infrastructure/` | Device/platform capability implementations: storage, camera, networking, GPS, logger, permissions, notifications, biometrics, encryption      | Business logic                     |
| `navigation/`     | Screen registration and typed routes                                                                                                          | Business decisions, screen content |
| `repositories/`   | Hide API/DTO details, return **Domain Models only**                                                                                           | Raw DTOs exposed to callers        |
| `shared/`         | Reusable UI components (`components/`), formatters, validators, layouts, icons, animations                                                    | Business logic                     |
| `store/`          | App-wide state only: session, theme, localization                                                                                             | Business entities                  |
| `theme/`          | Design tokens: colors, typography, spacing, radius                                                                                            | Hardcoded values used elsewhere    |

## Cross-cutting services

Not engines and not a runtime — plain singletons initialized by `src/bootstrap/`:

| Service                                       | Owns                                         |
| --------------------------------------------- | -------------------------------------------- |
| `LoggerService` (`src/infrastructure/logger`) | All logging; globally toggleable             |
| `LocalizationEngine` (`src/localization`)     | i18next setup, language switching (en/hi/te) |
| `ThemeEngine` (`src/theme`)                   | Design tokens, light/dark/system theme       |

Camera/evidence capture, offline sync queue, secure storage and permissions are unbuilt — when they are
built they belong in `src/infrastructure/` (device capability) plus the owning feature.

## Non-negotiable rules

- **Never hardcode** user-visible strings or colors/spacing/typography — localization keys and theme
  tokens only. Screens, forms and validation rules _are_ written in code, deliberately.
- **Screens stay presentational.** Form/screen state goes in a feature hook, backend I/O in a repository,
  business rules in `src/domain/`. No API calls from a screen component.
- **Offline-first is mandatory.** Every feature keeps working without network where technically possible;
  evidence is always persisted locally before sync.
- **Camera-only evidence.** Gallery/file picker is prohibited for business evidence. Every capture needs
  GPS, timestamp, and a watermark (minimum: latitude, longitude, capture date, capture time).
- **Gluestack UI only** for components; **Theme Engine tokens only** for styling; **localization keys
  only** for user-visible text (never hardcoded strings).
- **TypeScript strict**, no `any`, no unchecked type assertions.
- **No `console.log`** — use the LoggerService, and never log tokens, passwords, biometric data, or PII
  (Aadhaar/PAN numbers included). Every function/method/component gets at least one log call, every
  logging file declares a `FILE_NAME` constant and prefixes each log message with it, and logging is
  globally toggleable via `LoggerService.setEnabled(boolean)` (see `fullscan-engineering-standards` for
  the exact convention).
- **Repository pattern for all backend I/O** — repositories return Domain Models, never raw DTOs.

## Coding conventions

- Files: `kebab-case`. Components/Interfaces: `PascalCase`. Functions/variables: `camelCase`, verb-based
  for functions (`capturePhoto`, `validateAssignment`, not `process`/`handle`/`run`). Constants:
  `UPPER_SNAKE_CASE`. Booleans read positively (`isValid`, `hasPermission`, not `invalid`/`flag`).
- Functional components only, small and focused (~300 lines is a soft ceiling before splitting).
- Prefer composition over inheritance; SOLID; DRY; early returns over nested conditionals.
- Reuse before creating: before writing new code, check whether an existing shared component, hook or
  service already solves it.
- Every feature should ship with tests (unit + component, integration where relevant) covering the happy
  path, edge cases, offline behaviour, and errors — not just the happy path.
- Accessibility (screen readers, dynamic font sizes, touch targets) is mandatory, not optional.
- Generate only the files a task actually needs — don't scaffold unrequested boilerplate.

## Specialized subagents

Role-specific subagents live in `.claude/agents/`: `solution-architect`, `mobile-engineer`,
`integration-engineer`, `qa-engineer`, `reviewer`. Use them for focused work in their domain rather than
doing everything as a generalist. `runtime-engineer` is obsolete.

## Slash commands

`.claude/commands/` has scaffolding commands: `/create-feature`, `/create-screen`, `/create-api`,
`/create-repository`, `/create-state`. They still contain runtime-era instructions — ignore any step that
tells you to render from configuration or register a widget. `/create-widget` and
`/create-runtime-engine` are obsolete.
