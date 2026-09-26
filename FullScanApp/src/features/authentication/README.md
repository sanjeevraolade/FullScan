# Authentication — Login

The Login screen and its supporting form logic. This is the only registered route today
(`ROUTE_NAMES.LOGIN` in `src/navigation/routes.ts`) and the app's current entry point.

## Status

UI, validation and keyboard/UX behaviour are complete. Credential verification is **not** — `login()`
in `src/repositories/authentication-repository.ts` is a placeholder stub that simulates network latency
and always resolves successfully. No token issuance, session storage, or real backend call exists yet.
Swapping in the real repository implementation is the only change needed to wire up real authentication;
nothing above the repository call needs to change.

## Folder layout

```text
features/authentication/
    screens/login-screen.tsx           presentation + form wiring only
    screens/login-screen.test.tsx
    hooks/use-login-form.ts            form state, validation, submit orchestration
    types/login-form.types.ts          LoginFormValues, LoginErrorKey
    index.ts                           public surface (consumed by src/navigation)
```

## What the screen does

- Renders the FullScan logo (`src/shared/assets/images/logo.png`, top-centered), title, welcome text,
  username/password/employee ID fields, a "remember me" checkbox, a submit button, an error banner slot,
  and a version/copyright footer.
- **Validation**: username and password are required; employee ID is optional and never blocks submit.
  Errors only appear after a submit attempt (`mode: 'onSubmit'` in `useLoginForm`), not while typing.
- **Submit button**: disabled until both username and password are non-blank, and again while a submit
  is in flight (shows a `ButtonSpinner`).
- **Password field**: secure entry by default with a show/hide toggle (`FormTextField`'s `isSecure` prop
  adds an eye-icon `InputSlot`).
- **Keyboard flow**: username's return key ("Next") focuses password; password's return key ("Done")
  submits. Tapping outside any field dismisses the keyboard. The screen is wrapped in
  `KeyboardAvoidingView` so the active field is never hidden behind the keyboard.
- **Errors**: on a thrown login failure, `useLoginForm` maps it to a `LoginErrorKey`
  (`'invalidCredentials' | 'network' | 'serverUnavailable'`) and the screen renders it as a Gluestack
  `Alert`. The stub never throws today, so this path is wired but not yet exercised at runtime.

## Key files

| File | Owns |
| --- | --- |
| `hooks/use-login-form.ts` | React Hook Form setup, `canSubmit` derivation, calling the auth repository, mapping failures to `LoginErrorKey` |
| `types/login-form.types.ts` | `LoginFormValues`, `LoginErrorKey` |
| `screens/login-screen.tsx` | Layout, field wiring via `Controller`, focus management, footer |
| `src/shared/components/form-text-field.tsx` | Shared labelled/validated input; owns password show/hide state and exposes a `focus()` handle via `FormTextFieldHandle` |
| `src/repositories/authentication-repository.ts` | Placeholder `login()` — the seam the real repository replaces |
| `src/infrastructure/device/index.ts` | `getAppVersion()`, used for the footer |

## Localization

All strings live under the `login` and `validation` namespaces in
`src/localization/{en,hi,te}/common.json` (`login.title`, `login.fields.*`, `login.actions.*`,
`login.footer.*`, `login.errors.*`, `login.logoAlt`). No user-visible string in this feature is
hardcoded.

## Tests

- `screens/login-screen.test.tsx` — rendering, submit-button enable/disable, required-field validation,
  password visibility toggle, footer content, and localization switching.
- `src/shared/components/form-text-field.test.tsx` — label/error rendering, show/hide toggle,
  `returnKeyType`/`onSubmitEditing` forwarding, and the `focus()` imperative handle.

## Not built yet

- Real credential verification, token issuance, session persistence (`src/store/authentication` is
  currently empty).
- Network error surfaces beyond the wired-but-unused `LoginErrorKey` mapping.
- "Remember me" has no effect yet — the checkbox only holds form state.
