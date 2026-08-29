# FullScanField Server

REST API backend for the FullScan mobile app — serves UI configuration, reference/dropdown
data, field executive profile, and case (assignment) endpoints. Used by [FullScanApp](../FullScanApp)
to mock and develop against a real backend during development.

## Tech stack

| Category   | Choice                              |
| ---------- | ------------------------------------ |
| Runtime    | Node.js + TypeScript (strict)        |
| Framework  | Express                              |
| Database   | SQLite (via `better-sqlite3`), WAL mode |
| Validation | Zod                                  |
| Logging    | Pino (`pino-http` request logging)   |
| Security   | Helmet, CORS, express-rate-limit     |
| Auth deps  | jsonwebtoken, bcryptjs (present, not yet wired up — see below) |
| Testing    | Vitest, Supertest                    |

## Prerequisites

- Node.js 18+ (Node 20+ recommended)
- npm

## Setup

```bash
cd FullScanServer
npm install
cp .env.example .env
```

`.env` variables:

| Variable                  | Purpose                                      | Default                  |
| -------------------------- | --------------------------------------------- | ------------------------- |
| `PORT`                     | HTTP port                                     | `3000`                    |
| `JWT_SECRET`                | Access token signing secret                   | `change-me-in-production` |
| `JWT_REFRESH_SECRET`        | Refresh token signing secret                  | `change-me-refresh-secret`|
| `DB_PATH`                   | SQLite file location                          | `./data/fullscan.sqlite`  |
| `UPLOAD_DIR`                | Directory for uploaded evidence files         | `./uploads`               |
| `GEO_FENCE_RADIUS_METERS`   | Allowed radius for geo-fenced actions          | `200`                     |

Change the JWT secrets before deploying anywhere beyond your own machine.

## Running

**Development** (hot reload via `tsx watch`):

```bash
npm run dev
```

**Production build + run**:

```bash
npm run build   # compiles src/ -> dist/ via tsc
npm start       # runs dist/index.js
```

The server initializes the SQLite database and applies any pending migrations automatically
on startup — no separate migration step is required. Migration files live in
`src/db/migrations/*.sql` and are applied in filename order, tracked in a `migrations` table.

> Note: `package.json` also defines an `npm run migrate` script (`tsx src/db/migrate.ts`), but
> that file doesn't currently exist in `src/db/` — migrations only run via the automatic path
> above (`initDb()` on server start).

Once running, the API is available at `http://localhost:<PORT>/api/v1`.

## Testing & linting

```bash
npm run test       # vitest, watch mode
npm run test:run   # vitest, single run (CI)
npm run lint        # eslint src/
```

## API surface

All routes are mounted under `/api/v1`:

| Route                              | Method | Purpose                                              |
| ----------------------------------- | ------ | ----------------------------------------------------- |
| `/auth/login`                       | POST   | Validate username + password, returns a session token |
| `/ui-config`                        | GET    | Download all screen configs                          |
| `/ui-config/:screenId`              | GET    | Download a single screen config                       |
| `/ui-config/:screenId`              | PUT    | Update a screen config (admin only)                    |
| `/reference-data`                   | GET    | Download dropdown/reference data (post-login)          |
| `/cases`                            | GET    | List cases assigned to the current field executive (auth required) |
| `/cases/:caseId/accept`             | PATCH  | Accept a case (New → Pending/In Progress) (auth required) |
| `/me`                                | GET    | Current field executive's profile (auth required)        |

`POST /auth/login` returns a JWT (`{ token, fieldExecutive }`) only when both the username and
password match a seeded field executive. Send it as `Authorization: Bearer <token>` on `/cases`
and `/me` — this is real credential validation, but device-binding auth (matching a specific
physical device to an account) is still not implemented.

On `GET /cases`, the field executive's actually-assigned components (pending/beyond-TAT/completed) are
stable, but the **New** bucket is a random draw (3–10 components) from the whole 'new' pool on every
request, simulating a live incoming-case feed — accepting a case (`PATCH /cases/:caseId/accept`)
is what actually assigns it to that field executive.

### Case vs. case component

A **case** (`cases`, one row per `Case Ref Number`) is the candidate/client-level record. A case
routinely has several independent **components** (`case_components`) — present address, permanent
address, employment... — each with its own status, dates and bucket. The component, not the case,
is the field executive's actual unit of work: `/cases` returns one row per component, and every
`:caseId` route param is really a component id. `GET /cases/:caseId` returns that component's full
detail plus `siblingComponents` — the rest of its parent case, for context.

Component/action/profile status codes come from `dropdown_options` (categories `component_status`,
`action_status`, `profile_status`), fetched via `/reference-data` like every other dropdown — see
migration `009_create_case_components.sql`.

### Test credentials

The database is seeded with 51 field executives (`fe-001` plus 50 bulk-generated ones), 518 legacy
synthetic cases (18 curated + 500 bulk-generated, see migration
`008_seed_bulk_field_executives_and_cases.sql`, one component each), and 79 real de-identified cases
with 132 components sourced from real case exports across 6 workflow phases — New, Pending, Uploaded,
Completed, Stopped, and Rejected (see migrations `010_seed_real_case_data.sql` and
`011_add_rejected_action_status.sql`, generated by `scripts/generate-real-case-seed.mjs`). Rejected
components go back into the FE's active queue (pending/beyond-TAT), not Completed — see
`TERMINAL_/REWORK_ACTION_STATUS_CODES` in the generator script. Every seeded account shares the same
password:

- Username: `fe001`, `fe002`, … `fe051`
- Password: `Password123!`

## Project layout

```
src/
  app.ts               Express app wiring (middleware, route mounting)
  index.ts              Entry point — loads env, initializes DB, starts the server
  controllers/          Request handlers per resource
  services/              Business logic per resource
  db/                    SQLite connection, DAOs, migrations (*.sql)
  routes/                 Route definitions + Zod request schemas
  middleware/             validate (Zod), error-handler
  types/                  Domain/DTO types per resource
  constants/              Mock session (pre-auth stand-in)
  utils/                  Logger, AppError
```

## Data

SQLite database file lives at `./data/fullscan.sqlite` (git-ignored). Delete it to reset all
data — it will be recreated with migrations applied on next `npm run dev` / `npm start`.
