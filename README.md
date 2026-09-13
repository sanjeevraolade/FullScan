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

Suites live in `tests/` (config: `vitest.config.ts`). Each suite points `DB_PATH` at its own
throwaway SQLite file via `tests/helpers/test-app.ts`, so tests never touch `./data/`.

> Note: `npm run lint` currently fails — ESLint 9 requires an `eslint.config.js` and the project
> has none. Type safety is covered by `npx tsc --noEmit`.

## API surface

All routes are mounted under `/api/v1`:

| Route                              | Method | Purpose                                              |
| ----------------------------------- | ------ | ----------------------------------------------------- |
| `/auth/login`                       | POST   | Validate username + password, returns a session token |
| `/ui-config`                        | GET    | Download all screen configs                          |
| `/ui-config/:screenId`              | GET    | Download a single screen config                       |
| `/ui-config/:screenId`              | PUT    | Update a screen config (admin only)                    |
| `/reference-data`                   | GET    | Download dropdown/reference data **+ mobile app settings** (post-login) |
| `/cases`                            | GET    | List cases assigned to the current field executive (auth required) |
| `/cases/:caseId/accept`             | PATCH  | Accept a case (New → Pending/In Progress) (auth required) |
| `/me`                                | GET    | Current field executive's profile (auth required)        |
| `/security/mock-location`           | POST   | Record a faked/mocked device location detected by the app (auth required) |
| `/admin/auth/login`                 | POST   | Validate admin credentials, set session cookie + return token |
| `/admin/auth/logout`                | POST   | Clear the admin session cookie (admin auth required)     |
| `/admin/auth/me`                    | GET    | Current admin's profile (admin auth required)            |
| `/admin/mobile-app-settings`        | GET    | Mobile app settings + render metadata (admin auth required) |
| `/admin/mobile-app-settings`        | PUT    | Update mobile app settings (admin auth required)         |
| `/admin/cases`                      | GET    | All case components, filtered/paged, + per-category counts (admin auth required) |
| `/admin/cases`                      | POST   | Create a case and its components (admin auth required)   |
| `/admin/cases/form-options`         | GET    | Status/type vocabularies for the case editor (admin auth required) |
| `/admin/cases/:caseId`              | GET    | One case with all its components (admin auth required)   |
| `/admin/cases/:caseId`              | PUT    | Update a case and upsert its components (admin auth required) |
| `/admin/field-executives`           | GET    | Field executive roster + assignment/detection counts (admin auth required) |
| `/admin/field-executives/:id/history` | GET  | One executive's case-wise history, with mock-location detections (admin auth required) |

`POST /auth/login` returns a JWT (`{ token, fieldExecutive }`) only when both the username and
password match a seeded field executive. Send it as `Authorization: Bearer <token>` on `/cases`
and `/me` — this is real credential validation, but device-binding auth (matching a specific
physical device to an account) is still not implemented.

On `GET /cases`, the field executive's actually-assigned components (pending/beyond-TAT/completed) are
stable, but the **New** bucket is a random draw (3–10 components) from the whole 'new' pool on every
request, simulating a live incoming-case feed — accepting a case (`PATCH /cases/:caseId/accept`)
is what actually assigns it to that field executive.

### Mock-location reports

`POST /security/mock-location` is the app's fraud channel. The mobile app evaluates location
readiness the moment a session exists (and again on every resume, on a manual retry, and before an
evidence capture); when the platform reports the fix as mocked — Android's
`Location.isFromMockProvider()`, iOS 15+'s `isSimulatedBySoftware` — the detection is posted here
with everything the device could observe: the faked coordinates and their accuracy, the detection
stage (`post_login`, `app_resume`, `manual_recheck`, `photo_capture`), the case being worked, and
the handset's identity/brand/manufacturer/installer/emulator flag/time zone. Rows land in
`mock_location_events` (migration `016`) and are never updated or deleted — turning the fake-GPS
app off afterwards does not erase the record.

Blocking is not configurable: a mocked fix always blocks the app and is always reported. The old
`mock_location_block_enabled` setting was removed in migration `017`.

Reports are **idempotent on `clientEventId`**: the app queues a detection it could not send while
offline and retries it under the same id. A first delivery answers `201`; a re-delivery answers
`200` with `isDuplicate: true`, which is the app's signal to drop it from its queue. Every report
also comes back with `totalEventCount` and `firstDetectedAt` for that executive.

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

## Admin Portal

The server also hosts a small back-office web portal at **`http://localhost:<PORT>/admin`** —
dependency-free static HTML/CSS/ES modules under `public/admin/`, served and guarded by Express.
Signing in reveals a navigation drawer with **Cases** and **Field Executive History** under
*Operations* and **Mobile App Settings** under *Configuration*, with **Logout** pinned at the bottom.
Cases is the landing page.

- Pages are protected **server-side**: `/admin/*` runs through `authenticateAdminPage`, which
  redirects an anonymous browser to `/admin/login` before any HTML is sent.
- The access token lives in an **httpOnly, `SameSite=Strict` cookie** (`fs_admin_session`), so
  portal JavaScript never holds it. Admin API routes accept either that cookie or
  `Authorization: Bearer <token>`.
- Admin tokens carry `scope: 'admin'` and are **not interchangeable** with field-executive tokens
  in either direction, even though both are signed with `JWT_SECRET`.
- Adding a drawer page means one entry in `public/admin/assets/js/menu.js` plus one page module —
  see `docs/ADMIN_PORTAL.md` for the full walkthrough.

### Cases

**Cases** lists every case component in the system, grouped by workflow category (New / Pending /
Beyond TAT / Completed) with a live count on each tab, plus search across case reference, candidate,
client and address, and a filter by assigned field executive. Opening a row loads that component's
**parent case** — case-level identity fields plus every component under it — so a candidate's whole
verification record is edited in one place. **New case** opens the same editor empty.

The list is component-level because a component is what carries a category, an assignee and a TAT.
Create/update are case-level: `POST /admin/cases` takes the case and at least one component (a case
with no component would be invisible to the mobile app, which lists components).

`PUT /admin/cases/:caseId` **upserts**: a component entry carrying an `id` updates that component, one
without adds a new one, and components of the case left out of the payload are untouched — a partial
payload must never silently delete the rest of a candidate's verification trail. The field
executive's own outcome columns (`selected_verification_status`, respondent, the status date trail)
are never written by the admin editor: they are the record of what happened on site.

Status codes are validated against `dropdown_options` — the same rows `/reference-data` serves the
app — so the portal can never store a status the device has no label for. Note `:caseId` on the admin
routes is a **case** id, unlike the mobile `/cases/:caseId` routes, where it is a component id.

### Field Executive History

**Field Executive History** answers one back-office question: what has this executive been working
on, and did anything look fraudulent while they did it? Pick an executive (the picker floats those
with detections to the top) and the page shows a summary — cases assigned, detections, handsets
involved, first/last detection — then **one headed table per workflow category**: Pending, Beyond
TAT, Completed. Each table carries its own case and detection counts, one row per case (ref, client,
candidate, component, address, status, TAT). A case with detections gets a chevron: opening it
expands a row underneath with the evidence — when the mock was enabled (device clock) and when it
reached the server, the coordinates the fake provider claimed, the detection stage, and the full
handset identity.

**New cases are not shown.** That bucket is the unclaimed shared pool the app re-draws at random on
every `GET /cases`, so a New row says nothing about what this executive has done — accepting a case
is what claims it, and that moves it to Pending. For the same reason `assignedComponentCount`
excludes New.

Detections reach `mock_location_events` with a `case_id` that is a **component** id, so history joins
on `case_components`. Three cases are handled deliberately: a detection reported without a case (at
login or on resume) is listed under *Detections not tied to a case* rather than dropped; a detection
against a component since reassigned to someone else still appears in this executive's history —
reassigning a case must not hide where a fake fix was reported; and a detection against a *New*
component brings that component back as its own list appended after the standard three, because
excluding noise must never mean hiding evidence.

### Mobile App Settings delivery

Settings saved in the portal reach the mobile app on the **existing** `GET /reference-data` call —
the one post-login batch fetch the app already makes — as an extra `mobileAppSettings` field:

```jsonc
{
  "verificationTypeStatuses": [ /* … unchanged … */ ],
  "mobileAppSettings": {
    "values": { "geo_fence_radius_meters": 200, "locationRetryCount": 3, "watermark_enabled": true },
    "updatedAt": "2026-09-03 15:45:29"
  }
}
```

`values` is keyed by `setting_key` with each value already coerced to its declared type, so a
setting added as a seed row reaches the app with no server or app release. Note `locationRetryCount`
is camelCase — that is the param name the mobile contract specifies, so it is stored and sent
verbatim rather than normalised to snake_case like the keys around it. The admin-facing
`label`/`description` text is deliberately excluded — the app renders user-visible strings from its
own en/hi/te localization keys. On the app side, read settings through
`useMobileAppSettings()` / `getMobileAppSettings()` (see `FullScanApp/src/store/reference-data/`).

### Admin test credentials

Migration `013_create_admin_users.sql` seeds four admins. `admin004` is deliberately deactivated so
the "account disabled" path can be exercised.

| Username   | Name                  | Role          | Active |
| ---------- | --------------------- | ------------- | ------ |
| `admin001` | Ravi Menon            | `super_admin` | yes    |
| `admin002` | Priya Nair            | `admin`       | yes    |
| `admin003` | Sunil Kulkarni        | `admin`       | yes    |
| `admin004` | Deactivated Operator  | `admin`       | no     |

All four share the password `Admin@123!`.

### Test credentials

The database is seeded with 51 field executives (`fe-001` plus 50 bulk-generated ones), 518 legacy
synthetic cases (18 curated + 500 bulk-generated, see migration
`008_seed_bulk_field_executives_and_cases.sql`, one component each), and 79 real de-identified cases
with 132 components sourced from real case exports across 6 workflow phases — New, Pending, Uploaded,
Completed, Stopped, and Rejected (see migrations `010_seed_real_case_data.sql` and
`011_add_rejected_action_status.sql`, generated by `scripts/generate-real-case-seed.mjs`). Rejected
components go back into the FE's active queue (pending/beyond-TAT), not Completed — see
`TERMINAL_/REWORK_ACTION_STATUS_CODES` in the generator script.

For UI layout checks there are also 12 test cases (`case-uitest-001` … `012`, migration
`018_seed_ui_test_cases.sql`, generated by `scripts/generate-ui-test-case-seed.mjs`) with realistic,
moderately long text in every free-text field — up to 50 characters for candidate and father/spouse
names, 60 for employer and client, 150 for address and remarks, 200 for client instructions and FE
notes. 3 are in the New pool; 3 each of Pending, Beyond TAT and Completed are assigned to `fe001`.
The migration deletes and re-inserts every `uitest` case, so re-running it resets them. Their target
coordinates fan out 0.08-5 km around the test area at 17.493971, 78.324914 (the first one sits inside
the 200 m geofence, so a passing check can be exercised); change `TEST_CENTRE` in the generator to
move them.

Migration `019_set_case_locations_hyderabad.sql` then puts every *other* component in Hyderabad,
Telangana: address, location and target coordinates all come from the same one of 16 real localities
(Miyapur, Chanda Nagar, Nizampet, Kukatpally, Gachibowli, Patancheru...), so the text and the map
position agree. It replaces a backlog that mixed Bangalore/Noida/Pune/Nagpur addresses, placeholder
text, 17 blank addresses and 535 blank locations, with coordinates scattered across India or left at
the `0,0` "not geocoded yet" sentinel — those components are no longer geocoded from their address by
the app. Every locality sits within ~13 km of the same centre. Placement is derived from `rowid`, so a
rebuilt database puts each component back at the same address and coordinates.

Every seeded account shares the same password:

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
  middleware/             validate (Zod), error-handler, authenticate, authenticate-admin
  types/                  Domain/DTO types per resource
  constants/              Mock session (pre-auth stand-in)
  utils/                  Logger, AppError, admin session cookie
public/
  admin/                  Admin Portal front end (static HTML/CSS/ES modules)
    assets/js/menu.js     Drawer menu registry — the portal's extension point
    assets/js/pages/      One module per drawer page
tests/                    Vitest + Supertest suites
```

## Data

SQLite database file lives at `./data/fullscan.sqlite` (git-ignored). Delete it to reset all
data — it will be recreated with migrations applied on next `npm run dev` / `npm start`.
