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
- babel-plugin-module-resolver

### Path aliases (`@/*` → `src/*`)

To use named imports like `import { hideSplashScreen } from '@/infrastructure/splash'` at both compile time and runtime, two configurations are required:

**1. TypeScript** — `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

**2. Metro/Babel** — `babel.config.js`:

```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./'],
        extensions: [
          '.ios.ts', '.android.ts', '.ts',
          '.ios.tsx', '.android.tsx', '.tsx',
          '.jsx', '.js', '.json',
        ],
        alias: { '@': './src' },
      },
    ],
  ],
};
```

After changing `babel.config.js`, restart Metro with `--reset-cache`:

```bash
npx react-native start --reset-cache
```

### ESLint — enterprise configuration

Install the plugin suite:

```bash
npm install --save-dev \
  @typescript-eslint/eslint-plugin @typescript-eslint/parser \
  eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-react-native \
  eslint-plugin-import eslint-import-resolver-typescript eslint-import-resolver-babel-module \
  eslint-plugin-jsx-a11y eslint-plugin-unicorn eslint-plugin-security \
  eslint-plugin-promise eslint-plugin-sonarjs \
  eslint-plugin-jest eslint-plugin-testing-library \
  eslint-plugin-prettier eslint-config-prettier
```

Files created at the mobile package root:

- `.eslintrc.js` — enterprise ruleset extending `@react-native`, strict TypeScript, React, React Native, imports, a11y, security, sonarjs, unicorn, promise, prettier
- `.eslintignore` — excludes `node_modules/`, `ios/`, `android/`, `build/`, `dist/`, `coverage/`
- `.prettierrc.json` — 100 col width, single quotes, trailing commas, LF endings

Key enforced rules (aligned with project constraints in `AGENTS.md`):

| Rule | Level | Enforces |
|------|-------|----------|
| `react-native/no-inline-styles` | error | All styles must live in `src/theme/` |
| `react-native/no-color-literals` | error | Colors must come from theme |
| `react-native/no-raw-text` | error | All strings must be localized (en/hi/te) |
| `react-native/no-unused-styles` | error | No dead style entries |
| `@typescript-eslint/no-explicit-any` | error | Strict typing across engines & runtime |
| `@typescript-eslint/no-floating-promises` | error | Critical for offline sync correctness |
| `@typescript-eslint/no-misused-promises` | error | Async safety |
| `react-hooks/exhaustive-deps` | error | Hook correctness |
| `react/no-unstable-nested-components` | error | Prevents render churn |
| `import/order` | error | Grouped, alphabetized, `@/*` as internal |
| `import/no-cycle` | error | Prevents circular deps in engines/runtime |
| `sonarjs/cognitive-complexity` | warn (15) | Maintainability |
| `security/*` | recommended | Flags eval, unsafe regex, etc. |
| `prettier/prettier` | error | Formatting enforced via lint |

Test files (`*.test.*`, `*.spec.*`, `__tests__/`, `tests/`) automatically get relaxed rules plus `eslint-plugin-jest` + `eslint-plugin-testing-library`.

### Scripts

Added to `package.json`:

```json
{
  "scripts": {
    "lint": "eslint . --ext .js,.jsx,.ts,.tsx --max-warnings=0",
    "lint:fix": "eslint . --ext .js,.jsx,.ts,.tsx --fix",
    "format": "prettier --write \"**/*.{js,jsx,ts,tsx,json,md}\"",
    "format:check": "prettier --check \"**/*.{js,jsx,ts,tsx,json,md}\"",
    "typecheck": "tsc --noEmit"
  }
}
```

### Pre-commit hooks

`lint-staged` config in `package.json`:

```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix --max-warnings=0",
      "prettier --write"
    ],
    "*.{json,md}": ["prettier --write"]
  }
}
```

Install husky hook:

```bash
npx husky init
echo "npx lint-staged" > .husky/pre-commit
```

---

# Project Setup Rationale — Developer & Long-Term Value

A breakdown of every configuration decision made and **why it matters** for developers and long-term maintenance.

## 1. React Native Bare Workflow (Not Expo)

| What | Why It Helps |
|------|-------------|
| Direct access to native code (Swift/Kotlin) | Required for tamper-proof camera watermarking, secure keychain, custom biometrics — you own the native layer |
| No Expo runtime lock-in | Free to upgrade RN, add any native module (react-native-mmkv, vision-camera) without ejecting later |
| Full CocoaPods + Gradle control | Enterprise security audits require visibility into every native dependency |

**Long-term**: When Apple/Google change platform rules (privacy manifests, edge-to-edge, target SDK bumps), you patch immediately — no waiting for Expo SDK release.

## 2. Path Aliases (`@/*` → `src/*`)

**Two-layer setup:** `tsconfig.json` (compile-time) + `babel.config.js` (runtime via `babel-plugin-module-resolver`)

```typescript
// ❌ Without alias — brittle, refactor-hostile
import { hideSplashScreen } from '../../../infrastructure/splash';

// ✅ With alias — location-independent
import { hideSplashScreen } from '@/infrastructure/splash';
```

| Benefit | Impact |
|---------|--------|
| Move files anywhere in `src/` | Imports never break |
| Grep-friendly | `grep "@/engines/workflow"` finds all consumers instantly |
| Enforces layered architecture | You *see* boundaries in every import statement (`@/runtime`, `@/engines`, `@/modules`) |
| Onboarding | New developers read imports and immediately understand the architecture |

**Long-term**: The architecture (runtime → engines → modules → widgets) becomes visually enforced in every file.

## 3. Layered Folder Structure

```
src/
├── runtime/       ← Configuration-driven execution
├── engines/       ← Domain logic (workflow, sync, rules)
├── infrastructure/← Platform services (camera, GPS, storage)
├── modules/       ← Feature verticals (assignments, verification)
├── widgets/       ← 25 dynamic form widgets
├── shared/        ← Cross-cutting utilities
└── core/          ← Types, constants, errors
```

| Benefit | Impact |
|---------|--------|
| Screaming Architecture | The folder tree *tells you what the app does* — not what framework it uses |
| Dependency direction | `modules/` can import `engines/`, never the reverse — enforced by ESLint `import/no-cycle` |
| Parallel team work | Two devs can work on `modules/verification` and `modules/assignments` without conflicts |
| Server-driven UI ready | `widgets/` maps 1:1 to JSON config from server |

**Long-term**: When you add a new feature (e.g., "candidate re-verification"), you create `modules/reverification/` — every other module remains untouched.

## 4. Enterprise ESLint Configuration

Key rules mapped to real problems:

| Rule | Prevents |
|------|----------|
| `react-native/no-inline-styles: error` | Inconsistent theming, light/dark mode failures |
| `react-native/no-color-literals: error` | Hardcoded colors bypassing theme tokens |
| `react-native/no-raw-text: error` | Missing en/hi/te localization |
| `@typescript-eslint/no-floating-promises: error` | **Critical for offline sync** — silent promise rejections corrupt state |
| `@typescript-eslint/no-misused-promises: error` | `onPress={async () => ...}` bugs where errors vanish |
| `import/no-cycle: error` | Architecture erosion (module A ↔ module B) |
| `import/order` (alphabetized, grouped) | Merge conflict reduction |
| `security/detect-object-injection` | Prevents dynamic key attacks in JSON-driven UI |
| `sonarjs/cognitive-complexity: 15` | Functions stay maintainable |
| `react-hooks/exhaustive-deps: error` | Stale closures — a top cause of RN production bugs |

**Long-term impact**: Every rule here is a **preventable production incident**. The linter catches issues in seconds; production catches them in hours (with users affected).

## 5. Prettier + `lint-staged` + Husky

| Benefit | Impact |
|---------|--------|
| Format-on-commit | Zero "fix formatting" PRs |
| Uniform style | Code reviews focus on logic, not tabs vs spaces |
| Fast feedback | Runs only on staged files (~2 sec) |

**Long-term**: Codebase looks like one person wrote it — even after 10 developers and 3 years.

## 6. Strict TypeScript

- `strict: true` — null safety, no implicit `any`
- `paths` — alias resolution
- Configured for JSX, RN types

| Benefit | Impact |
|---------|--------|
| Compile-time contract enforcement | JSON widget configs typed end-to-end |
| Refactor safety | Rename a field → compiler shows every consumer |
| API contract fidelity | Server DTOs mirror mobile types |
| IDE intelligence | Autocomplete + go-to-definition across the whole tree |

**Long-term**: When you change the workflow engine's state machine, TS shows you every screen that needs updating — before runtime.

## 7. Splash Screen (`react-native-bootsplash`)

| Benefit | Impact |
|---------|--------|
| No white flash | Professional first impression |
| Native (not JS) | Shows *before* JS bundle loads (~2 sec on cold start) |
| CLI-generated assets | Regenerate on logo change in one command |
| Auto-patches native code | No manual AppDelegate/MainActivity edits |
| Controlled hide timing | Wait for auth check + config sync before revealing app |

**Long-term**: Rebrand? Run `npx react-native-bootsplash generate new-logo.png` and commit — done.

## 8. Selected Dependencies (Grouped by Purpose)

| Group | Why This Choice |
|-------|----------------|
| **Storage: react-native-mmkv** | 30× faster than AsyncStorage; synchronous API prevents race conditions in offline queue |
| **State: zustand + redux-saga** | Zustand for local UI state (simple), Redux+Saga for complex async flows (sync engine, workflow orchestration) |
| **UI: Gluestack + Reanimated** | Themeable, accessible, native-driven animations at 60fps |
| **Camera: vision-camera** | Frame processors for real-time GPS/timestamp watermarking (evidence integrity) |
| **Networking: axios** | Interceptors for auth token refresh, request queuing when offline |
| **Localization: i18next** | Namespace splitting per module, pluralization, RTL-ready |
| **Testing: Jest + Detox** | Unit + E2E — matches the `tests/` folder structure (unit, integration, e2e, widget, workflow) |

**Long-term**: Every choice supports the **offline-first, tamper-proof, JSON-driven** architecture — no rewrites needed as features grow.

## Summary — What Each Setting Buys You

| Setting | Immediate Value | 6-Month Value | 3-Year Value |
|---------|----------------|---------------|--------------|
| Bare workflow | Native access | Custom native modules | Platform update independence |
| Path aliases | Cleaner imports | Painless refactoring | Architecture enforced visually |
| Folder structure | Clear ownership | Parallel team work | New features drop into place |
| ESLint rules | Fewer bugs | Consistent code | Zero legacy anti-patterns |
| Prettier + hooks | Fast reviews | No style debates | Uniform 100K-line codebase |
| Strict TS | Fewer runtime errors | Safe refactors | Server/mobile contract fidelity |
| Bootsplash | Better UX | Fast rebranding | Zero native code drift |

**The overarching principle**: Every setup decision **prevents a class of problem entirely** rather than trying to fix it later. That's what makes an enterprise codebase survive 5+ years without a rewrite.
