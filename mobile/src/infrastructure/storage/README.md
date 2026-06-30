# Storage Service

Local persistence using MMKV and SQLite.

## Responsibility

- Key-value storage (MMKV)
- Structured data storage (SQLite)
- Secure storage for tokens
- Cache management
- Storage migration

## Rules

- No sensitive data in AsyncStorage without encryption.
- JWT tokens stored in secure keychain, never plain storage.
- All DB access through a data-access layer.
