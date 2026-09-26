# Application Layer

## Purpose

The `app` folder is the root composition layer of the application.

It wires together Bootstrap, Providers, Navigation, and Features.

## Responsibilities

- Compose the application.
- Configure global providers.
- Render the application shell.

## Owns

- Application.tsx
- ApplicationProvider
- ApplicationShell
- AppSafeArea

## Does NOT Own

- Business logic
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
Features
```

## Current implementation

`Application` = `ApplicationProvider` (runs `runBootstrap()` and shows a themed `Spinner` until it
resolves, so screens can assume theme and localization are ready) wrapping `ApplicationShell`, which
renders `src/navigation`'s `RootNavigator` — a real `NavigationContainer` + native-stack whose
`initialRouteName` is `Login`.

Both the loading state and the shell render through `AppSafeArea`, which applies real safe-area insets
(`react-native-safe-area-context`'s `SafeAreaView`, not Gluestack's deprecated one) and a `$white`
background matching the native splash screen exactly, so there's no inset clipping and no color flash
between splash-hide and first paint.
