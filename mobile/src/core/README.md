# Core

Shared domain primitives, abstractions, and utilities used across the platform.

## Structure

| Directory      | Purpose                                         |
|----------------|-------------------------------------------------|
| `constants/`   | Application-wide constants                      |
| `decorators/`  | TypeScript decorators                           |
| `errors/`      | Error types and error hierarchy                 |
| `events/`      | Event bus and domain event definitions          |
| `helpers/`     | Pure helper functions                           |
| `hooks/`       | Shared React hooks                              |
| `interfaces/`  | Shared interfaces and contracts                 |
| `models/`      | Domain models and entities                      |
| `types/`       | Shared TypeScript type definitions              |
| `utils/`       | General-purpose utility functions               |

## Rules

- No UI code.
- No infrastructure dependencies.
- No feature-specific logic.
- Must remain independently testable.
- Dependencies flow outward from core — nothing in core depends on outer layers.
