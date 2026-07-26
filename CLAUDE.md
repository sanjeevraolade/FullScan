# FullScan Mobile Platform

FullScan is an enterprise React Native app used by Field Executives to perform physical background
verification of candidates, capturing tamper-proof GPS, camera, and biometric evidence.

**This is not a normal screens-and-API app.** FullScan is a **configuration-driven, offline-first,
server-driven-UI Runtime Platform**. The backend sends configuration (screens, widgets, workflows,
validation rules); the mobile app is a runtime that renders and executes it. Business behaviour should
evolve through configuration, not source code changes. Every implementation decision should strengthen
the platform, not just solve the immediate feature.

Full architecture/business docs live under `docs/` (Governance, Vision, Business, Architecture, Runtime,
Contracts, Observability) — read them for anything this file doesn't cover. Domain-specific rules with
worked examples live in `.claude/skills/` (see below) and load automatically when relevant.

## Current status (read before assuming anything is implemented)

The documentation and architecture are complete; **implementation has barely started**. `src/` is almost
entirely empty folders — most files that exist are placeholders. Do not assume any runtime engine, widget,
or feature exists just because its folder is present; check first.

Current sprint goal ("Hello Runtime"): prove `Configuration → Runtime Engine → Widget Registry → Renderer
→ Widgets` by rendering the **Login screen entirely from runtime configuration**. Out of scope for this
sprint: authentication, networking, business logic.

## Tech stack

| Category | Choice |
|---|---|
| Framework | React Native (bare workflow), TypeScript strict |
| UI | **Gluestack UI** — use it for all components, never raw RN primitives (`View`, `Text`, `TouchableOpacity`) unless no Gluestack equivalent exists |
| Navigation | React Navigation (native-stack, drawer) |
| State | Zustand (global app state) + Redux Saga (side effects) |
| Storage | MMKV (non-sensitive), platform Keychain/Keystore (secrets) |
| Networking | Axios, behind Repository pattern |
| Forms | React Hook Form |
| Localization | react-i18next — English, Hindi, Telugu |
| Camera | Vision Camera (capture only, gallery picker prohibited) |
| Testing | Jest, React Native Testing Library, Detox |

Path alias: `@/*` → `src/*` (defined in `babel.config.js` module-resolver). Note: `tsconfig.json` also
lists `@assets`, `@components`, `@screens`, `@navigation` aliases that don't correspond to real folders —
don't rely on them.

## Layered architecture (frozen)

```
Application → Bootstrap → Navigation → Runtime → Features → Repositories → Infrastructure
```

Dependencies flow downward only. A lower layer must never import from a higher one. Screens/widgets never
call APIs or execute workflows directly — everything routes through the Runtime.

## Repository structure (frozen — do not add new top-level `src/` folders without a real reason)

| Folder | Owns | Never contains |
|---|---|---|
| `app/` | Providers, navigation composition, application shell | Business logic |
| `bootstrap/` | Startup sequencing — initializing services before the app becomes usable | Business logic |
| `contracts/` | Shared TypeScript contracts/interfaces | Implementation |
| `core/` | `constants/`, `errors/`, `events/`, `types/`, `utils/` — generic reusable code | Business logic |
| `domain/` | Business entities and business rules, independent of UI/infra | UI, transport code |
| `features/` | Business functionality (authentication, verification, reports, dashboard, settings...) consuming the Runtime | Direct API calls, own screens' business rules |
| `infrastructure/` | Device/platform capability implementations: storage, camera, networking, GPS, logger, permissions, notifications, biometrics, encryption | Business logic |
| `navigation/` | Screen registration and typed routes | Business/workflow decisions |
| `repositories/` | Hide API/DTO details, return **Domain Models only** | Raw DTOs exposed to callers |
| `runtime/` | The platform core — `configuration/`, `engine/`, `registry/`, `renderer/`, `validation/`, `workflow/` | Feature-specific/business-specific code |
| `shared/` | Reusable UI components, formatters, validators, layouts, icons, animations | Business logic |
| `store/` | App-wide state only: session, theme, configuration, localization | Business entities |
| `theme/` | Design tokens: colors, typography, spacing, radius | Hardcoded values used elsewhere |
| `widgets/` | Reusable runtime-rendered building blocks (text, camera, gps, signature, timeline, map, attachment, barcode, qr...) | Business logic, direct API/workflow calls |

## The Runtime (the heart of the platform)

Ten engines, each with exactly one responsibility. Full detail per engine is in the matching
`.claude/skills/fullscan-*` skill — load the relevant one before implementing.

| Engine | Owns |
|---|---|
| Verification Runtime Engine | App orchestration: startup, engine coordination, runtime context init |
| Workflow Engine | Workflow execution/state, navigation *decisions* (app workflows like onboarding, and business workflows like candidate verification) |
| Dynamic Form Engine | Turning screen configuration into a rendered screen: layout, section, widget composition, binding |
| Widget Registry | Widget discovery/resolution — widgets register themselves, nothing instantiates them directly |
| Validation Engine | All business/field/workflow/attachment/GPS/security validation |
| Configuration Engine | Downloading, versioning, validating, caching, and activating runtime configuration |
| Attachment Engine | Evidence lifecycle: camera capture, metadata, watermark, local persistence |
| Synchronization Engine | The *only* thing allowed to upload business data — offline queue, retry, conflict handling |
| Localization Engine | Language resolution and runtime language switching (en/hi/te) |
| Theme Engine | Design tokens, light/dark/system theme, runtime theme switching |

## Non-negotiable rules

- **Never hardcode** business screens, forms, workflows, validation rules, attachment types, user-visible
  strings, or colors/spacing/typography. If it can be configuration, it must be configuration.
- **Never bypass a Runtime Engine.** No API calls from screens/widgets, no business validation in UI, no
  direct uploads outside the Synchronization Engine, no widget instantiation outside the Widget Registry.
- **Offline-first is mandatory.** Every feature keeps working without network where technically possible;
  evidence is always persisted locally before sync.
- **Camera-only evidence.** Gallery/file picker is prohibited for business evidence. Every capture needs
  GPS, timestamp, and a watermark (minimum: latitude, longitude, capture date, capture time).
- **Gluestack UI only** for components; **Theme Engine only** for styling; **localization keys only** for
  user-visible text (never hardcoded strings).
- **TypeScript strict**, no `any`, no unchecked type assertions.
- **No `console.log`** — use the LoggerService, and never log tokens, passwords, biometric data, or PII
  (Aadhaar/PAN numbers included).
- **Repository pattern for all backend I/O** — repositories return Domain Models, never raw DTOs.

## Coding conventions

- Files: `kebab-case`. Components/Interfaces: `PascalCase`. Functions/variables: `camelCase`, verb-based
  for functions (`capturePhoto`, `validateAssignment`, not `process`/`handle`/`run`). Constants:
  `UPPER_SNAKE_CASE`. Booleans read positively (`isValid`, `hasPermission`, not `invalid`/`flag`).
- Functional components only, small and focused (~300 lines is a soft ceiling before splitting).
- Prefer composition over inheritance; SOLID; DRY; early returns over nested conditionals.
- Reuse before creating: before writing new code, check whether an existing widget, hook, service, or
  configuration option already solves it.
- Every feature should ship with tests (unit + component, integration where relevant) covering the happy
  path, edge cases, offline behaviour, and errors — not just the happy path.
- Accessibility (screen readers, dynamic font sizes, touch targets) is mandatory, not optional.
- Generate only the files a task actually needs — don't scaffold unrequested boilerplate.

## Specialized subagents

Role-specific subagents live in `.claude/agents/`: `solution-architect`, `runtime-engineer`,
`mobile-engineer`, `integration-engineer`, `qa-engineer`, `reviewer`. Use them for focused work in their
domain (e.g. architecture trade-off review, runtime engine design, test planning) rather than doing
everything as a generalist.

## Slash commands

`.claude/commands/` has scaffolding commands: `/create-feature`, `/create-screen`, `/create-widget`,
`/create-runtime-engine`, `/create-api`, `/create-repository`, `/create-state`. Each generates the
standard artifact set for its layer and reminds you which skill/engine ownership rules apply.
