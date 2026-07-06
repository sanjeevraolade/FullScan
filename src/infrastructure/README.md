# Infrastructure

Platform services and native integrations. Abstracts device capabilities behind clean interfaces.

## Structure

| Directory        | Service                    | Responsibility                          |
|------------------|----------------------------|-----------------------------------------|
| `api/`           | API Client                 | REST communication, interceptors        |
| `biometrics/`    | Biometrics Service         | Fingerprint/Face ID authentication      |
| `camera/`        | Camera Service             | Photo/video capture abstraction         |
| `connectivity/`  | Connectivity Service       | Network state monitoring                |
| `device/`        | Device Service             | Device info, platform detection         |
| `encryption/`    | Encryption Service         | Data encryption/decryption              |
| `filesystem/`    | File System Service        | File read/write operations              |
| `gps/`           | GPS Service                | Location acquisition abstraction        |
| `logger/`        | Logger Service             | Structured logging                      |
| `networking/`    | Networking Service         | HTTP client, request/response pipeline  |
| `notifications/` | Notifications Service      | Push notifications, local notifications |
| `permissions/`   | Permissions Service        | Runtime permission management           |
| `storage/`       | Storage Service            | Local persistence (MMKV, SQLite)        |

## Rules

- All native integrations are abstracted behind platform service interfaces.
- Business logic must never directly couple to native APIs.
- Infrastructure services are consumed via dependency injection.
- Must support graceful degradation when hardware is unavailable.
