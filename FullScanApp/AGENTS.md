# FullScanFieldApp

Enterprise field verification app — Field Executives physically verify candidates at their location with tamper-proof GPS, camera, and biometric evidence.

## Architecture

Monorepo with two packages:

| Package | Tech | Purpose |
|---------|------|---------|
| `mobile/` | React Native (bare workflow) | Field Executive app — GPS, camera, biometrics |
| `server/` | Node.js + Express | REST API — assignments, evidence upload, admin |

Data flow: Employer → Backend assigns case → Field Executive receives on mobile → travels to location → collects evidence (photo + GPS + timestamp) → submits report via API.

## Tech Stack

- **Mobile**: React Native, TypeScript, React Navigation, AsyncStorage, SQLite (offline-first local DB)
- **Server**: Node.js, Express, TypeScript, SQLite (via better-sqlite3 or similar)
- **Auth**: JWT-based with biometric unlock on device
- **Location**: react-native-geolocation
- **Camera**: react-native-camera or react-native-vision-camera with watermarking

## Build & Test

```bash
# Mobile
cd mobile
npm install
npx react-native run-ios       # iOS
npx react-native run-android   # Android
npm test                        # Jest unit tests

# Server
cd server
npm install
npm run dev                     # Development with hot reload
npm test                        # Jest/Vitest tests
npm run build                   # TypeScript compilation
```

## Conventions

### Security-First (Critical)
- All photo evidence must include embedded GPS coordinates and timestamp watermark
- GPS coordinates validated server-side against assignment location (geo-fence)
- No sensitive data in AsyncStorage without encryption
- JWT tokens stored in secure keychain, never plain storage
- Camera captures must be tamper-proof (hash + metadata)

### Mobile Patterns
- **UI Library**: `@gluestack-ui/themed` — use for ALL components (never raw RN primitives)
- Offline-first: queue submissions when offline, sync when connected
- All screens require location permission; block usage if denied
- Use TypeScript strict mode
- **NO inline styles** — all styles in `src/theme/`, every style must support light/dark themes
- **Server-driven UI** — screen layouts configured via JSON from server (downloaded after login, cached in SQLite)
- Dynamic component rendering: cards, lists, forms built from JSON config (admin can add/remove fields)
- Components in `src/components/`, dynamic renderers in `src/components/dynamic/`
- Navigation defined centrally in `src/navigation/`

### Server Patterns
- RESTful routes: `/api/v1/<resource>`
- Controllers in `src/controllers/`, services in `src/services/`, middleware in `src/middleware/`
- Input validation on all endpoints (express-validator or zod)
- File uploads via multer with size/type restrictions
- All DB access through a data-access layer, never raw queries in controllers

### General
- TypeScript strict mode in both packages
- ESLint + Prettier for formatting
- Meaningful error messages; never expose internal errors to client
- Environment variables via `.env` files (never committed)
