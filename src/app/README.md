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
`ApplicationShell`, which renders `src/navigation`'s `RootNavigator` — a real `NavigationContainer` +
native-stack whose `initialRouteName` is `login`. Which screen (if any) follows Login is a Workflow Engine
decision not made yet (`src/runtime/workflow/README.md`), so Login stays the only registered route.

Both the loading state and the shell render through `AppSafeArea`, which applies real safe-area insets
(`react-native-safe-area-context`'s `SafeAreaView`, not Gluestack's deprecated one) and a `$white`
background matching the native splash screen exactly, so there's no inset clipping and no color flash
between splash-hide and first paint.
