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