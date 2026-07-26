# Application Layer

## Purpose

The `app` folder is the root composition layer of the application.

It wires together Bootstrap, Providers, Navigation, Runtime, and Features.

## Responsibilities

- Compose the application.
- Configure global providers.
- Initialize application context.
- Render the application shell.

## Owns

- Application.tsx
- ApplicationProvider
- ApplicationShell
- ApplicationContext

## Does NOT Own

- Business logic
- Runtime implementation
- API calls
- Feature implementation

## Flow

```text
App.tsx
    ↓
Application
    ↓
Providers
    ↓
Navigation
    ↓
Runtime
    ↓
Features
```

## Current implementation

`Application` = `ApplicationProvider` (runs `runBootstrap()`, shows a themed `Spinner` until it resolves,
then provides the initialized `VerificationRuntimeEngine` via `ApplicationContext`) wrapping
`ApplicationShell` (renders the `login` screen through `ScreenRenderer` — the launch screen id is a fixed
constant since there is no Workflow Engine yet to decide it). No React Navigation stack is wired in yet;
there is only one screen to show.
