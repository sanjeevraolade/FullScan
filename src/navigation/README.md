# Navigation

## Purpose

Defines application navigation: containers, stacks, route registration. Navigation should never contain
business logic.

## Current behavior ("Hello Runtime" pass)

- `RootNavigator` wraps a React Navigation `NavigationContainer` + native-stack `Stack.Navigator`. `login`
  is the stack's `initialRouteName` — the app now reaches the Login screen via real navigation instead of
  `ApplicationShell` rendering it directly.
- `RuntimeScreen` is the one generic screen host every route renders: it resolves a `screenId` through the
  `VerificationRuntimeEngine` (passed down from `ApplicationShell`, not read from a Context here — see
  layering note below) and hands the resolved `ScreenDefinition` to the Dynamic Form Engine's
  `ScreenRenderer`. Screens are entirely configuration-driven, so there is no per-screen React component to
  register — only a `screenId`.
- `routes.ts` centralizes route names and the typed `RootStackParamList` (`fullscan-navigation`: no magic
  route-name strings). Route names are the same `screenId`s the Configuration Engine uses.
- An unresolved `screenId` renders a localized "screen not available" message instead of crashing (`error.screenNotFound`).

## Not implemented yet

- Only `login` is registered as a route. Deciding what screen (if any) follows it is a Workflow Engine
  decision (`docs/04-Runtime/01-Verification-Runtime-Engine.md` §9) — the Workflow Engine is still a
  skeleton (`src/runtime/workflow/README.md`). `RuntimeScreen`'s `onAction` only logs today; wire real
  transitions once the Workflow Engine can decide them.
- Drawer navigation, deep linking, and typed param payloads beyond `undefined` are unbuilt — added when a
  screen actually needs them.

## Layering note

Per the frozen architecture (`Application → Bootstrap → Navigation → Runtime → …`), this folder must never
import from `src/app/`. `RootNavigator`/`RuntimeScreen` receive the `VerificationRuntimeEngine` as a prop
from `ApplicationShell` rather than reading `src/app/ApplicationContext`'s React Context directly.
