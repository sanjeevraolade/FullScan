# Hooks

Shared React hooks used across the platform.

## Responsibility

- Reusable custom hooks
- Platform-level hooks (permissions, connectivity, lifecycle)
- Composition hooks

## Rules

- Hooks must not contain feature-specific business logic.
- Hooks must be composable and independently testable.
- Prefer small, focused hooks over large monolithic ones.
