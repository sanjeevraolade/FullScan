# Design Workflow

## 1. System Overview

FullScanFieldApp is an enterprise field verification system that ensures physical presence at candidate locations with tamper-proof evidence. The system connects Employers (who request verifications), Admins (who manage assignments), and Field Executives (who perform on-site verification).

```mermaid
graph LR
    Employer["Employer"] -->|Submits request| API["Express REST API"]
    Admin["Admin"] -->|Assigns case| API
    API -->|Push notification| Mobile["React Native App"]
    Mobile -->|Field Executive travels| Location["Candidate Location"]
    Mobile -->|Collects evidence| Evidence["Photo + GPS + Hash"]
    Evidence -->|Uploads| API
    API -->|Validates & stores| DB["SQLite + File Storage"]
```

---

## 2. Architecture Workflow

### 2.1 Monorepo Structure

```mermaid
graph TB
    subgraph Monorepo["FullScanFieldApp Monorepo"]
        subgraph Mobile["mobile/ — React Native"]
            Screens["Screens"]
            Components["Components"]
            DynamicUI["Dynamic Renderers"]
            Hooks["Hooks (GPS, Camera, Bio)"]
            MobileServices["Services (API, Sync)"]
            Store["Zustand Store"]
            MobileDB["SQLite (Offline)"]
        end
        subgraph Server["server/ — Node.js + Express"]
            Routes["Routes"]
            Controllers["Controllers"]
            Services["Services"]
            Middleware["Middleware"]
            DAOs["DAOs"]
            ServerDB["SQLite (Persistent)"]
        end
    end
    Mobile -->|REST API calls| Server
```

### 2.2 Layered Architecture (Server)

```mermaid
graph TD
    HTTP["HTTP Request"] --> Middleware["Middleware<br/>(Auth, Validation, Upload)"]
    Middleware --> Routes["Routes"]
    Routes --> Controllers["Controllers<br/>(Parse request, format response)"]
    Controllers --> Services["Services<br/>(Business logic, geo-fence, hash verify)"]
    Services --> DAOs["DAOs<br/>(Database access only)"]
    DAOs --> DB["SQLite Database"]
```

### 2.3 Mobile Component Architecture

```mermaid
graph TD
    Nav["React Navigation"] --> Screens["Screens<br/>(Thin UI layer)"]
    Screens --> DynamicRenderer["DynamicRenderer<br/>(Server-driven UI)"]
    Screens --> Hooks["Custom Hooks<br/>(useLocation, useCamera, useOfflineQueue)"]
    Hooks --> NativeModules["Native Modules<br/>(GPS, Camera, Biometrics)"]
    Screens --> Store["Zustand Store<br/>(Auth, Assignments, Sync state)"]
    DynamicRenderer --> FieldRenderers["Field Renderers<br/>(text, date, status, image, location)"]
    Store --> SQLite["SQLite<br/>(Offline queue, cached configs)"]
```

---

## 3. User Workflows

### 3.1 Employer Workflow

```mermaid
sequenceDiagram
    participant E as Employer
    participant API as Server API
    participant DB as Database

    E->>API: POST /api/v1/assignments (candidate details + location)
    API->>API: Validate input (zod schema)
    API->>DB: Insert assignment (status: pending)
    API-->>E: 201 Created (assignment ID)
    Note over E: Employer can later query reports
    E->>API: GET /api/v1/verifications?employer_id=xxx
    API-->>E: List of completed verification reports
```

### 3.2 Admin Workflow

```mermaid
sequenceDiagram
    participant A as Admin
    participant API as Server API
    participant DB as Database
    participant Push as Push Service

    A->>API: GET /api/v1/assignments?status=pending
    API-->>A: Unassigned verification requests
    A->>API: PUT /api/v1/assignments/:id (assign to field executive)
    API->>DB: Update assignment (assigned_to, status: assigned)
    API->>Push: Notify field executive
    Note over A: Admin configures dynamic UI
    A->>API: PUT /api/v1/ui-config/:screenId (add/remove fields)
    API->>DB: Update config (version incremented)
```

### 3.3 Field Executive Workflow

```mermaid
sequenceDiagram
    participant FE as Field Executive
    participant App as Mobile App
    participant Bio as Biometric
    participant GPS as GPS Module
    participant Cam as Camera
    participant API as Server API

    FE->>App: Open app
    App->>Bio: Request biometric auth
    Bio-->>App: Authenticated
    App->>API: GET /api/v1/ui-config (download screen configs)
    App->>App: Cache configs in SQLite
    App->>API: GET /api/v1/assignments
    API-->>App: Assignment list

    FE->>App: Select assignment
    App->>GPS: Get current location
    GPS-->>App: Coordinates
    App->>App: Check geo-fence (within 200m of target)

    alt Within geo-fence
        FE->>Cam: Capture photo
        Cam-->>App: Photo data
        App->>App: Compute SHA-256 hash
        App->>App: Overlay watermark (GPS + timestamp + case ID)
        App->>App: Store in local SQLite queue

        alt Online
            App->>API: POST /api/v1/evidence (photo + hash + GPS + timestamp)
            API->>API: Validate hash, geo-fence, timestamp
            API-->>App: 201 Evidence accepted
        else Offline
            App->>App: Queue in sync_queue (status: pending)
            Note over App: Auto-sync when connectivity returns
        end
    else Outside geo-fence
        App-->>FE: Error — must be within 200m of assignment location
    end
```

---

## 4. Technical Workflows

### 4.1 Authentication Flow

```mermaid
sequenceDiagram
    participant App as Mobile App
    participant Keychain as Secure Keychain
    participant Bio as Biometric
    participant API as Server API

    Note over App: First login
    App->>API: POST /api/v1/auth/login (email + password)
    API->>API: bcrypt compare (12 rounds)
    API->>API: Generate JWT (15min) + refresh token (7d)
    API-->>App: { accessToken, refreshToken }
    App->>Keychain: Store tokens securely

    Note over App: Subsequent app opens
    App->>Bio: Biometric challenge (FaceID/Fingerprint)
    Bio-->>App: Success
    App->>Keychain: Retrieve access token
    App->>API: Request + Authorization: Bearer <token>

    Note over App: Token expired
    App->>Keychain: Retrieve refresh token
    App->>API: POST /api/v1/auth/refresh
    API-->>App: New access token
    App->>Keychain: Store new access token
```

### 4.2 Evidence Capture & Integrity Chain

```mermaid
flowchart TD
    A["Camera captures photo"] --> B["Compute SHA-256 hash immediately"]
    B --> C["Embed watermark<br/>(GPS + timestamp + case ID)"]
    C --> D["Store locally<br/>(photo + hash + GPS + timestamp)"]
    D --> E{"Network available?"}
    E -->|Yes| F["Upload to server"]
    E -->|No| G["Queue in sync_queue"]
    G -->|Connectivity restored| F
    F --> H["Server re-hashes file"]
    H --> I{"Hash matches?"}
    I -->|No| J["REJECT — tampered"]
    I -->|Yes| K{"GPS within geo-fence?"}
    K -->|No| L["REJECT — outside 200m radius"]
    K -->|Yes| M{"Timestamp within 5min of server?"}
    M -->|No| N["REJECT — timestamp skew"]
    M -->|Yes| O["ACCEPT — store immutably"]
```

### 4.3 Offline Sync Queue Workflow

```mermaid
stateDiagram-v2
    [*] --> Pending: Evidence captured offline
    Pending --> Syncing: Connectivity detected
    Syncing --> Synced: Upload successful
    Syncing --> Failed: Upload error
    Failed --> Pending: Retry (exponential backoff)
    Synced --> [*]

    note right of Pending: Stored in SQLite sync_queue
    note right of Syncing: FIFO processing order
    note right of Failed: Max retries before manual intervention
```

**Sync Queue Table Schema:**
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | Queue entry ID |
| type | TEXT | Operation type (evidence_upload, report_submit) |
| payload | TEXT (JSON) | Serialized request data |
| status | TEXT | pending / syncing / synced / failed |
| retry_count | INTEGER | Number of retry attempts |
| created_at | TEXT | ISO 8601 timestamp |

### 4.4 Server-Driven UI Workflow

```mermaid
sequenceDiagram
    participant Admin as Admin
    participant API as Server API
    participant DB as Database
    participant App as Mobile App
    participant SQLite as Local SQLite

    Note over Admin: Admin customizes screen layout
    Admin->>API: PUT /api/v1/ui-config/assignment-list
    API->>DB: Update config (auto-increment version)
    API-->>Admin: 200 OK (new version)

    Note over App: Field Executive logs in
    App->>API: POST /api/v1/auth/login
    API-->>App: JWT tokens
    App->>API: GET /api/v1/ui-config (all configs)
    API-->>App: Array of screen configs with versions
    App->>SQLite: Cache configs locally

    Note over App: Rendering a screen
    App->>SQLite: Load config for screen ID
    SQLite-->>App: ScreenConfig JSON
    App->>App: DynamicRenderer maps JSON → React components
    App->>App: Each field type → specific FieldRenderer
```

**Dynamic Rendering Pipeline:**

```mermaid
flowchart LR
    Config["ScreenConfig JSON"] --> Renderer["DynamicRenderer"]
    Renderer --> CardType{"Component type?"}
    CardType -->|card| DynamicCard["DynamicCard"]
    CardType -->|list| DynamicList["DynamicList"]
    CardType -->|form| DynamicForm["DynamicForm"]
    CardType -->|detail| DynamicDetail["DynamicDetail"]
    DynamicCard --> Fields["Field Renderers"]
    Fields --> TextField["TextFieldRenderer"]
    Fields --> DateField["DateFieldRenderer"]
    Fields --> StatusField["StatusFieldRenderer"]
    Fields --> LocationField["LocationFieldRenderer"]
    Fields --> ImageField["ImageFieldRenderer"]
```

### 4.5 Geo-Fence Validation Workflow

```mermaid
flowchart TD
    A["Evidence upload received"] --> B["Extract submitted GPS coordinates"]
    B --> C["Fetch assignment from DB"]
    C --> D["Get assignment target coordinates"]
    D --> E["Calculate distance<br/>(Haversine formula via geolib)"]
    E --> F{"Distance ≤ 200m?"}
    F -->|Yes| G["Pass — proceed to hash validation"]
    F -->|No| H["Reject with 422<br/>geo_fence_violation"]
```

---

## 5. Data Flow Architecture

### 5.1 Server Database Schema

```mermaid
erDiagram
    USERS {
        text id PK "UUID"
        text email "unique"
        text password_hash
        text role "field_executive | admin | employer"
        text created_at
        text updated_at
    }
    ASSIGNMENTS {
        text id PK "UUID"
        text employer_id FK
        text assigned_to FK "nullable"
        text candidate_name
        text candidate_address
        real target_latitude
        real target_longitude
        text status "pending | assigned | in_progress | completed | rejected"
        text created_at
        text updated_at
    }
    EVIDENCE {
        text id PK "UUID"
        text assignment_id FK
        text file_path
        text photo_hash "SHA-256"
        real latitude
        real longitude
        text captured_at
        text uploaded_at
        text created_at
    }
    VERIFICATIONS {
        text id PK "UUID"
        text assignment_id FK
        text submitted_by FK
        text observations
        text identity_confirmed "yes | no | inconclusive"
        text created_at
    }
    UI_CONFIGS {
        text screen_id PK
        integer version
        text title
        text components "JSON"
        text created_at
        text updated_at
    }
    REFRESH_TOKENS {
        text id PK
        text user_id FK
        text token_hash
        text expires_at
        text created_at
    }

    USERS ||--o{ ASSIGNMENTS : "assigned_to"
    USERS ||--o{ ASSIGNMENTS : "employer_id"
    ASSIGNMENTS ||--o{ EVIDENCE : "has"
    ASSIGNMENTS ||--|| VERIFICATIONS : "has"
    USERS ||--o{ VERIFICATIONS : "submitted_by"
    USERS ||--o{ REFRESH_TOKENS : "owns"
```

### 5.2 Mobile Local Database Schema

```mermaid
erDiagram
    CACHED_ASSIGNMENTS {
        text id PK
        text candidate_name
        text candidate_address
        real target_latitude
        real target_longitude
        text status
        text cached_at
    }
    EVIDENCE_DRAFTS {
        text id PK
        text assignment_id FK
        text file_path "local file"
        text photo_hash
        real latitude
        real longitude
        text captured_at
    }
    SYNC_QUEUE {
        text id PK "UUID"
        text type "evidence_upload | report_submit"
        text payload "JSON"
        text status "pending | syncing | synced | failed"
        integer retry_count
        text created_at
    }
    UI_CONFIG_CACHE {
        text screen_id PK
        integer version
        text config_json
        text cached_at
    }

    CACHED_ASSIGNMENTS ||--o{ EVIDENCE_DRAFTS : "has"
```

---

## 6. Security Workflow

### 6.1 Threat Mitigation Pipeline

```mermaid
flowchart TD
    subgraph ClientSide["Client-Side Protections"]
        A1["Biometric gate before access"]
        A2["JWT in secure keychain"]
        A3["Certificate pinning (HTTPS)"]
        A4["SHA-256 hash at capture time"]
        A5["No PII in plain storage"]
    end

    subgraph ServerSide["Server-Side Validations"]
        B1["JWT signature + expiry check"]
        B2["Role-based access control"]
        B3["Zod input validation (.strict())"]
        B4["Parameterized SQL queries"]
        B5["Re-hash file → compare with client hash"]
        B6["Geo-fence distance check (200m)"]
        B7["Timestamp skew check (±5min)"]
        B8["Rate limiting (5 req/min/IP for login)"]
        B9["Helmet security headers"]
        B10["File type + magic bytes validation"]
    end

    subgraph Storage["Data Protection"]
        C1["Immutable evidence records"]
        C2["Files outside web root"]
        C3["PII redacted from logs"]
        C4["Generic error messages to client"]
    end

    ClientSide --> ServerSide --> Storage
```

### 6.2 Role-Based Access Matrix

| Resource | Field Executive | Admin | Employer |
|----------|----------------|-------|----------|
| View own assignments | ✅ | ✅ (all) | ❌ |
| Create assignments | ❌ | ✅ | ✅ |
| Upload evidence | ✅ | ❌ | ❌ |
| Submit verification report | ✅ | ❌ | ❌ |
| View reports | Own only | ✅ (all) | Own requests |
| Manage users | ❌ | ✅ | ❌ |
| Configure UI | ❌ | ✅ | ❌ |

---

## 7. Development Workflow

### 7.1 Tech Stack Summary

| Layer | Core Technologies |
|-------|-------------------|
| Mobile UI | React Native 0.73+, @gluestack-ui/themed, React Navigation 6 |
| Mobile State | Zustand, TanStack React Query |
| Mobile Offline | react-native-sqlite-storage, sync queue |
| Mobile Native | react-native-vision-camera, react-native-geolocation-service, react-native-biometrics |
| Mobile Security | react-native-keychain, react-native-quick-crypto |
| Server Runtime | Node.js 20 LTS, Express 4.x, TypeScript 5.x |
| Server DB | better-sqlite3, manual migrations |
| Server Validation | zod (shared type inference) |
| Server Auth | jsonwebtoken, bcryptjs |
| Server Security | helmet, express-rate-limit, cors |
| Server Geo | geolib (Haversine distance) |
| Testing | Jest + @testing-library/react-native (mobile), Vitest + supertest (server) |

### 7.2 Build & Run Pipeline

```mermaid
flowchart LR
    subgraph Dev["Development"]
        A["npm install"] --> B["npm run dev<br/>(tsx hot reload)"]
        C["npx react-native run-ios/android"]
    end
    subgraph Test["Testing"]
        D["npm test<br/>(Jest / Vitest)"]
        E["Integration tests<br/>(supertest)"]
    end
    subgraph Build["Build"]
        F["npm run build<br/>(tsc → dist/)"]
        G["React Native release build"]
    end

    Dev --> Test --> Build
```

### 7.3 Code Conventions

- **TypeScript strict mode** in both packages
- **Naming**: kebab-case files, PascalCase components, camelCase functions, UPPER_SNAKE_CASE constants
- **Imports**: external → internal → relative (path aliases: `@/services`, `@/components`)
- **Styles**: ALL in `src/theme/`, no inline styles, light/dark theme support mandatory
- **Localization**: react-i18next, all user-visible strings localized (en, hi, te)
- **Security**: parameterized queries, zod strict validation, no raw SQL in controllers

---

## 8. API Request/Response Lifecycle

```mermaid
sequenceDiagram
    participant Client as Mobile App
    participant MW as Middleware Stack
    participant Ctrl as Controller
    participant Svc as Service
    participant DAO as DAO
    participant DB as SQLite

    Client->>MW: HTTP Request + Bearer Token
    MW->>MW: 1. helmet (security headers)
    MW->>MW: 2. cors (origin check)
    MW->>MW: 3. rate-limit (throttle)
    MW->>MW: 4. auth (JWT verify + role check)
    MW->>MW: 5. validate (zod schema)
    MW->>Ctrl: Validated request
    Ctrl->>Svc: Delegate business logic
    Svc->>DAO: Database operation
    DAO->>DB: Parameterized query
    DB-->>DAO: Result
    DAO-->>Svc: Typed data
    Svc-->>Ctrl: Business result
    Ctrl-->>Client: { success: true, data: {...} }

    Note over MW: On error at any layer:
    MW-->>Client: { success: false, error: "message" }
```

---

## 9. End-to-End Verification Workflow

```mermaid
flowchart TD
    Start["Employer submits verification request"] --> Assign["Admin assigns to Field Executive"]
    Assign --> Notify["Push notification sent to mobile"]
    Notify --> Login["FE opens app → biometric auth"]
    Login --> Config["Download UI configs + assignment list"]
    Config --> Travel["FE travels to candidate location"]
    Travel --> GeoCheck{"GPS within 200m<br/>of target?"}
    GeoCheck -->|No| Block["Blocked — show error"]
    GeoCheck -->|Yes| Capture["Capture photo"]
    Capture --> Hash["SHA-256 hash computed"]
    Hash --> Watermark["GPS + timestamp watermark embedded"]
    Watermark --> Queue["Store in local queue"]
    Queue --> Net{"Online?"}
    Net -->|Yes| Upload["Upload evidence to server"]
    Net -->|No| Wait["Wait for connectivity"]
    Wait --> Upload
    Upload --> Validate["Server validates:<br/>• Hash integrity<br/>• Geo-fence<br/>• Timestamp"]
    Validate --> Accept{"Valid?"}
    Accept -->|No| Reject["422 — Evidence rejected"]
    Accept -->|Yes| Store["Store evidence immutably"]
    Store --> Report["FE submits verification report"]
    Report --> Complete["Assignment marked complete"]
    Complete --> View["Employer views report + evidence"]
```

---

## 10. Future Architecture Considerations

| Area | Current | Future |
|------|---------|--------|
| Database | SQLite (single-instance) | PostgreSQL (multi-instance) |
| File Storage | Local disk | S3 / Azure Blob Storage |
| Real-time Updates | Polling | WebSocket notifications |
| Push Notifications | FCM/APNs (planned) | Integrated push service |
| Deployment | Single Node.js process | Container orchestration |
| Monitoring | pino logs | Centralized logging + APM |
