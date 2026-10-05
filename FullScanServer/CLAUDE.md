# FullScan Server

Node.js + TypeScript (strict) Express backend for the FullScan mobile app, plus the admin and field
executive web front ends. [README.md](README.md) is the full reference — API surface, seed data, test
credentials, portals. Read it before assuming an endpoint or behaviour.

## Stack

Express · MongoDB (official `mongodb` driver, **replica set required** — transactions) · Zod · Pino ·
Helmet/CORS/express-rate-limit · JWT + bcryptjs · Multer (evidence upload) · Vitest + Supertest.
Web front ends: `public/admin/`, `public/fe/` (static ES modules), `web-fe/` and `web-admin/` (React +
Vite, each with its own `package.json`).

## Commands (run from `FullScanServer/`)

```bash
npm run db:dev      # local MongoDB replica set on :27017 (keep running)
npm run dev         # API at http://localhost:3000/api/v1
npm run test:run    # Vitest, single run — uses an in-memory MongoDB, never a real DB
npx tsc --noEmit    # type check (npm run lint is broken: no eslint.config.js)
```

## Request flow (keep it layered)

`routes/` (+ Zod schema in `routes/schemas/`, applied via `middleware/validate`) → `controllers/`
(thin: read req, call service, shape response, `next(err)`) → `services/` (business logic) →
`db/*.dao.ts` (all MongoDB access). Types per resource in `types/`. Errors are thrown as `AppError`
(`utils/app-error.ts`) and rendered by `middleware/error-handler`.

- Responses use `{ success: true, data }`.
- All routes are under `/api/v1`. Auth scopes are isolated: mobile (`authenticate`), FE web
  (`authenticate-fe-web`, cookie `fs_fe_session`), admin (`authenticate-admin`, cookie
  `fs_admin_session`). Never let a token from one scope work on another.
- Mobile tokens are revocable: `authenticate` checks the `sessionVersion` claim against
  `field_executives.mobile_session_version` on every request. Only `auth.service.login()` issues them —
  don't sign mobile tokens anywhere else.
- Mobile `/cases/:caseId` params are **component** ids; admin `/admin/cases/:caseId` are **case** ids.

## Data changes

- Schema (validators + indexes): `src/db/schema.ts`. Data migrations: `src/db/migrations/`, registered
  in `migrations/index.ts`, applied on startup.
- Seed data is `src/db/seed/*.json`, generated from `scripts/sqlite-legacy/` — regenerate with
  `npm run db:generate-seed` rather than hand-editing when the generator owns it.
- Evidence/audit records (mock-location events, uploaded evidence, FE outcome fields) are never
  updated or deleted by admin paths.

## Rules

- TypeScript strict, no `any`, no unchecked assertions in new code.
- Log with the Pino `logger` (`utils/logger.ts`), never `console.log`. Never log passwords, tokens,
  or PII (Aadhaar/PAN, phone numbers).
- Every new or changed endpoint ships with a Supertest suite in `tests/` covering success, validation
  failure, auth/scope failure and not-found.
- A response-shape change is a contract change for `FullScanApp` — update `docs/api-contracts/` and
  the README API table.
