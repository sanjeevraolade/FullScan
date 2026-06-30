# FullScan Mobile Platform — Source Root

This is the source root of the FullScan Mobile Platform.

The application follows a layered, modular architecture organized around a Configuration-Driven Runtime Platform.

## Structure

| Directory        | Responsibility                                      |
|------------------|-----------------------------------------------------|
| `config/`        | Application configuration and environment settings  |
| `core/`          | Shared domain primitives, types, hooks, and utils   |
| `engines/`       | Runtime engines (validation, workflow, sync, etc.)   |
| `infrastructure/`| Platform services and native integrations           |
| `localization/`  | Language resources (en, hi, te)                     |
| `modules/`       | Feature modules (authentication, verification, etc.)|
| `navigation/`    | Navigation configuration and route definitions      |
| `runtime/`       | Verification Runtime Engine and orchestration        |
| `shared/`        | Reusable UI components, layouts, and formatters     |
| `store/`         | Global state management (Zustand/Redux)             |
| `tests/`         | Test suites (unit, integration, e2e, snapshot)      |
| `theme/`         | Design tokens, colors, typography, spacing          |
| `widgets/`       | Dynamic form widgets (server-driven UI primitives)  |

## Dependency Direction

```
Presentation → Runtime → Domain → Services → Infrastructure
```

Dependencies flow downward only. Lower layers must never depend on higher layers.
