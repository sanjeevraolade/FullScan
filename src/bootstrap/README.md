# Bootstrap

## Purpose

Responsible for initializing the application before it becomes available to the user.

## Responsibilities

- Execute startup pipeline.
- Initialize platform services.
- Handle startup failures.
- Control splash screen lifecycle.
- Prepare the application for execution.

## Startup Order

```text
Logger
    ↓
Storage
    ↓
Configuration
    ↓
Theme
    ↓
Localization
    ↓
Runtime
    ↓
Application Ready
```

## Does NOT Own

- Business logic
- Navigation
- Feature implementation

## Current implementation

`runBootstrap()` (`BootstrapService.ts`) runs a `BootstrapPipeline` of two steps: `runtime` (creates a
`VerificationRuntimeEngine`, calls `initialize()` — which itself sequences Configuration → Theme →
Localization → Widget Registry — then registers the built-in widgets) and `splash` (hides the native
splash screen once the runtime is ready). `Storage` has no step yet — nothing needs persisting until a
real feature does. A failed step short-circuits the pipeline and returns `{ success: false, ... }` instead
of leaving the app half-initialized; `src/app/ApplicationProvider.tsx` is the caller.
