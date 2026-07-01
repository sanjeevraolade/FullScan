# Milestone 1 — Bootstrap React Native Project

## Goal

Create a clean React Native project.

Nothing more.

No dependencies.

No architecture.

No folders.

No runtime.

# Use React Native CLI

Avoid Expo (MUST)

npx @react-native-community/cli@latest init FullScan

(or whatever the latest recommended CLI command is at the time you start)

## Milestone 2 — Install Dependencies

Don't create code.

Only install packages.

Group them logically.

## Core

- react
- react-native
- typescript
- Navigation
- @react-navigation/native
- @react-navigation/native-stack
- @react-navigation/drawer
- react-native-screens
- react-native-safe-area-context
- react-native-gesture-handler
- State
- zustand
- redux
- redux-saga

## UI

- @gluestack-ui/themed
- @gluestack-ui/config
- react-native-svg
- react-native-reanimated
- react-native-vector-icons

## Forms

- react-hook-form

## Networking

- axios

## Storage

- react-native-mmkv

## Camera

- react-native-vision-camera

## Splash Screen

- react-native-bootsplash

### Post-install setup

After providing a logo image (recommended: 1024×1024 PNG with transparent background), run:

```bash
cd mobile
npx react-native-bootsplash generate <path-to-logo>.png \
  --platforms=ios,android \
  --background=#FFFFFF \
  --logo-width=100
```

This command automatically:

- Generates `BootSplash.storyboard` and image assets for iOS
- Generates `bootsplash_logo` drawables and `bootsplash.xml` colors for Android
- Patches `AppDelegate.swift` to initialize the splash screen
- Patches `MainActivity.kt` to install the splash on activity create
- Adds the `BootTheme` style to Android `styles.xml`
- Updates `AndroidManifest.xml` to use the boot theme on launch

After running the command, on iOS re-run `bundle exec pod install`.

### JS integration

The helper is available at `src/infrastructure/splash/`:

```ts
import { hideSplashScreen } from '@/infrastructure/splash';

// Call after navigation is mounted and initial bootstrap completes
await hideSplashScreen();
```

## Localization

- i18next
- react-i18next

## Device

- @react-native-community/netinfo
- react-native-permissions
- react-native-device-info

## Testing

- jest
- @testing-library/react-native
- detox

## Development

- eslint
- prettier
- husky
- lint-staged