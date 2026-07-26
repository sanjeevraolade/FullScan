---
name: fullscan-security
description: Load when implementing authentication, secure storage, biometrics, device/root/mock-location detection, permissions, or anything handling tokens/credentials/PII. Load before deciding where to store a secret or log a value that might be sensitive.
---

# Security

Applies to `src/security/**` and any code touching auth, storage of secrets, or device trust signals. Security is a first-class concern in every layer, not a bolt-on feature — never compromise it for convenience.

## Principles

Secure by Design · Least Privilege · Defense in Depth · Fail Securely · Zero Trust · Least Knowledge.

## Authentication

Current: username + password + registered device. Planned: OAuth, OIDC, MFA. Never hardcode authentication logic.

## Single device login

A user may be logged in on exactly one registered device — the app respects the backend's decision here and never attempts to bypass it.

## Device identity

Use platform identifiers (Android ID, iOS identifierForVendor) — don't invent custom device IDs when a platform one is available.

## Secure storage

Passwords, auth secrets, and private keys go in the platform **Keychain/Keystore** — never in MMKV. MMKV is fine for non-sensitive app state (theme, language, cached config), never for secrets.

## Biometrics

Face ID / Touch ID / Fingerprint via platform APIs only. Biometric templates never leave the device.

## Mock location detection — mandatory

Detected mock location must block verification submission. Log the event and report to the backend once connectivity allows.

## Root / jailbreak / emulator detection

On detection: restrict sensitive operations, notify the user, log the event, report to the backend when possible. Whether execution is fully blocked is a business-rule/configuration decision, not hardcoded in the detection code itself.

## Permissions

Request only what's actually required (camera, location, notifications), explain why, and handle denial gracefully rather than crashing or silently failing.

## Transport & input

HTTPS for all backend communication, no exceptions. Validate all external input — configuration, API responses, and user input are all untrusted until validated.

## Never log

Passwords, tokens, Aadhaar numbers, PAN numbers, other personal identifiers, biometric data. Mask sensitive values where they must appear in any output.

## Session hygiene

Clear sensitive runtime state on logout, session expiry, and device change — don't retain secrets longer than necessary.

## Logging

Log authentication failures, mock-location detection, root detection, permission denials, device registration failures via `LoggerService` — but never the confidential values themselves.

## Error handling

Never expose internal implementation details to the user — show business-friendly messages; technical detail belongs only in logs.

## Offline

Offline mode must not weaken security — business rules and data protection stay enforced even without connectivity.

## Testability

Test authentication, secure storage, mock-location detection, root/jailbreak detection, permission handling, and session expiry with mocked platform APIs.

## Before writing security-adjacent code, verify

Is sensitive information protected (secure storage, not MMKV/plain storage)? Is HTTPS enforced? Is mock location / root detection respected where relevant? Are sensitive values excluded from every log line? Is it independently testable with mocked platform APIs? If any answer is "no," redesign first.
