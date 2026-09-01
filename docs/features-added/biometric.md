# Biometric Login

Implemented biometric login for the FullScan Login screen, reusing the already-installed
`react-native-keychain` (no new native dependency).

## New infrastructure

`src/infrastructure/biometrics/` and `src/infrastructure/storage/biometric-credential-storage.*`:
a device-biometry-detection service and a separate biometric-gated Keychain vault (distinct
from the existing `TokenStorageService`, which must stay ungated so it isn't prompted on every
API call).

## New feature hooks

- `use-biometric-enrollment.ts` drives the post-login "enable biometric login?" consent dialog
  (writes the vault, then does a verifying read to force the real OS prompt, rolling back on
  failure).
- `use-biometric-login.ts` drives the Login screen's icon and tap-to-unlock flow, with a 401
  fallback that silently re-logs-in using the stored password when the cached token has
  expired, and fails securely (clears the vault) only when the stored password itself is
  proven invalid.

## Screen

`LoginScreen` now shows a Face ID/fingerprint button (icon chosen by detected biometry) when
enrolled, and an `AlertDialog` enrollment prompt after a qualifying first password login —
plaintext password never leaves the hook closure or touches navigation params.

## Also

- Localization keys in en/hi/te.
- `NSFaceIDUsageDescription` (iOS) and `USE_BIOMETRIC` permission (Android).
- Test coverage in `login-screen.test.tsx` (icon visibility/type, enrollment offer/accept/skip,
  biometric login success and failure paths) plus unit tests for both new infra services.

## Verification

- `tsc --noEmit` clean.
- Full Jest suite 81/81 passing.
- Prettier-formatted.
- Not verified: real device/simulator biometric prompts — recommend a manual pass on a
  physical device or simulator with enrolled Face ID/fingerprint before merging.
