# Architecture

## System Overview

```mermaid
graph TB
    Employer[Employer Dashboard] -->|Creates verification request| API
    API[Express REST API] -->|Assigns case| DB[(SQLite)]
    API -->|Push notification| Mobile
    Mobile[React Native App] -->|Receives assignment| FE[Field Executive]
    FE -->|Travels to location| Location[Candidate Location]
    FE -->|Captures evidence| Mobile
    Mobile -->|Uploads evidence| API
    API -->|Validates geo-fence| GeoService[Geo-fence Service]
    API -->|Verifies hash| HashService[Hash Verification]
    API -->|Stores evidence| Storage[File Storage]
```

## Data Flow

1. **Assignment Creation**: Employer submits verification request → API creates assignment → pushes to assigned Field Executive
2. **Evidence Collection**: Field Executive opens assignment → app verifies GPS is within geo-fence → captures photo with watermark → hashes photo → stores locally
3. **Evidence Submission**: App submits evidence (photo + GPS + hash + timestamp) → API validates geo-fence, hash integrity, and timestamp → stores evidence → marks assignment complete
4. **Offline Flow**: If offline, evidence queued in local SQLite → auto-synced when connectivity returns

## Component Boundaries

### Mobile App
- **Screens**: thin UI layer — renders data, captures user input
- **Hooks**: encapsulate native module access (GPS, camera, biometrics)
- **Services**: business logic (API client, sync queue, evidence processing)
- **Store**: global state (Zustand) — auth status, active assignment, sync state
- **DB**: SQLite for offline data and sync queue

### Server API
- **Routes → Controllers → Services → DAOs**: strict layered architecture
- **Middleware**: cross-cutting concerns (auth, validation, file upload, errors)
- **Services**: all business logic (geo-fence validation, evidence verification)
- **DAOs**: single point of database access

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo | Yes | Shared types, simpler CI, co-located changes |
| Offline-first | SQLite sync queue | Field executives often in low-connectivity areas |
| Evidence integrity | SHA-256 hash + server verify | Prevents photo tampering after capture |
| Geo-fence | Server-side validation | Client GPS can be spoofed |
| Auth | JWT + biometric gate | Balance security with UX |
| Database | SQLite (both) | No external DB dependency, portable |
