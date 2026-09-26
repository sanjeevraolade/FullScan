# Navigation

## Purpose

Defines application navigation: containers, stacks, route registration. Navigation should never contain
business logic.

## Current behavior

- `RootNavigator` wraps a React Navigation `NavigationContainer` + native-stack `Stack.Navigator`.
  `Login` is the stack's `initialRouteName`.
- Every route maps to a real screen component owned by its feature (`src/features/<feature>/screens/`).
  `Login` renders `src/features/authentication`'s `LoginScreen`.
- `routes.ts` centralizes route names and the typed `RootStackParamList` (`fullscan-navigation`: no magic
  route-name strings).

## Not implemented yet

- Only `Login` is registered as a route; further routes get added as their feature screens are built.
- Drawer navigation, deep linking, and typed param payloads beyond `undefined` are unbuilt — added when a
  screen actually needs them.

## Layering note

Per the frozen architecture (`Application → Bootstrap → Navigation → Features → …`), this folder must
never import from `src/app/`. It imports screens from `src/features/`, never the other way around.
