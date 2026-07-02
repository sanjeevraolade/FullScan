# Bootstrap React Native Project — Full Session Log

Complete record of the FullScan mobile bootstrap: from `npx init` to a runnable app with splash screen, path aliases, and enterprise ESLint. Every issue encountered and its resolution is captured below so the process can be reproduced exactly.

---

## Table of Contents

1. [Milestone 1 — Bootstrap RN Project](#milestone-1--bootstrap-rn-project)
2. [Milestone 2 — Install Dependencies](#milestone-2--install-dependencies)
3. [Folder Structure Generation](#folder-structure-generation)
4. [.gitignore](#gitignore)
5. [Pod Install Troubleshooting](#pod-install-troubleshooting)
6. [Splash Screen (react-native-bootsplash)](#splash-screen-react-native-bootsplash)
7. [Path Aliases (`@/*` → `src/*`)](#path-aliases--src)
8. [Enterprise ESLint Configuration](#enterprise-eslint-configuration)
9. [Splash Screen Debugging (iOS + Android)](#splash-screen-debugging-ios--android)
10. [Project Setup Rationale — Long-Term Value](#project-setup-rationale--long-term-value)

---

## Milestone 1 — Bootstrap RN Project

### Rule

- **Bare workflow only** — no Expo (required for native security modules)
- Direct CocoaPods + Gradle control for enterprise audits

### Command

```bash
npx @react-native-community/cli@latest init FullScan \
  --directory mobile_tmp \
  --skip-git-init \
  --skip-install
```

`--directory mobile_tmp` because RN CLI refuses to overwrite an existing `mobile/src` folder.

### Post-init merge

After init:

```bash
# Copy generated files into existing mobile/ package
cp -R mobile_tmp/{android,ios,__tests__,App.tsx,index.js,package.json,tsconfig.json,babel.config.js,metro.config.js,jest.config.js,app.json,Gemfile} mobile/
rm -rf mobile_tmp
```

### Versions installed

- React Native **0.86.0** (bare, new architecture, `fabricEnabled=true`)
- React **19.2.3**
- Node engine `>=22.11.0`
- iOS: Swift `AppDelegate` using `RCTReactNativeFactory` + `RCTAppDependencyProvider`
- Android: Kotlin `MainActivity` + `MainApplication`, package `com.fullscan`

---

## Milestone 2 — Install Dependencies

Grouped by purpose, installed via `npm install`.

### Core

- `react`, `react-native`, `typescript`

### Navigation

- `@react-navigation/native`
- `@react-navigation/native-stack`
- `@react-navigation/drawer`
- `react-native-screens`
- `react-native-safe-area-context`
- `react-native-gesture-handler`

### State

- `zustand` — local UI state
- `redux`
- `redux-saga` — complex async flows (sync engine, workflow orchestration)

### UI

- `@gluestack-ui/themed`
- `@gluestack-ui/config`
- `react-native-svg`
- `react-native-reanimated`
- `react-native-vector-icons`

### Forms

- `react-hook-form`

### Networking

- `axios`

### Storage

- `react-native-mmkv`

### Camera

- `react-native-vision-camera`

### Splash

- `react-native-bootsplash`

### Localization

- `i18next`
- `react-i18next`

### Device

- `@react-native-community/netinfo`
- `react-native-permissions`
- `react-native-device-info`

### Testing

- `jest`
- `@testing-library/react-native`
- `detox`

### Development

- `eslint`, `prettier`, `husky`, `lint-staged`, `babel-plugin-module-resolver`

### Nitro peer dependencies (required by other packages)

- `react-native-worklets@~0.10` — Reanimated 4.x peer
- `react-native-nitro-modules` — required by `react-native-mmkv`
- `react-native-nitro-image` — required by `react-native-vision-camera`

---

## Folder Structure Generation

Created **99 directories, 121 README.md files** under `mobile/src/`.

```
src/
├── config/
├── core/            # constants, decorators, errors, events, helpers, hooks, interfaces, models, types, utils
├── engines/         # analytics, attachment, configuration, geo, localization, rules, security, sync, theme, validation, workflow
├── infrastructure/  # api, biometrics, camera, connectivity, device, encryption, filesystem, gps, logger, networking, notifications, permissions, storage, splash
├── localization/    # en, hi, te
├── modules/         # about, assignments, attachments, authentication, dashboard, notifications, profile, reports, settings, sync, verification
├── navigation/
├── runtime/         # configuration, engine, lifecycle, localization, navigation, plugins, registry, renderer, serialization, validation, workflow
├── shared/          # animations, assets, components, formatters, icons, layouts, validators
├── store/           # assignments, authentication, configuration, localization, session, sync, theme, workflow
├── tests/           # e2e, engine, integration, runtime, snapshot, unit, widget, workflow
├── theme/
└── widgets/         # 25 dynamic form widget types
```

Every directory contains a placeholder `README.md` describing its purpose. No implementation code.

---

## .gitignore

Created `mobile/.gitignore` with the standard RN entries:

- OSX (`.DS_Store`, `*.pbxuser`)
- Xcode (`build/`, `DerivedData/`)
- Android (`*.iml`, `.gradle/`, `local.properties`, `captures/`)
- Node (`node_modules/`, `npm-debug.log`, `yarn-error.log`)
- CocoaPods (`Pods/`)
- Metro (`.metro-health-check*`)
- Env (`.env`, `.env.local`)
- IDE (`.idea/`, `.vscode/`)
- Fastlane (`fastlane/report.xml`)
- Build (`build/`, `dist/`, `coverage/`)

---

## Pod Install Troubleshooting

Multiple errors surfaced from `npx pod-install` / `bundle exec pod install`.

### Issue 1 — Reanimated worklets validation

**Error**:

```
[Reanimated] Failed to validate worklets version
```

**Diagnosis**: Ran the validator directly to expose the real message:

```bash
node node_modules/react-native-reanimated/scripts/validate-worklets-build.js
```

Root cause: Reanimated 4.5.0 requires `react-native-worklets@0.10.x`. The first attempted fix (`@worklets/core`) was wrong.

**Fix**:

```bash
npm install react-native-worklets@0.10
```

### Issue 2 — NitroModules missing

**Error**:

```
Unable to find a specification for NitroModules depended upon by NitroMmkv
```

**Fix**:

```bash
npm install react-native-nitro-modules
```

### Issue 3 — NitroImage missing

**Error**:

```
Unable to find a specification for NitroImage depended upon by VisionCamera
```

**Fix**:

```bash
npm install react-native-nitro-image
```

### Lesson

Nitro-based RN packages don't auto-install their Nitro peers. Always check the pod error and add the peer explicitly.

Podfile.lock finalized with `RNBootSplash x4` and all Nitro pods present.

---

## Splash Screen (react-native-bootsplash)

### Install

```bash
npm install react-native-bootsplash
```

### Generate native assets

```bash
cd mobile
npx react-native-bootsplash generate <path-to-logo>.png \
  --platforms=ios,android \
  --background=#FFFFFF \
  --logo-width=100
cd ios && bundle exec pod install
```

> The v6+ API is a **standalone CLI**: `npx react-native-bootsplash generate ...`. The older `npx react-native generate-bootsplash` command no longer exists.

This generates:

- **iOS**: `BootSplash.storyboard` + `BootSplashLogo-XXXXXX.imageset` in `Images.xcassets`
- **Android**: `bootsplash_logo` drawables (mdpi → xxxhdpi) + `bootsplash.xml` colors
- Adds `BootTheme` style to Android `styles.xml`
- Updates `AndroidManifest.xml` so `MainActivity` launches with `BootTheme`
- Sets `UILaunchStoryboardName` = `BootSplash` in `Info.plist`

**The CLI does NOT patch `AppDelegate.swift` or `MainActivity.kt`** — those must be done manually.

### JS helper

Created at `mobile/src/infrastructure/splash/index.ts`:

```ts
import BootSplash from 'react-native-bootsplash';

/**
 * Hide the native splash screen with a fade animation.
 * Call this once the app is ready (after navigation is mounted
 * and initial configuration/localization is loaded).
 */
export const hideSplashScreen = async (): Promise<void> => {
  await BootSplash.hide({ fade: true });
};

/**
 * Check whether the splash screen is currently visible.
 */
export const isSplashVisible = (): boolean => {
  return BootSplash.isVisible();
};
```

> Bootsplash v7 replaced the async `getVisibilityStatus()` with synchronous `isVisible(): boolean`.

### JS integration in App.tsx

```tsx
import { useEffect } from 'react';
import { hideSplashScreen } from '@/infrastructure/splash';

function App() {
  useEffect(() => {
    hideSplashScreen();
  }, []);
  // ...
}
```

---

## Path Aliases (`@/*` → `src/*`)

To use `import { X } from '@/infrastructure/...'` at both compile time and runtime, **two configs** are required.

### 1. TypeScript — `tsconfig.json`

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

### 2. Metro/Babel — `babel.config.js`

Metro **does not read `tsconfig.json` paths**. Without babel plugin config, you get:

```
Unable to resolve module @/infrastructure/splash from App.tsx
```

**Fix** — install and configure:

```bash
npm install --save-dev babel-plugin-module-resolver
```

```js
// babel.config.js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./'],
        extensions: [
          '.ios.ts',
          '.android.ts',
          '.ts',
          '.ios.tsx',
          '.android.tsx',
          '.tsx',
          '.jsx',
          '.js',
          '.json',
        ],
        alias: { '@': './src' },
      },
    ],
  ],
};
```

Restart Metro with cache reset:

```bash
npx react-native start --reset-cache
```

---

## Enterprise ESLint Configuration

### Install

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

### Files created

| File | Purpose |
|------|---------|
| `.eslintrc.js` | Enterprise ruleset |
| `.eslintignore` | Skip `node_modules/`, `ios/`, `android/`, `build/`, `dist/`, `coverage/` |
| `.prettierrc.json` | 100 col width, single quotes, trailing commas, LF endings |

### `.eslintrc.js` — key contents

Extends: `@react-native`, `@typescript-eslint/recommended` + type-checked, `react/recommended`, `react-hooks/recommended`, `react-native/all`, `import/recommended`, `jsx-a11y/recommended`, `security/recommended-legacy`, `promise/recommended`, `sonarjs/recommended-legacy`, `unicorn/recommended`, `prettier/recommended`.

Parser: `@typescript-eslint/parser` with `project: ./tsconfig.json`.

Resolvers: `typescript` + `babel-module` (so `@/*` resolves in lint).

### Key enforced rules (mapped to `AGENTS.md` constraints)

| Rule | Level | Enforces |
|------|-------|----------|
| `react-native/no-inline-styles` | error | All styles must live in `src/theme/` |
| `react-native/no-color-literals` | error | Colors from theme only |
| `react-native/no-raw-text` | error | Localization enforced (en/hi/te) |
| `react-native/no-unused-styles` | error | No dead style entries |
| `@typescript-eslint/no-explicit-any` | error | Strict typing |
| `@typescript-eslint/no-floating-promises` | error | Critical for offline sync |
| `@typescript-eslint/no-misused-promises` | error | Async safety |
| `@typescript-eslint/consistent-type-imports` | error | Inline `type` imports |
| `react-hooks/exhaustive-deps` | error | Hook correctness |
| `react/no-unstable-nested-components` | error | Prevents render churn |
| `import/order` | error | Grouped, alphabetized, `@/*` internal |
| `import/no-cycle` | error | No circular deps in engines |
| `sonarjs/cognitive-complexity: 15` | warn | Maintainability |
| `security/*` | recommended | eval, unsafe regex, etc. |
| `prettier/prettier` | error | Format enforced via lint |

### Test file overrides

For `*.test.*`, `*.spec.*`, `__tests__/**`, `tests/**`:

- Loads `plugin:jest/recommended` + `plugin:testing-library/react`
- Relaxes: `no-explicit-any`, `no-non-null-assertion`, RN style/color/text rules, `sonarjs/no-duplicate-string`

### npm scripts

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

### Pre-commit (husky + lint-staged)

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

Install the hook:

```bash
npx husky init
echo "npx lint-staged" > .husky/pre-commit
```

---

## Splash Screen Debugging (iOS + Android)

After bootsplash assets were generated, the launch was still showing a **blank/black screen** instead of the splash. The native init hooks had not been wired up — the `generate` CLI patches resources only, not Swift/Kotlin.

### Symptom 1 — Blank splash on both platforms

**Cause**: `AppDelegate.swift` and `MainActivity.kt` never called `RNBootSplash.init(...)`.

### Symptom 2 — Android: black flash between launch theme and JS

**Cause**: `react-native-screens >= 4.16.0` requires `RNScreensFragmentFactory` to be assigned before bootsplash init.

### Symptom 3 — iOS: build error

```
method does not override any method from its superclass
value of type 'RCTDefaultReactNativeFactoryDelegate' has no member 'customizeRootView'
```

**Root cause**:

- `RCTDefaultReactNativeFactoryDelegate` only *conforms to* `RCTUIConfiguratorProtocol`
- It does **not** implement `customizeRootView:` itself
- Swift refuses `override` for a protocol method the concrete parent doesn't implement
- Bootsplash README's `override func customize(_ rootView:)` example is outdated

### Final working native wiring

#### iOS — `mobile/ios/FullScan/AppDelegate.swift`

Set the block on `factory.rootViewFactory.customizeRootView` (called exactly once on root view creation):

```swift
import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import RNBootSplash

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    // ⬇️ Bootsplash init — runs when root view is created
    factory.rootViewFactory.customizeRootView = { rootView in
      RNBootSplash.initWithStoryboard("BootSplash", rootView: rootView)
    }

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "FullScan",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
```

#### Android — `mobile/android/app/src/main/java/com/fullscan/MainActivity.kt`

```kotlin
package com.fullscan

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.swmansion.rnscreens.fragment.restoration.RNScreensFragmentFactory
import com.zoontek.rnbootsplash.RNBootSplash

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    // Required for react-native-screens >= 4.16.0
    supportFragmentManager.fragmentFactory = RNScreensFragmentFactory()
    // Bootsplash init — must run before super.onCreate()
    RNBootSplash.init(this, R.style.BootTheme)
    super.onCreate(savedInstanceState)
  }

  override fun getMainComponentName(): String = "FullScan"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
```

### Rebuild required

Native changes → JS reload is not enough:

```bash
# iOS
cd mobile/ios && bundle exec pod install && cd ..
npx react-native run-ios

# Android
npx react-native run-android
```

Or in Xcode: **Product → Clean Build Folder** (⇧⌘K), then Run.

---

## Project Setup Rationale — Long-Term Value

### 1. Bare workflow (not Expo)

| What | Why |
|------|-----|
| Direct native code access (Swift/Kotlin) | Tamper-proof camera watermarking, secure keychain, custom biometrics |
| No Expo runtime lock-in | Add any native module without ejecting later |
| Full Pods + Gradle control | Enterprise security audits need dep visibility |

### 2. Path aliases (`@/*` → `src/*`)

```typescript
// ❌ Brittle
import { hideSplashScreen } from '../../../infrastructure/splash';
// ✅ Location-independent
import { hideSplashScreen } from '@/infrastructure/splash';
```

Move files freely; imports never break. Layered architecture becomes visually enforced (`@/runtime`, `@/engines`, `@/modules`).

### 3. Layered folder structure

Screaming Architecture — the folder tree tells you *what the app does*, not what framework it uses. Dependency direction (`modules → engines → infrastructure`) enforced by ESLint `import/no-cycle`.

### 4. Enterprise ESLint

Every rule is a **preventable production incident**:

- `no-inline-styles` → theming consistency
- `no-raw-text` → localization coverage
- `no-floating-promises` → offline sync correctness
- `no-misused-promises` → `onPress={async ...}` bugs where errors vanish
- `import/no-cycle` → architecture erosion
- `exhaustive-deps` → stale closures (top RN production bug)
- `security/*` → eval, unsafe regex, dynamic key injection

### 5. Prettier + husky + lint-staged

Zero style-fix PRs. Reviews focus on logic. Runs only on staged files (~2s).

### 6. Strict TypeScript

Compile-time contract enforcement for JSON widget configs, server DTOs, and workflow state machines. Rename a field → compiler shows every consumer.

### 7. Splash screen

Native (not JS) → shows *before* JS bundle loads (~2s cold-start gap covered). Rebrand = one CLI regenerate.

### 8. Dependency choices

| Package | Why |
|---------|-----|
| `react-native-mmkv` | 30× faster than AsyncStorage, sync API (no race conditions in offline queue) |
| `zustand` + `redux-saga` | Zustand for local UI, Redux+Saga for complex async (sync engine, workflow orchestration) |
| `vision-camera` | Frame processors for real-time GPS/timestamp watermarking |
| `axios` | Interceptors for auth refresh + offline queue |
| `i18next` | Namespace splitting per module, pluralization, RTL-ready |
| `jest` + `detox` | Unit + E2E matching the `tests/` folder structure |

### Summary — value over time

| Setting | Immediate | 6 months | 3 years |
|---------|-----------|----------|---------|
| Bare workflow | Native access | Custom native modules | Platform update independence |
| Path aliases | Cleaner imports | Painless refactoring | Architecture enforced visually |
| Folder structure | Clear ownership | Parallel team work | New features drop into place |
| ESLint rules | Fewer bugs | Consistent code | Zero legacy anti-patterns |
| Prettier + hooks | Fast reviews | No style debates | Uniform 100K-line codebase |
| Strict TS | Fewer runtime errors | Safe refactors | Server/mobile contract fidelity |
| Bootsplash | Better UX | Fast rebranding | Zero native code drift |

**Overarching principle**: Every setup decision **prevents a class of problem entirely** rather than trying to fix it later. That's what makes an enterprise codebase survive 5+ years without a rewrite.

---

## Final File Inventory

| File | Purpose |
|------|---------|
| `mobile/package.json` | RN 0.86 manifest, all deps, lint/format/typecheck scripts, lint-staged config |
| `mobile/tsconfig.json` | Strict TS, `@/*` paths |
| `mobile/babel.config.js` | RN preset + `module-resolver` for `@/*` |
| `mobile/.eslintrc.js` | Enterprise ruleset (13+ plugins) |
| `mobile/.eslintignore` | Native/build folders excluded |
| `mobile/.prettierrc.json` | Formatting config |
| `mobile/.gitignore` | Standard RN ignores |
| `mobile/App.tsx` | Calls `hideSplashScreen()` in `useEffect` |
| `mobile/src/infrastructure/splash/index.ts` | `hideSplashScreen()` + `isSplashVisible()` helpers |
| `mobile/src/**` | 99 dirs, 121 READMEs — layered architecture skeleton |
| `mobile/ios/FullScan/AppDelegate.swift` | Bootsplash wired via `factory.rootViewFactory.customizeRootView` block |
| `mobile/ios/FullScan/BootSplash.storyboard` | Auto-generated by bootsplash CLI |
| `mobile/ios/FullScan/Info.plist` | `UILaunchStoryboardName = BootSplash` |
| `mobile/android/app/src/main/java/com/fullscan/MainActivity.kt` | `RNScreensFragmentFactory` + `RNBootSplash.init` in `onCreate` |
| `mobile/android/app/src/main/res/values/styles.xml` | `BootTheme` style |
| `mobile/android/app/src/main/AndroidManifest.xml` | `MainActivity` uses `@style/BootTheme` |
| `mobile/android/app/src/main/res/drawable-*/bootsplash_logo.png` | Auto-generated logo drawables |
