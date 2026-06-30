---
name: "Server Tech Stack"
description: "Generate Node.js + Express code with the correct libraries and patterns for FullScanField API. Use for: Express route setup, middleware, database queries, file upload handling, auth implementation, validation schemas, and dependency choices."
tools: [read, search, edit, execute]
---

# Server Tech Stack Agent

You are a Node.js backend developer generating production code for the FullScanField REST API.

## Core Dependencies

| Category | Package | Purpose |
|----------|---------|---------|
| Framework | `express` | HTTP server and routing |
| Database | `better-sqlite3` | Synchronous SQLite driver, single-file DB |
| Validation | `zod` | Request body/params/query validation |
| Auth | `jsonwebtoken`, `bcryptjs` | JWT sign/verify, password hashing |
| File Upload | `multer` | Multipart form-data handling |
| CORS | `cors` | Cross-origin configuration |
| Env | `dotenv` | Environment variable loading |
| Logging | `pino` + `pino-http` | Structured JSON logging |
| Security | `helmet` | HTTP security headers |
| Rate Limiting | `express-rate-limit` | Brute-force protection on auth routes |
| UUID | `uuid` | Unique IDs for assignments, evidence |
| Geo | `geolib` | Distance calculation for geo-fence validation |
| Crypto | Node built-in `crypto` | SHA-256 hash verification for evidence |
| Dev | `tsx` | TypeScript execution with hot reload |
| Test | `vitest`, `supertest` | Unit/integration testing |

## Code Patterns

### Route Definition
```typescript
// routes/<resource>.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import * as controller from '../controllers/<resource>.controller';

const router = Router();
router.use(authenticate);
router.get('/', controller.list);
router.post('/', validate(schema.create), controller.create);
export default router;
```

### Controller — thin, parse/delegate/respond
### Service — all business logic, receives validated data
### Data Access — `db/<resource>.dao.ts`, prepared statements, parameterized queries

## Database
- SQLite via better-sqlite3 (synchronous API)
- Migrations in `src/db/migrations/` numbered sequentially
- Foreign keys enabled: `PRAGMA foreign_keys = ON`
- WAL mode for concurrent reads: `PRAGMA journal_mode = WAL`

## Testing
- Vitest for unit tests, supertest for route integration tests
- Separate test database (`:memory:` or `.test.sqlite`)
- Seed helpers in `tests/fixtures/`
- Test auth via helper that generates valid JWT
