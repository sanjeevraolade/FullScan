# Technology Stack

## Mobile (`mobile/`)

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Framework | React Native | 0.73+ | Cross-platform mobile app |
| Language | TypeScript | 5.x | Type safety |
| Navigation | React Navigation 6 | 6.x | Stack/tab navigation with deep linking |
| State | Zustand | 4.x | Lightweight global state |
| Server Cache | TanStack React Query | 5.x | API data fetching, caching, retry |
| Local DB | react-native-sqlite-storage | 6.x | Offline evidence queue |
| Location | react-native-geolocation-service | 5.x | High-accuracy GPS |
| Camera | react-native-vision-camera | 3.x | Photo capture with frame processors |
| Biometrics | react-native-biometrics | 3.x | Fingerprint/FaceID |
| Secure Storage | react-native-keychain | 8.x | JWT storage |
| Maps | react-native-maps | 1.x | Assignment location display |
| HTTP | axios | 1.x | API client with interceptors |
| Forms | react-hook-form + zod | - | Form state + validation |
| Crypto | react-native-quick-crypto | - | SHA-256 hashing |
| Image | @shopify/react-native-skia | - | Watermark overlay |
| Date | dayjs | 1.x | Date formatting |
| Testing | Jest + @testing-library/react-native | - | Unit and component tests |

## Server (`server/`)

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Runtime | Node.js | 20 LTS | Server runtime |
| Framework | Express | 4.x | HTTP server and routing |
| Language | TypeScript | 5.x | Type safety |
| Database | better-sqlite3 | 9.x | Synchronous SQLite driver |
| Validation | zod | 3.x | Request validation schemas |
| Auth | jsonwebtoken + bcryptjs | - | JWT + password hashing |
| File Upload | multer | 1.x | Multipart form handling |
| Logging | pino + pino-http | 8.x | Structured JSON logging |
| Security | helmet | 7.x | HTTP security headers |
| Rate Limit | express-rate-limit | 7.x | Brute-force protection |
| Geo | geolib | 3.x | Distance/geo-fence calculation |
| CORS | cors | 2.x | Cross-origin config |
| UUID | uuid | 9.x | Unique identifiers |
| Dev | tsx | - | TypeScript execution + hot reload |
| Testing | vitest + supertest | - | Unit + integration tests |

## Decision Rationale

- **SQLite over PostgreSQL**: No external DB dependency; app is single-tenant; portable for field deployment
- **Zustand over Redux**: Less boilerplate for the amount of global state needed
- **react-native-vision-camera over expo-camera**: Frame processors for real-time watermarking; bare workflow compatibility
- **better-sqlite3 over knex**: Synchronous API is simpler; no ORM overhead for straightforward queries
- **zod over express-validator**: Type inference, composability, shared schemas between validation and TypeScript types
