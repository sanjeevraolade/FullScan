# Biometric Login

Implemented biometric login for the FullScan Login screen, reusing the already-installed
`react-native-keychain` (no new native dependency).

## New infrastructure

`src/infrastructure/biometrics/` and `src/infrastructure/storage/biometric-credential-storage.*`:
a device-biometry-detection service and a separate biometric-gated Keychain vault (distinct
from the existing `TokenStorageService`, which must stay ungated so it isn't prompted on every
API call).

The vault stores only `{ username, password }` — no cached token. Biometric login always
re-authenticates through `/auth/login` with the stored credentials rather than trying a cached
token first, since that token may already have expired server-side and trying it would just be
a guaranteed-failing round trip.

`retrieve()` also self-heals: an earlier build wrote the vault as
`JSON.stringify({ password, token })` instead of a plain password. If it finds an entry in that
legacy shape, it discards it (clears the vault) and returns `null` instead of handing a mangled
value to `/auth/login` — the next login is a normal password login, after which biometric
enrollment is offered again and writes a clean entry.

## New feature hooks

- `use-biometric-enrollment.ts` drives the post-login "enable biometric login?" consent dialog
  (writes the vault, then does a verifying read to force the real OS prompt, rolling back on
  failure).
  - **Every successful password login refreshes an existing vault** with the credentials that
    just worked (`syncAfterPasswordLogin`). Without this, a vault enrolled by another account on
    the same device, or before a password change, kept replaying stale credentials. Device binding
    then refused them with a 403 ("This device is already bound to …").
  - If the refresh fails or is cancelled, the vault is cleared and the login carries on. The next
    password login offers enrollment again. A vault on a device whose biometrics were removed is
    also cleared.
  - iOS writes silently. On Android, react-native-keychain's biometric AES-GCM key also gates
    encryption, so the refresh shows a fingerprint prompt unless the user authenticated in the
    last 5 seconds. That prompt is titled `login.biometric.refresh.promptTitle`.
- `use-biometric-login.ts` drives the Login screen's icon and tap-to-unlock flow. On a
  successful biometric prompt it calls `login({ username, password })` with the stored
  credentials, restores the session from the profile `login()` returns plus reference data, and
  navigates.
  - A 401 from `/auth/login` (stored password rejected server-side) clears the vault and fails
    securely.
  - A 403 (device binding) shows `login.biometric.errors.deviceMismatch` and keeps the vault. The
    next password login refreshes it.
  - Other errors (network/5xx) leave the vault intact so the user can retry.

## Screen

`LoginScreen` now shows a Face ID/fingerprint button (icon chosen by detected biometry) when
enrolled, and an `AlertDialog` enrollment prompt after a qualifying first password login —
plaintext password never leaves the hook closure or touches navigation params.

## Also

- Localization keys in en/hi/te.
- `NSFaceIDUsageDescription` (iOS) and `USE_BIOMETRIC` permission (Android).
- Test coverage in `login-screen.test.tsx` (icon visibility/type, enrollment offer/accept/skip,
  biometric login success and failure paths) plus unit tests for both new infra services,
  including the legacy-vault self-heal path.

## Verification

- `tsc --noEmit` clean.
- Full Jest suite 87/87 passing.
- Prettier-formatted.
- Not verified: real device/simulator biometric prompts — recommend a manual pass on a
  physical device or simulator with enrolled Face ID/fingerprint before merging.
