---
applyTo:
  - "mobile/src/security/**"
  - "mobile/src/services/security/**"
  - "mobile/src/runtime/security/**"
---

# Security Instructions

These instructions apply to all security-related implementations.

Refer to:

- docs/04-Architecture/06-Security-Architecture.md
- docs/02-Business/07-Functional-Requirements.md
- docs/02-Business/08-Non-Functional-Requirements.md

Security is a first-class architectural concern.

Never compromise security for convenience.

---

# Security Philosophy

FullScan is an enterprise application used to collect trusted business evidence.

Security is required at every layer of the platform.

Security is not a feature.

It is part of every implementation.

---

# Security Principles

Follow:

- Secure by Design
- Least Privilege
- Defense in Depth
- Fail Securely
- Zero Trust
- Principle of Least Knowledge

---

# Authentication

Current implementation:

- Username
- Password
- Registered Device

Future support:

- OAuth
- OIDC
- MFA

Do not hardcode authentication logic.

---

# Single Device Login

A user may be logged in on only one registered device.

The mobile application shall respect backend decisions regarding device registration.

Never attempt to bypass this restriction.

---

# Device Identity

Use approved platform identifiers.

Examples:

- Android ID
- Identifier for Vendor (iOS)

Do not generate custom identifiers when platform identifiers are available.

---

# Secure Storage

Store sensitive information only in secure storage.

Never use MMKV for:

- Passwords
- Authentication Secrets
- Private Keys

Use platform Keychain / Keystore.

---

# Biometrics

Support:

- Face ID
- Touch ID
- Fingerprint

Biometric templates must never leave the device.

Only platform APIs should be used.

---

# Mock Location

Mock location detection is mandatory.

Detection should prevent verification submission.

Events should be logged and reported to the backend when connectivity is available.

---

# Root / Jailbreak Detection

Detect:

- Rooted Android Devices
- Jailbroken iOS Devices

If detected:

- Restrict sensitive operations
- Notify the user
- Log the event
- Report to backend when appropriate

Business rules determine whether execution is blocked.

---

# Emulator Detection

The application should detect execution on:

- Android Emulator
- iOS Simulator (when applicable)

Production policies may restrict application usage.

---

# Permissions

Request only required permissions.

Examples:

- Camera
- Location
- Notifications (if enabled)

Explain why permissions are required.

Handle denial gracefully.

---

# HTTPS

All backend communication shall use HTTPS.

Never transmit business data over insecure channels.

---

# Input Validation

Validate all external input.

Do not trust:

- Configuration
- API Responses
- User Input

Validate before use.

---

# Sensitive Data

Never log:

- Passwords
- Tokens
- Aadhaar Numbers
- PAN Numbers
- Personal Identifiers
- Biometrics

Mask sensitive information where necessary.

---

# Session Management

Clear sensitive runtime information on:

- Logout
- Session Expiry
- Device Change

Avoid retaining sensitive information longer than necessary.

---

# Logging

Security events should be logged.

Examples:

- Authentication Failure
- Mock Location Detected
- Root Detection
- Permission Denied
- Device Registration Failure

Never log confidential information.

---

# Error Handling

Do not expose internal implementation details.

Show business-friendly error messages.

Technical details belong only in logs.

---

# Offline Security

Offline mode must not weaken security.

Business rules remain enforced.

Sensitive data remains protected.

---

# Dependency Rules

Security components should remain independent.

Business features should consume security services through interfaces.

Avoid tight coupling.

---

# Testability

Test:

- Authentication
- Secure Storage
- Mock Location Detection
- Root Detection
- Jailbreak Detection
- Permission Handling
- Session Expiry

Mock platform APIs during testing.

---

# Future Security

The architecture should support:

- Certificate Pinning
- Payload Encryption
- Device Attestation
- Runtime Integrity Verification
- Remote Device Revocation

These capabilities should be added without major architectural changes.

---

# Before Writing Code

Always verify:

✓ Is sensitive information protected?

✓ Is secure storage used?

✓ Is HTTPS enforced?

✓ Is mock location handled?

✓ Is root/jailbreak detection respected?

✓ Are sensitive values excluded from logs?

✓ Is the implementation independently testable?

If any answer is "No", redesign before implementation.

---

# Guiding Principle

Security is a platform responsibility.

Every feature must preserve the confidentiality, integrity, and trustworthiness of business evidence while protecting user and organizational data.

Never trade security for implementation convenience.