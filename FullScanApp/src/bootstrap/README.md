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
Theme
    ↓
Localization
    ↓
Application Ready
```

## Does NOT Own

- Business logic
- Navigation
- Feature implementation

## Current implementation

`runBootstrap()` (`BootstrapService.ts`) runs a `BootstrapPipeline` of three steps: `theme`
(`ThemeEngine.initialize()`), `localization` (`LocalizationEngine.initialize()`, which sets up i18next)
and `splash` (hides the native splash screen once the app can render). `Storage` has no step yet —
nothing needs persisting until a real feature does. A failed step short-circuits the pipeline and returns
`{ success: false, ... }` instead of leaving the app half-initialized; `src/app/ApplicationProvider.tsx`
is the caller.
