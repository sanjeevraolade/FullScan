# Biometrics Service

Fingerprint and Face ID authentication abstraction.

## Responsibility

- Biometric availability detection
- Biometric prompt presentation
- Authentication result handling
- Fallback to PIN/password

## Rules

- Must abstract platform differences (iOS Face ID vs Android BiometricPrompt).
- Must handle graceful degradation when biometrics unavailable.
