# FullScan Mobile Platform — Source Root

This is the source root of the FullScan Mobile Platform.

The application follows a layered, modular architecture built from ordinary, hand-written screens — one
React component per screen, registered on a navigator. There is no configuration-driven rendering
runtime.

## Structure

| Directory         | Responsibility                                  |
|-------------------|-------------------------------------------------|
| `app/`            | Providers, navigation composition, app shell    |
| `bootstrap/`      | Startup sequencing before the app is usable     |
| `core/`           | Shared primitives, types, hooks, and utils      |
| `domain/`         | Business entities and business rules            |
| `features/`       | Feature modules — screens live here             |
| `infrastructure/` | Platform services and native integrations       |
| `localization/`   | Language resources (en, hi, te)                 |
| `navigation/`     | Navigation configuration and route definitions  |
| `repositories/`   | Backend I/O, returning Domain Models            |
| `shared/`         | Reusable UI components, layouts, and formatters |
| `store/`          | Global state management (Zustand/Redux)         |
| `tests/`          | Test suites (unit, integration, e2e, snapshot)  |
| `theme/`          | Design tokens, colors, typography, spacing      |

## Dependency Direction

```
Application → Bootstrap → Navigation → Features → Repositories → Infrastructure
```

Dependencies flow downward only. Lower layers must never depend on higher layers.
