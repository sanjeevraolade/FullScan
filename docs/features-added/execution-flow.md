# Execution Flow: Native Launch → Login Screen Rendered

This traces the app's startup sequence end-to-end, from the native process handing off to JS through to
the Login screen being interactive. Reflects the current screen-based architecture (see
[runtime-to-static-migration.md](runtime-to-static-migration.md) for how this replaced the earlier
Runtime Engine design).

## 1. Native bootstrap → JS entry (`index.js`)

React Native's native shell (iOS/Android) starts, initializes the JS runtime, and executes `index.js`:

- `import 'react-native-gesture-handler'` runs **first** — it registers native gesture-handling before
  react-navigation (which depends on it) touches the responder system. Order here is load-bearing; moving
  this import breaks navigation gestures.
- `AppRegistry.registerComponent(appName, () => App)` tells native code "when you want to mount the JS
  app, render `<App />`". Native then calls this and the RN bridge mounts the component tree.

## 2. `App.tsx` — process-level shell

```text
App()
 ├─ useColorScheme() → isDarkMode (native OS setting, e.g. iOS Dark Mode)
 ├─ <SafeAreaProvider>              // makes device insets measurable app-wide
 │   ├─ <StatusBar barStyle=.../>   // OS status bar styled from device dark mode, not app theme
 │   └─ <Application />             // hands off to src/app
```

`SafeAreaProvider` must wrap everything because `AppSafeArea` (used later) reads insets from this context.

## 3. `src/app/Application.tsx` — composition root

```text
Application()
 └─ <ApplicationProvider>
     └─ <ApplicationShell />
    </ApplicationProvider>
```

Two responsibilities split cleanly: `ApplicationProvider` handles **startup** (bootstrap + theme gating),
`ApplicationShell` handles **what's shown once ready** (safe area + navigation). `ApplicationShell` is
passed as `children`, so it doesn't mount/render until `ApplicationProvider` decides the app is ready.

## 4. `src/app/ApplicationProvider.tsx` — the bootstrap gate

On first render: `isBootstrapped` state is `false`, so it renders the **loading branch** — `ThemeProvider`
(themed even before bootstrap finishes, using whatever `ThemeEngine`'s default state resolves to)
wrapping `AppSafeArea` wrapping a centered `Spinner`.

`useEffect` fires after that first paint and calls `runBootstrap()` (async, detailed in step 5). When it
resolves:

- **Success** → `setIsBootstrapped(true)` → component re-renders, this time hitting the
  `return <ThemeProvider>{children}</ThemeProvider>` branch, which mounts `ApplicationShell` for the
  first time.
- **Failure** → logs the failed step and error; state never flips, so the app is stuck on the spinner (no
  error UI/retry yet — this is a known gap, not implemented).
- The `isMounted` flag guards against calling `setState` after unmount (e.g., fast refresh during dev).

## 5. `runBootstrap()` — `src/bootstrap/BootstrapService.ts` + `BootstrapPipeline.ts`

`runBootstrap()` builds a `BootstrapPipeline` of three steps and runs them **strictly in sequence**,
awaiting each one:

```text
BootstrapPipeline.run()
 ├─ [1] theme        → ThemeEngine.initialize()               (sync, sets mode = 'system')
 ├─ [2] localization → await LocalizationEngine.initialize()  (async, boots i18next with en/hi/te)
 └─ [3] splash       → await hideSplashScreen()                (async, fades out native splash)
```

Each step writes its result onto a shared `BootstrapContext` object (`{ themeMode, language }`) that's
threaded through — not consumed by anything downstream yet, but there for the next step to read if
needed. **If any step throws**, the pipeline stops immediately and returns
`{ success: false, failedStep }` — steps after the failure never run, so the app is never left
half-initialized (e.g., splash never hides if localization failed). If all three succeed, it returns
`{ success: true, context }`.

Note: `theme` and `localization` are synchronous/fast local operations (no network); `splash` is the only
step waiting on a native bridge call.

## 6. `ApplicationShell.tsx` — post-bootstrap shell

Once bootstrap succeeds and `Application` re-renders `ApplicationShell`:

```text
ApplicationShell()
 └─ <AppSafeArea>
     └─ <RootNavigator />
    </AppSafeArea>
```

`AppSafeArea` wraps children in `SafeAreaView` (real device insets from `react-native-safe-area-context`,
not Gluestack's deprecated one) plus a `Box` with the `$white` background token — chosen specifically to
match the native splash screen's background color so there's no visible color flash the instant splash
fades and the first screen paints.

## 7. `RootNavigator` — `src/navigation/root-navigator.tsx`

```text
RootNavigator()
 └─ <NavigationContainer>                         // react-navigation's root, owns navigation state/linking
     └─ <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
         └─ <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
    </NavigationContainer>
```

This is a genuine native-stack navigator — `Login` is currently the **only** registered route
(`ROUTE_NAMES.LOGIN` in `src/navigation/routes.ts`). React Navigation mounts `LoginScreen` directly as
the stack's initial screen; there's no intermediate "screen resolver" (that was the removed Runtime
Engine's job — see `runtime-to-static-migration.md`).

## 8. `LoginScreen` — `src/features/authentication/screens/login-screen.tsx`

```text
LoginScreen()
 ├─ useTranslation()          → t()  (i18next, language set during bootstrap step 2)
 ├─ useLoginForm()            → { control, errors, isSubmitting, submitLogin }
 └─ renders:
     ScrollView
      └─ Box (padding, centered)
          └─ VStack
              ├─ Heading + Text        (t('login.title'), t('login.welcome'))
              ├─ Controller "username" → FormTextField (required)
              ├─ Controller "password" → FormTextField (required, secure entry)
              ├─ Controller "employeeId" → FormTextField (optional)
              ├─ Controller "rememberMe" → Gluestack Checkbox
              └─ Button "submit" → onPress={submitLogin}
```

Each `Controller` (react-hook-form) binds one field to `useLoginForm`'s shared `control`, so field state
lives in the hook, not scattered across local `useState`s in the screen. `FormTextField`
(`src/shared/components/form-text-field.tsx`) is a dumb, reusable presentational component: it takes
`value`/`onChangeText`/`errorKey` and renders a Gluestack `FormControl` + `Input`, resolving both the
label and any error through `t()` itself.

## 9. `useLoginForm()` — `src/features/authentication/hooks/use-login-form.ts`

Owns all form state via `react-hook-form`'s `useForm`, with `mode: 'onSubmit'` (fields aren't validated
until first submit attempt, then react-hook-form re-validates on subsequent changes automatically).

On `submitLogin()`:

```text
handleSubmit(onValid, onInvalid)()
 ├─ if all `required` rules pass:
 │    onValid(values) → logs { rememberMe, hasEmployeeId } only — never username/password content
 └─ else:
      onInvalid(errors) → logs which field keys failed, sets errors.<field>.message = 'validation.required'
```

`errors.<field>.message` is a **localization key**, not a resolved string — `LoginScreen` resolves it via
`t(errorKey)` inside `FormTextField` at render time, so if the user switches language mid-error, the
error text updates too.

**Nothing past this point exists yet** — there's no credential check, no repository call, no
session/token storage. `useLoginForm` explicitly stops at "form is valid, here's what was entered."
Wiring actual authentication is future work.

## Full call chain, top to bottom

```text
index.js
 └─ App.tsx                                    (SafeAreaProvider, StatusBar, dark-mode detection)
     └─ Application.tsx
         └─ ApplicationProvider.tsx             (runs bootstrap, gates on isBootstrapped)
             └─ runBootstrap()
                 ├─ ThemeEngine.initialize()
                 ├─ LocalizationEngine.initialize()   (i18next: en/hi/te)
                 └─ hideSplashScreen()
             └─ ApplicationShell.tsx             (once bootstrapped)
                 └─ AppSafeArea.tsx               (real insets, splash-matching background)
                     └─ RootNavigator.tsx         (NavigationContainer + native-stack)
                         └─ LoginScreen.tsx        (initialRouteName="Login")
                             └─ useLoginForm.ts    (react-hook-form state/validation)
                             └─ FormTextField.tsx  (×3, shared presentational input)
```

Every layer in this chain logs entry (`LoggerService.info`) so the sequence above is literally traceable
in the console with the `[FullScan] <file>: <function>: ...` prefix convention.
