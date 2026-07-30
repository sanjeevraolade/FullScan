# Features

## Purpose

Contains all user-facing business features.

Each feature should be independently developed and maintained.

## Examples

- Authentication
- Dashboard
- Verification
- Reports
- Settings

## Responsibilities

- Screens
- Feature-specific components
- Feature-specific hooks
- Feature-specific services

## Folder layout

Each feature owns its own screens, hooks and types, and exposes them through a single `index.ts`:

```text
features/<feature>/
    screens/     one React component per screen (+ its test)
    hooks/       screen/form state and feature-specific logic
    types/       feature-local TypeScript contracts
    index.ts     public surface consumed by src/navigation
```

Backend I/O goes through `src/repositories/`; reusable, business-free UI goes in `src/shared/`.
