# Splash Screen Service

Native splash screen management using `react-native-bootsplash`.

## Responsibility

- Native splash screen visibility control
- Fade-out animation coordination
- Splash-to-app handoff without white flash

## Usage

```ts
import { hideSplashScreen } from '@/infrastructure/splash';

// After navigation and initial config are ready:
await hideSplashScreen();
```

## Setup

Splash assets and native wiring are generated via the bootsplash CLI.
See `extradocs/Create - Project.md` for the exact command.

## Rules

- Splash must be hidden only after navigation container is mounted.
- Splash must be hidden after critical bootstrap (auth check, config load) completes.
- Never hide the splash from within a widget or screen — it belongs to the runtime lifecycle.
