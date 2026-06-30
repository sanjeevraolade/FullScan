# Encryption Service

Data encryption and decryption for sensitive information.

## Responsibility

- AES encryption/decryption
- Key management
- Hash computation (SHA-256)
- Secure random generation

## Rules

- All sensitive data at rest must be encrypted.
- Encryption keys must never be hardcoded.
- Must use platform-provided secure key storage.
