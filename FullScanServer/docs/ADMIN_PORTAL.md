# Admin User Authentication, Portal & Navigation — Implementation Notes

This document describes the Admin User feature added to **FullScanServer**: the database schema and
seed data, the authentication design, the guarded Admin Portal at `/admin`, its navigation drawer,
its pages — Cases, Field Executive History and Mobile App Settings — and how to extend any of it.

It also covers **delivery of those settings to the React Native app** (`FullScanApp`), which rides on
the existing post-login reference-data call — see [§8.5](#85-delivering-settings-to-the-mobile-app).

---

## Table of contents

1. [What was built](#1-what-was-built)
2. [Architecture & where things live](#2-architecture--where-things-live)
3. [Database schema](#3-database-schema)
4. [Authentication design](#4-authentication-design)
5. [API reference](#5-api-reference)
6. [The Admin Portal front end](#6-the-admin-portal-front-end)
7. [Navigation drawer & how to extend it](#7-navigation-drawer--how-to-extend-it)
8. [Mobile App Settings page](#8-mobile-app-settings-page)
   - [8.5 Delivering settings to the mobile app](#85-delivering-settings-to-the-mobile-app)
9. [Cases page](#9-cases-page)
10. [Field Executive History page](#10-field-executive-history-page)
11. [Changes to existing behaviour](#11-changes-to-existing-behaviour)
12. [Testing](#12-testing)
13. [Running it](#13-running-it)
14. [Security posture & known limits](#14-security-posture--known-limits)
15. [Design decisions and the alternatives rejected](#15-design-decisions-and-the-alternatives-rejected)
16. [File manifest](#16-file-manifest)

---

## 1. What was built

| Requirement                                        | Delivered                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Update server/schema for Admin Users               | `admin_users` table (migration `013`), plus `mobile_app_settings` (`014`) and `locationRetryCount` (`015`) |
| Seed admin users for testing                       | 4 admins seeded — 3 active (incl. one `super_admin`), 1 deliberately deactivated                        |
| Admin Login page                                    | `GET /admin/login` — served from `public/admin/login.html`                                              |
| Authenticate against the server                     | `POST /api/v1/admin/auth/login` — bcrypt verify → admin-scoped JWT                                     |
| Handle success and failure                          | Redirect to portal on success; inline, non-enumerating errors on failure; throttling; disabled accounts |
| Protect admin routes/pages                          | `authenticateAdmin` (API, 401) and `authenticateAdminPage` (pages, 302 → login) middleware              |
| Navigation Drawer after login                        | `public/admin/index.html` shell + `assets/js/drawer.js`, docked ≥1024px, off-canvas below               |
| Drawer: Mobile App Settings                          | Data-driven settings page, `assets/js/pages/mobile-app-settings.js`                                     |
| Drawer: Logout at the bottom                         | Pinned in `.drawer__footer`; clears the session cookie and returns to the login page                    |
| Extensible drawer structure                          | Declarative menu registry (`assets/js/menu.js`) + lazily-imported page modules                          |
| Send settings to the mobile app, existing calls only | Added to the existing `GET /reference-data` payload; typed resolver + hooks on the app side              |
| `locationRetryCount` control, validated 3-10         | Seed row in migration `015`; portal renders the bounded input with no front-end change                  |
| `geo_fence_radius_meters` validated 10-2000m         | Bounds tightened in `015`; pre-existing out-of-range values clamped                                     |
| Drawer: Cases, category-wise                         | `assets/js/pages/cases.js` — bucket tabs with live counts, search, assignee filter, paging               |
| Drawer: New Case                                     | Same page's editor, empty — `POST /api/v1/admin/cases` creates the case and its components              |
| Drawer: Update existing Case                         | Same editor, loaded — `PUT /api/v1/admin/cases/:caseId` updates the case and upserts its components     |
| Drawer: Field Executive History, case-wise           | `assets/js/pages/field-executive-history.js` — one headed table per category (no New), detections expanding in place with times and device detail |

**Zero new npm dependencies.** Everything uses packages already in `package.json` — including
`express-rate-limit`, which was previously an unused dependency and is now wired up on admin login.

---

## 2. Architecture & where things live

The feature follows the layering the server already uses. Requests flow strictly downward:

```
route  →  middleware (validate / authenticate)  →  controller  →  service  →  DAO  →  SQLite
```

- **Routes** declare paths and attach validation/auth; no logic.
- **Controllers** unwrap the request, call one service, and shape the `{ success, data }` envelope.
  They never touch the database.
- **Services** own the business rules — credential checking, token issuing, per-setting validation.
  They throw `AppError(status, message)`; the shared `errorHandler` turns that into a JSON response.
- **DAOs** hold SQL and nothing else.
- **Types** live in `src/types/*.types.ts`, with a `*Row` interface for the raw SQLite shape and a
  clean interface for what crosses the API boundary.

The Admin Portal front end is a separate, static concern under `public/admin/`, consuming the same
public HTTP API.

```
                    ┌──────────────────────────────────────────┐
  Browser ─────────▶│ GET /admin/*                             │
                    │   authenticateAdminPage → 302 /admin/login│
                    │   (valid session) → index.html shell      │
                    └──────────────────────────────────────────┘
                                     │ fetch (cookie)
                                     ▼
                    ┌──────────────────────────────────────────┐
                    │ /api/v1/admin/auth/*                     │
                    │ /api/v1/admin/mobile-app-settings        │
                    │ /api/v1/admin/cases                      │
                    │ /api/v1/admin/field-executives           │
                    │   authenticateAdmin → 401                │
                    └──────────────────────────────────────────┘
```

---

## 3. Database schema

### 3.1 `admin_users` — migration `013_create_admin_users.sql`

| Column          | Type    | Notes                                                    |
| --------------- | ------- | -------------------------------------------------------- |
| `id`            | TEXT PK | `admin-001` style, matching the `fe-001` convention      |
| `username`      | TEXT    | unique index `idx_admin_users_username`                  |
| `name`          | TEXT    | display name, shown in the drawer                        |
| `email`         | TEXT    |                                                          |
| `password_hash` | TEXT    | bcrypt, cost 10 — one distinct salt per row              |
| `role`          | TEXT    | `admin` \| `super_admin`                                 |
| `is_active`     | INTEGER | `1`/`0` — SQLite has no boolean                          |
| `last_login_at` | TEXT    | stamped on every successful sign-in                      |
| `created_at`    | TEXT    | `datetime('now')` default, as elsewhere in this schema   |
| `updated_at`    | TEXT    | `datetime('now')` default                                |

**Admins are a separate table from `field_executives`, not a `role` column on it.** They are a
different kind of principal: an admin has no device binding, owns no cases, appears in no assignment
query, and holds a token that must not open mobile endpoints. Folding them into
`field_executives` would have meant nullable device columns, an `is_admin` filter on every existing
case/assignment query, and a real risk of an admin row leaking into field-executive results.

### 3.2 `mobile_app_settings` — migration `014_create_mobile_app_settings.sql`

A **typed key/value table** rather than one column per setting:

| Column          | Type    | Notes                                                            |
| --------------- | ------- | ---------------------------------------------------------------- |
| `setting_key`   | TEXT PK | e.g. `geo_fence_radius_meters`                                   |
| `setting_value` | TEXT    | always TEXT; coerced to the declared type on read                |
| `value_type`    | TEXT    | `boolean` \| `number` \| `string` \| `enum` (CHECK-constrained)  |
| `label`         | TEXT    | shown in the portal form                                         |
| `description`   | TEXT    | helper text under the label                                      |
| `category`      | TEXT    | `general` \| `security` \| `evidence` \| `sync` — one card each   |
| `options_json`  | TEXT    | for `enum`: JSON array of allowed values                         |
| `min_value`     | REAL    | for `number`: inclusive lower bound                              |
| `max_value`     | REAL    | for `number`: inclusive upper bound                              |
| `sort_order`    | INTEGER | order within its category                                        |
| `updated_at`    | TEXT    | stamped on write                                                 |
| `updated_by`    | TEXT    | FK → `admin_users(id)` — audit trail of who changed what          |

Why key/value: the row carries its own presentation and validation metadata, so **the portal renders
its entire form from the API response** and the service validates from the same rows. Adding a new
mobile setting is one `INSERT` in a new migration — no server code, no portal code, no types.

18 settings are seeded across the four categories, chosen to match real FullScan domain concerns:
geo-fence radius, location retry count, watermarking, photo compression/size, mock-location blocking,
biometric login, session timeout, sync interval and Wi-Fi-only sync, offline retry limit, minimum app
version and force-update, default language (`en`/`hi`/`te`), support number, and maintenance mode.

These settings are delivered to the mobile app on the existing post-login reference-data call — see
[§8.5](#85-delivering-settings-to-the-mobile-app).

### 3.3 `locationRetryCount` and the tightened geo-fence — migration `015`

Migration `015_add_location_retry_and_tighten_geofence.sql`:

| Setting                    | Change                                          | Range          |
| -------------------------- | ----------------------------------------------- | -------------- |
| `locationRetryCount`       | **New.** GPS fix re-attempts per capture; default `3` | `3` – `10`  |
| `geo_fence_radius_meters`  | Bounds tightened from `25`–`5000`                | `10` – `2000`  |

Two things worth knowing about it:

**The key is camelCase.** `locationRetryCount`, not `location_retry_count`, unlike every key around
it. `setting_key` is what goes on the wire to the app, and the mobile contract names the param
`locationRetryCount`, so it is stored verbatim rather than normalised. The app's
`MOBILE_APP_SETTING_KEYS.locationRetryCount` maps to that exact string, and a test asserts the
snake_case spelling does **not** resolve.

**Existing out-of-range values are clamped.** The old geo-fence bounds were wider, so a database
written before `015` can hold a radius (say `4500`) that the admin form would now refuse to save.
The migration pulls any such value to the nearest legal one, so the app is never served a
configuration the portal itself considers invalid. Covered by `tests/mobile-app-settings-migration.test.ts`,
which stages the upgrade on a scratch database rather than trusting the seed defaults.

**No portal code changed for this.** The Mobile App Settings page renders its inputs from each row's
`value_type`/`min_value`/`max_value`, so the new setting appears automatically as a numeric field
bounded to 3–10, with an "Allowed range: 3 to 10" hint — which is exactly the payoff of the
data-driven design in [§3.2](#32-mobile_app_settings--migration-014_create_mobile_app_settingssql).

### 3.4 Migrations

`initDb()` applies pending `src/db/migrations/*.sql` in filename order on startup and records them in
the `migrations` table, so the new migrations apply automatically on the next `npm run dev` /
`npm start`. No manual step. `npm run build` copies the `.sql` files into `dist/`.

---

## 4. Authentication design

### 4.1 Sign-in

`POST /api/v1/admin/auth/login` → `adminAuthService.loginAdmin()`:

1. Look up the row by username.
2. `bcrypt.compareSync` the password. **When the username does not exist, the comparison still runs
   against a dummy hash** — a missing account costs the same time as a wrong password, so the
   endpoint cannot be used to enumerate valid usernames. Both cases return the same
   `401 Invalid username or password`.
3. A row with `is_active = 0` gets a distinct `403` ("account has been deactivated") — a different
   outcome on purpose, because at that point the caller has already proven they hold valid
   credentials, and telling them to contact an admin is more useful than a generic failure.
4. Sign a JWT: `{ adminUserId, username, role, scope: 'admin' }`, 8-hour expiry (shorter than the
   mobile app's 12h field-executive token).
5. Stamp `last_login_at`.
6. Set the session cookie **and** return the token in the response body.

### 4.2 Token scope isolation

Admin and field-executive tokens are signed with the same `JWT_SECRET`, so a valid signature proves
nothing about *which* API the bearer may use. Both directions are closed:

- `verifyAdminToken()` requires `scope === 'admin'` **and** a present `adminUserId`, so a
  field-executive token is rejected on admin routes.
- `authenticate` (the existing mobile middleware) now requires a `fieldExecutiveId` claim, so an
  admin token is rejected on mobile routes. See [§11](#11-changes-to-existing-behaviour).

`verifyAdminToken()` also **re-reads the admin row on every request** and rejects the token if the
account has been deleted or deactivated since it was issued. An admin disabled mid-session loses
access immediately rather than at token expiry — the cost is one indexed primary-key lookup per
request.

### 4.3 Session transport: httpOnly cookie

`POST /auth/login` sets:

```
fs_admin_session=<jwt>; Path=/; Max-Age=28800; HttpOnly; SameSite=Strict[; Secure]
```

- **`HttpOnly`** — portal JavaScript cannot read the token, so an XSS bug in the portal has no
  session to exfiltrate. The portal genuinely never holds the token: `login.js` gets a `200` and
  navigates, nothing more.
- **`SameSite=Strict`** — a cross-site request never carries the cookie, which is what protects the
  cookie-authenticated `PUT` endpoint from CSRF.
- **`Secure`** is added only when `NODE_ENV === 'production'`, so the portal still works over plain
  `http://localhost` in development.
- Cookie parsing and serialization are hand-rolled in `src/utils/admin-session-cookie.ts` — one
  cookie and two operations did not justify adding `cookie-parser`.

Admin API middleware accepts **either** the cookie **or** `Authorization: Bearer <token>`, so curl,
Postman and the test suite work without cookie handling while the browser uses the safer path.

### 4.4 Route protection — two guards, two behaviours

Both live in `src/middleware/authenticate-admin.ts` and share one token-extraction helper.

| Guard                    | Applied to                                    | No/invalid session                                     |
| ------------------------ | --------------------------------------------- | ------------------------------------------------------ |
| `authenticateAdmin`      | `/api/v1/admin/*` (except `/auth/login`)      | `401` JSON, so the portal's fetch layer can react      |
| `authenticateAdminPage`  | every `/admin/*` page route                   | `302` → `/admin/login?next=<original-url>`             |

Page protection is **server-side**: an anonymous `GET /admin` is redirected before any HTML is sent,
so the shell markup never reaches an unauthenticated browser (there is a test asserting exactly
that). Client-side guarding alone would have shipped the page and hidden it with JavaScript.

Portal HTML is served with `Cache-Control: no-store, must-revalidate` so a signed-out browser cannot
re-serve the shell from cache.

### 4.5 Brute-force throttling

`express-rate-limit` on the login route: **10 attempts per IP per 15 minutes**, with
`skipSuccessfulRequests: true` so only failures count against an admin. Exceeding it returns `429`
in the same `{ success: false, error }` envelope as every other error, so the portal displays it
like any other message.

### 4.6 Logout

`POST /api/v1/admin/auth/logout` expires the cookie (`Max-Age=0`) and logs the event. JWTs are
stateless, so a *Bearer* holder keeps its token until it expires — the portal, which only ever uses
the cookie, is fully signed out. A server-side denylist is the fix if immediate global revocation is
ever needed; `verifyAdminToken`'s active-account check already covers the important case
(deactivating a compromised account kills its sessions at once).

---

## 5. API reference

All admin endpoints answer with the server's standard envelope: `{ success: true, data }` or
`{ success: false, error }` (plus `details` for Zod validation failures).

### `POST /api/v1/admin/auth/login`

Public. Rate-limited.

```jsonc
// request
{ "username": "admin001", "password": "Admin@123!" }

// 200
{
  "success": true,
  "data": {
    "token": "eyJhbGciOi...",
    "expiresInSeconds": 28800,
    "adminUser": {
      "id": "admin-001",
      "username": "admin001",
      "name": "Ravi Menon",
      "email": "ravi.menon@fullscan.test",
      "role": "super_admin",
      "lastLoginAt": "2026-09-03 13:56:27"
    }
  }
}
```

| Status | Cause                                              |
| ------ | -------------------------------------------------- |
| `400`  | Zod validation failed (missing/oversized fields)   |
| `401`  | Unknown username **or** wrong password             |
| `403`  | Correct credentials, account deactivated           |
| `429`  | Too many failed attempts from this IP              |

`password_hash` never appears in any response.

### `POST /api/v1/admin/auth/logout`

Requires admin auth. Returns `{ signedOut: true }` and expires the cookie.

### `GET /api/v1/admin/auth/me`

Requires admin auth. Returns the `adminUser` object above.

### `GET /api/v1/admin/mobile-app-settings`

Requires admin auth. Returns every setting with its render metadata, ordered by category then
`sort_order`:

```jsonc
{
  "success": true,
  "data": [
    {
      "key": "geo_fence_radius_meters",
      "value": 200,                 // coerced to the declared type
      "valueType": "number",
      "label": "Geo-fence radius (metres)",
      "description": "How far from the assignment address a capture is still accepted.",
      "category": "evidence",
      "options": null,              // string[] for enum settings
      "minValue": 25,
      "maxValue": 5000,
      "updatedAt": "2026-09-03 13:56:31",
      "updatedBy": "admin-001"
    }
  ]
}
```

### `PUT /api/v1/admin/mobile-app-settings`

Requires admin auth. Send **only the changed settings**; returns the full updated set.

```jsonc
{ "settings": [ { "key": "geo_fence_radius_meters", "value": 350 },
                { "key": "sync_on_wifi_only", "value": true } ] }
```

Validation happens in two stages:

1. **Shape** (Zod, `admin.schema.ts`) — 1–100 entries, each `{ key, value }` where value is a
   boolean, number, or string ≤500 chars.
2. **Semantics** (`mobile-app-setting.service.ts`) — every value is checked against *its own row's*
   metadata: declared type, `min_value`/`max_value`, allowed enum options, string length. Strings are
   trimmed. Unknown keys and duplicate keys in one batch are rejected.

Errors name the offending setting by its human label, e.g.
`"Geo-fence radius (metres)" must be at least 25`.

**The write is atomic.** All values are validated before anything is written, and the write itself
runs inside a `better-sqlite3` transaction — one bad entry rejects the whole batch and changes
nothing, so the mobile app can never read a half-applied configuration. There is a test for this.

### `GET /api/v1/admin/cases`

Requires admin auth. Every case component, filtered and paged.

Query: `bucket` (`new` | `pending` | `beyond_tat` | `completed`), `search` (case ref, candidate,
client or address), `fieldExecutiveId`, `limit` (1–200, default 25), `offset`.

```jsonc
{
  "items": [
    {
      "id": "comp-uitest-001",            // case component id — the mobile app's unit of work
      "caseId": "case-uitest-001",        // parent case; what the editor loads
      "caseRef": "UITEST-QUATH00009001",
      "clientName": "…", "candidateName": "…",
      "bucket": "new", "verificationType": "Present Address Verification",
      "addressType": "present", "address": "…",
      "componentStatus": "new_component", "actionStatus": null, "profileStatus": "bgv_profile_created",
      "assignedFieldExecutiveId": null, "assignedFieldExecutiveName": null, "assignedToName": "…",
      "tatDueAt": "2026-08-27 18:00:00", "updatedAt": "2026-09-12 09:30:22"
    }
  ],
  "total": 662,                            // matches the filter, bucket included
  "categories": [                          // counts ignore the bucket filter, so tabs stay stable
    { "bucket": "new", "count": 255 }, { "bucket": "pending", "count": 130 },
    { "bucket": "beyond_tat", "count": 164 }, { "bucket": "completed", "count": 113 }
  ],
  "limit": 25, "offset": 0
}
```

Every bucket appears in `categories` even at zero, so a tab never vanishes.

### `GET /api/v1/admin/cases/form-options`

Requires admin auth. The vocabularies the editor's selects are built from: `buckets`, `addressTypes`
and `residenceTypes` (mirroring the `case_components` CHECK constraints), plus `componentStatuses`,
`actionStatuses` and `profileStatuses` as `{ code, label }` from `dropdown_options`.

### `GET /api/v1/admin/cases/:caseId`

Requires admin auth. One case with every component beneath it. **`:caseId` is a case id here**,
unlike the mobile `/api/v1/cases/:caseId` routes, where it is a component id.

### `POST /api/v1/admin/cases`

Requires admin auth. Creates a case and its components; answers `201` with the created case.

```jsonc
{
  "caseRef": "FS-2026-00500", "clientName": "Acme Corp", "candidateName": "Rahul Sharma",
  "fatherOrSpouseName": "…", "employerName": "…",
  "primaryContactNumber": "…", "secondaryContactNumber": "…",
  "profileStatus": "bgv_profile_created",
  "components": [                         // at least one, at most 20
    {
      "bucket": "new", "componentStatus": "new_component", "actionStatus": null,
      "verificationType": "Address", "addressType": "present", "residenceType": "rented",
      "address": "Flat 204, Green Heights, Madhapur, Hyderabad", "location": "Madhapur",
      "assignedFieldExecutiveId": "fe-001", "tatDueAt": "2026-10-01 18:00:00",
      "targetLatitude": 17.4483, "targetLongitude": 78.3915,
      "maskedPrimaryPhone": "+91-9XXXXX0001", "clientInstructions": "…"
    }
  ]
}
```

### `PUT /api/v1/admin/cases/:caseId`

Requires admin auth. Same body. **Upserts**: a component entry carrying an `id` updates that
component, one without adds a new one, and components of the case left out of the payload are
untouched. Returns the full updated case.

Both writes run in one SQLite transaction, and both validate status codes against `dropdown_options`
and assignees against `field_executives` — see [§9.4](#94-what-the-server-enforces).

### `GET /api/v1/admin/field-executives`

Requires admin auth. The roster — `id`, `name`, `email`, `role`, `username`, `isDeviceBound`,
`assignedComponentCount`, `mockLocationEventCount`, `lastMockLocationDetectedAt` — ordered with
detections first. Optional `search` over name, username and email. Never carries a password hash.

### `GET /api/v1/admin/field-executives/:fieldExecutiveId/history`

Requires admin auth. One executive's case-wise history.

```jsonc
{
  "fieldExecutive": { /* the roster entry above */ },
  "summary": {
    "assignedComponentCount": 10, "mockLocationEventCount": 5,
    "firstDetectedAt": "2026-09-12T13:08:24.214Z", "lastDetectedAt": "2026-09-12T14:51:40.062Z",
    "distinctDeviceCount": 1
  },
  "caseGroups": [                          // always Pending, Beyond TAT, Completed — never New
    {
      "bucket": "pending",
      "caseCount": 4,
      "mockLocationEventCount": 1,
      "cases": [
        {
          "componentId": "…", "caseId": "…", "caseRef": "…", "candidateName": "…", "clientName": "…",
          "verificationType": "…", "addressType": "present", "address": "…",
          "bucket": "pending", "componentStatus": "…", "actionStatus": null,
          "tatDueAt": "…", "updatedAt": "…",
          "mockLocationEvents": [
            {
              "id": "…", "detectionStage": "photo_capture",
              "detectedAt": "2026-09-06T10:15:00.000Z",   // device clock — "mock enabled at"
              "reportedAt": "2026-09-06 10:15:03",        // server clock; a gap means it was queued offline
              "latitude": 17.4452, "longitude": 78.3821, "accuracyMeters": 8,
              "fixCapturedAt": "…", "fixSource": "fresh",
              "device": { "deviceId": "…", "model": "Pixel 7", "manufacturer": "Google",
                          "osName": "Android", "osVersion": "14", "appVersion": "1.4.2",
                          "isEmulator": false, "timeZone": "Asia/Kolkata" /* … */ }
            }
          ]
        }
      ]
    },
    { "bucket": "beyond_tat", "caseCount": 0, "mockLocationEventCount": 0, "cases": [] },
    { "bucket": "completed",  "caseCount": 6, "mockLocationEventCount": 0, "cases": [ /* … */ ] }
  ],
  "unlinkedMockLocationEvents": [ /* detections with no case — see §10.3 */ ]
}
```

Within each group, cases with detections sort first. The three standard groups are always present,
even when empty; a fourth `new` group is appended only in the one case described in
[§10.3](#103-three-cases-handled-deliberately). `404` when the executive does not exist.

---

## 6. The Admin Portal front end

`public/admin/` — static HTML, one stylesheet, and native ES modules. No build step, no bundler, no
framework, nothing to install.

```
public/admin/
  login.html                         Login page
  index.html                         Authenticated app shell (drawer + topbar + outlet)
  assets/
    css/admin.css                    All styling; design tokens as CSS custom properties
    js/
      api.js                         fetch wrapper: envelope unwrapping, ApiError, 401 → login
      dom.js                         escapeHtml, renderAlert, formatTimestamp
      icons.js                       inline SVG icon set, referenced by name
      menu.js                        ★ drawer menu registry — the extension point
      drawer.js                      drawer rendering, open/close, responsive, logout
      router.js                      hash router over the registry, lazy page imports
      app.js                         shell bootstrap
      login.js                       login form controller
      pages/
        mobile-app-settings.js       the Mobile App Settings page
```

Notes on the front end:

- **Styling** uses CSS custom properties, with a light and a `prefers-color-scheme: dark` palette.
  The brand primary is `#0077E6` — the same `primary500` the mobile app's Theme Engine resolves from
  the Gluestack palette, so the two surfaces read as one product.
- **CSP.** `/admin` gets a portal-scoped `Content-Security-Policy` (`default-src 'self'`,
  `frame-ancestors 'none'`, `object-src 'none'`) replacing helmet's app-wide default. Consequently
  the portal contains **no inline `<script>` and no inline `style` attributes** anywhere — that is a
  constraint to preserve when editing it. `upgrade-insecure-requests` is deliberately omitted; it
  breaks the portal when the dev server is reached over plain http on a LAN address.
- **Escaping.** Setting labels, descriptions and values are admin-authored data rendered through
  `innerHTML` templates, so every interpolation goes through `escapeHtml()` (unit-tested, including
  both quote styles).
- **Open-redirect safety.** `?next=` is honoured only when it is a same-origin path starting with
  `/admin` and not `//`; anything else falls back to `/admin`.
- **Accessibility.** Skip link; `aria-current="page"` on the active drawer item; `aria-expanded` on
  the toggle; `inert` on the off-canvas drawer so hidden links leave the tab order; Escape closes
  the drawer and returns focus to the toggle; `prefers-reduced-motion` disables transitions; labels
  are bound to every control.
- **Responsive.** Drawer is permanently docked at ≥1024px and off-canvas with a scrim below that,
  where following a link also closes it. Setting rows collapse to one column at ≤640px.

---

## 7. Navigation drawer & how to extend it

The drawer is rendered from a **declarative registry**, not from markup. `index.html` ships an empty
`<div data-drawer-nav>`; `app.js` groups the role's visible `menu.js` entries and hands them to
`drawer.js`, which fills it.

`drawer.js` and `router.js` are generic: they do not import `menu.js` or know about admin roles.
Each portal's `app.js` passes in its account block, menu sections, route lookup, default route, app
name and page context. The Field Executive web portal (`/fe`) reuses both modules with its own menu,
see [`field-executive-web-login.md`](./field-executive-web-login.md). A change to either module
affects both portals.

### Registry entry shape

```js
{
  id: 'mobile-app-settings',        // unique key
  route: 'mobile-app-settings',     // URL hash → #/mobile-app-settings
  label: 'Mobile App Settings',     // drawer text
  icon: 'sliders',                  // name from icons.js
  title: 'Mobile App Settings',     // topbar + page heading
  subtitle: '…',                    // optional line under the heading
  section: 'Operations',            // optional drawer group label
  roles: ['super_admin'],           // optional role gate; omit = visible to all
  loadPage: () => import('./pages/mobile-app-settings.js'),
}
```

### Adding a page — the whole procedure

1. Create `public/admin/assets/js/pages/my-page.js`:

   ```js
   export async function render(container, { adminUser, setStatus }) {
     container.innerHTML = '<p>Hello</p>';
     // setStatus({ variant: 'success' | 'error', message }) shows the page-level alert
   }

   export function destroy() {
     // optional: release anything render() set up
   }
   ```

2. Append one entry to `ADMIN_MENU` in `menu.js`.
3. If you need a new icon, add its SVG paths to `ICON_PATHS` in `icons.js`.

Nothing else changes — no HTML, no CSS, no route registration, no server change. `menu.js` carries a
commented-out example entry to copy.

### What the router does

- `#/<route>` → registry lookup → **lazy `import()`** of the page module, cached after first visit,
  so an unvisited page costs nothing.
- The previous page's `destroy()` runs before the next `render()`.
- A render token guards against out-of-order async renders when links are clicked quickly.
- Unknown or role-denied routes fall back to `DEFAULT_ROUTE` rather than showing a blank screen.
- Sets `document.title`, the topbar title, the page header, and `aria-current` on the drawer link.

### Role-gated menu items

`roles` on an entry hides it from other roles, and the router refuses to render it — but note this is
**presentation only**. A role-restricted page whose API endpoints must also be restricted needs a
server-side role check too; `req.adminRole` is populated by `authenticateAdmin` for exactly that.

### Logout

Pinned in `.drawer__footer`, below the scrolling menu list, so it stays at the bottom regardless of
how many items are added. It calls `POST /auth/logout`, then navigates to `/admin/login` —
and navigates even if the call fails, since leaving the portal is still the right outcome.

---

## 8. Mobile App Settings page

The drawer's one page today, and a demonstration of the data-driven pattern.

- Fetches `GET /mobile-app-settings` and renders **one card per category** (General, Security,
  Evidence Capture, Synchronization), each row built from the setting's metadata:
  `boolean` → checkbox with Enabled/Disabled text, `enum` → `<select>` of its options, `number` →
  numeric input with `min`/`max` and an "Allowed range" hint, `string` → text input.
- A category with no title mapping still renders, using a humanised version of its key — so a new
  category in a migration cannot break the page.
- Shows each setting's "Last changed" timestamp, formatted from SQLite's UTC `datetime('now')`.
- **Dirty tracking** against a baseline snapshot: a live count of unsaved changes, with Save and
  Discard disabled until something actually differs.
- **Only changed settings are sent.** The server's validated response becomes the new baseline.
- Server-side validation errors surface in the page alert naming the offending setting; a cleared
  numeric field is caught client-side before any request.
- All listeners are **delegated on the page container**, because saving replaces the form markup
  wholesale.

### 8.5 Delivering settings to the mobile app

Settings would be inert if the app never saw them. They are delivered on the **existing**
`GET /api/v1/master-data` call (served at `/reference-data` until the enhance-login change) — the
single post-login batch fetch the app already makes
(`fetchReferenceData()` in `use-login-form.ts` and `use-biometric-login.ts`) — as one extra field:

```jsonc
{
  "verificationTypeStatuses": [ /* … all seven dropdown lists, unchanged … */ ],
  "mobileAppSettings": {
    "values": {
      "geo_fence_radius_meters": 200,   // number
      "locationRetryCount": 3,          // number
      "watermark_enabled": true,        // boolean
      "default_language": "en"          // string
    },
    "updatedAt": "2026-09-03 15:45:29"
  }
}
```

> Since the master-data-sync change, the payload also carries a top-level `updatedAt` (the
> master-data version), and the app re-fetches it only when login's `masterDataUpdatedAt` differs
> from its cached copy — see the README's *Master data version* section.

**Why this endpoint and not a new one.** `/master-data` is already the login-time configuration
batch, it needs no extra round trip, it is re-fetched on every login (including biometric), and one
call means one failure mode. `reference-data.service.ts` reuses `getAllMobileAppSettings()` rather
than re-reading the DAO, so type coercion lives in exactly one place.

**What is deliberately *not* sent.** The portal-only presentation metadata — `label`, `description`,
`minValue`/`maxValue`, `options`, `updatedBy`. `label` and `description` are admin-facing **English**;
the mobile app renders user-visible text from its own en/hi/te localization keys, and shipping server
English to the app would invite a violation of that rule. A test asserts the payload contains only
`values` and `updatedAt`.

**Open key/value map, not a fixed schema.** `values` is keyed by `setting_key`, so a setting added as
a seed row reaches the app without a server or app release.

#### Mobile app side (`FullScanApp`)

| File                                                     | Purpose                                                              |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/domain/reference-data/reference-data.entity.ts`      | `MobileAppSettings`, `MobileAppSettingValue`, and the new field       |
| `src/domain/reference-data/mobile-app-settings.ts`        | Setting keys, safe defaults, accepted ranges, typed resolver          |
| `src/store/reference-data/use-mobile-app-settings.ts`     | `useMobileAppSettings()` hook + non-React `getMobileAppSettings()`    |
| `src/store/reference-data/reference-data.store.ts`        | Logs the setting count / `updatedAt` when the payload lands           |

The repository (`reference-data-repository.ts`) needed **no change at all** — it already returns the
whole payload, which is the point of reusing the existing call.

`resolveMobileAppSettings()` turns the open map into a fully typed `ResolvedMobileAppSettings`:

```ts
const { geoFenceRadiusMeters, locationRetryCount } = useMobileAppSettings();
```

Four properties matter here:

1. **Defaults, not nulls.** Before the first fetch — and offline on a cold start — the hook returns
   `DEFAULT_MOBILE_APP_SETTINGS`, which mirrors the seeded server values with the security-relevant
   ones erring strict (watermarking on, mock-location blocking on, maintenance mode off). Callers
   never null-check an individual setting, which keeps the app usable offline as the architecture
   requires.
2. **Per-setting tolerance.** Each value is validated independently: a boolean arriving as `'true'`
   is honoured, a numeric string is parsed, and anything malformed (`NaN`, `Infinity`, a blank
   string, an unsupported language) falls back to that one default instead of discarding the payload.
3. **Range validation mirrors the server.** `MOBILE_APP_SETTING_RANGES` restates each numeric
   setting's `min_value`/`max_value` — `geoFenceRadiusMeters` 10–2000, `locationRetryCount` 3–10, and
   so on. It is duplicated deliberately: the mobile payload carries only values, not the portal's
   min/max metadata, so the app cannot learn the bounds at runtime. An out-of-range value is treated
   like any other malformed one and falls back to its default, which matters most for a **stale row**
   — a `5000`-metre radius saved under the pre-`015` bounds must not silently widen geo-fencing on a
   device that has not re-fetched. A test asserts every default sits inside its own declared range,
   so the two cannot drift into an unusable combination.
4. **Forward compatibility.** Unknown keys survive on `resolved.values`, so a setting the back office
   adds after this release is still reachable without an app update.

Settings live in the existing reference-data store, so they follow reference data's lifecycle exactly
— set on login, cleared on logout by `app-drawer-content.tsx`. They are **in-memory only**, which
matches how reference data already behaves; persisting either across a cold start is a separate,
pre-existing gap (no MMKV wrapper exists yet) and was left alone deliberately.

> Note: this delivers and exposes the settings. **Applying** them — making the location fix loop read
> `locationRetryCount`, the camera read `photoCompressionQuality`, the sync queue read
> `syncIntervalMinutes` — is a separate change per feature, and several of those features are not
> built yet.

---

## 9. Cases page

`assets/js/pages/cases.js` — the portal's landing page, and the answer to "show all the cases,
category-wise", "new case" and "update existing case".

### 9.1 Why the list is component-level and the editor is case-level

A **case** (one Case Ref Number) is the candidate/client record. It routinely holds several
independent **components** — present address, permanent address, employment — and the *component* is
what carries a workflow category (bucket), an assignee, a TAT and a status trail. The mobile app
already works component-by-component for exactly that reason.

So the list shows components (anything else could not be grouped by category at all), while create
and update work on the whole case: opening a row loads that component's **parent case** with every
component under it, so a candidate's verification record is edited in one place rather than one
fragment at a time.

### 9.2 The list

- **Category tabs** — All / New / Pending / Beyond TAT / Completed, each with a live count.
  The counts come from `categories` in the response and are computed *ignoring* the bucket filter, so
  switching tabs never changes the numbers on the tabs.
- **Search** across case reference, candidate, client and address, debounced 300 ms. The caret is
  captured and restored across the re-render, so a reload mid-typing does not steal focus.
- **Assignee filter** over the field executive roster, which the page already loads for the editor.
- **Paging** at 25 rows, with an `x–y of N` status.
- Rows are keyboard reachable (`tabindex="0"`, Enter opens) as well as clickable.

### 9.3 The editor

One form for both create and update; the only difference is whether a case was loaded into it.

- **Case card** — reference, client, candidate, father/spouse, employer, both contact numbers and
  profile status (a `<select>` built from `dropdown_options`).
- **One card per component** — category, component status, action status, verification type, address
  type, residence type, address, locality, assignee (roster `<select>`) or free-text assignee name,
  TAT, target coordinates, both masked phone numbers, client instructions, field executive notes and
  remarks.
- **Add component** appends a blank card; a component that has not been saved yet can be removed
  again. An existing component cannot be deleted from here — see §9.5.
- Validation the browser can do happens before the round trip (reference, client, candidate, profile
  status, and an address + verification type per component); everything else is the server's call and
  surfaces in the page alert.

Adding or removing a component rebuilds every card, so the form is read back into the draft first —
otherwise whatever had been typed into the other cards would be discarded.

### 9.4 What the server enforces

| Rule                                                       | Where                              | Answer  |
| ----------------------------------------------------------- | ---------------------------------- | ------- |
| Case reference is unique                                    | `admin-case.service.ts`            | `409`   |
| A new case carries at least one component                    | `admin-case.schema.ts`             | `400`   |
| Component/action/profile status exists in `dropdown_options` | `admin-case.service.ts`            | `400`   |
| Assignee exists in `field_executives`                        | `admin-case.service.ts`            | `400`   |
| A component named in an update belongs to that case          | `admin-case.service.ts`            | `404`   |
| Bucket, address type, residence type, coordinate ranges      | `admin-case.schema.ts` (zod)       | `400`   |

Status codes are checked against the same `dropdown_options` rows `/master-data` serves the app,
so the portal can never store a status the device has no label for. Writes run inside one SQLite
transaction: a payload whose second component is invalid leaves nothing behind.

### 9.5 Two deliberate limits

**`PUT` upserts, it does not replace.** A component entry carrying an `id` updates that component,
one without adds a new one, and components of the case left out of the payload are untouched. A
partial payload must never silently delete the rest of a candidate's verification trail.

**The field executive's own outcome is never written from here.**
`selected_verification_status`, the respondent, and the insuff/addl-doc/cost date trail are the
record of what happened on site. The admin editor updates assignment and workflow state; it does not
overwrite evidence.

---

## 10. Field Executive History page

`assets/js/pages/field-executive-history.js` — case-wise activity for one executive, built to answer
a single back-office question: *what have they been working on, and did anything look fraudulent
while they did it?*

### 10.1 Why history is case-wise

Mock-location detections (`mock_location_events`, migration `016`) are the only per-executive audit
trail the platform keeps today, and each one carries the component that was open when the faked fix
was seen. Folding detections into the case they happened on is therefore strictly more informative
than a flat log, and it is the shape the request asked for.

**`mock_location_events.case_id` holds a case *component* id**, not a case id — the app reports
whatever it is working on, and its unit of work is the component. History joins on `case_components`
accordingly.

### 10.2 What the page shows

- A **picker** over the roster, floating executives with detections to the top, with its own search.
- A **summary**: cases assigned, detections, handsets involved, first and last detection. The
  detections tile turns red when the count is non-zero.
- **One headed table per workflow category** — Pending, Beyond TAT, Completed — each heading carrying
  its case count and, when non-zero, its detection count. All three are always rendered: an empty
  Pending list is itself an answer, so it shows a muted "No pending cases assigned." rather than
  disappearing.
- **One row per case**, columns: Case (ref + client), Candidate, Component (verification type +
  address type), Address, Status, TAT due, Detections. The category is on the heading, so the row
  does not repeat it; within each table, cases with detections sort first and are tinted.
- **Detections expand in place.** A case with detections gets a chevron in its first cell; opening it
  reveals a second `<tr>` spanning the table with the full evidence. Keeping it in a real row rather
  than a floating panel lets the table stay one scannable list with the detail one click away. Open
  rows survive a re-render (the roster search re-renders the page), because the expanded component
  ids are held in page state.
- **Per detection**: when the mock was enabled (device clock) *and* when the report reached the
  server — a wide gap means it was queued offline — the coordinates the fake provider claimed and
  their accuracy, the fix source, the detection stage in plain English, and the full handset identity
  (make, model, OS, app version and build, installer package, emulator flag, time zone, device id).

Status codes are labelled from `dropdown_options` (the page loads `/admin/cases/form-options` for
this), so the table shows "Insuff Raised" rather than `insuff_raised`.

**TAT is formatted as wall-clock time.** `formatTimestamp` reads a stored value as UTC, which is
right for `datetime('now')` audit stamps but wrong for a deadline: an 18:00 TAT is a commitment on
the clock on the wall, and re-zoning it to 23:30 in IST would tell the admin something untrue. The
TAT column uses `formatWallClockTimestamp` instead, which rebuilds the parts in the local zone so the
same clock face renders everywhere.

### 10.3 New cases are excluded

A **New** component is an unclaimed entry in the shared pool, not work this executive has done: the
mobile app re-draws that bucket at random on every `GET /cases` (see `case.service.ts`), and
*accepting* a case is what actually claims it — which moves it to Pending. Listing New rows in a
history view would therefore be noise, and misleading noise at that.

So `findComponentsAssignedToFieldExecutive` filters `bucket != 'new'`, and the roster's
`assignedComponentCount` does the same — the tile on the page and the lists under it count the same
thing.

### 10.4 Three cases handled deliberately

**Detections with no case.** A detection reported right after login or on resume has no component to
attach to. Those are listed under *Detections not tied to a case* rather than dropped — they are
still evidence.

**Detections on a reassigned case.** If a component a detection points at has since been assigned to
someone else, it is pulled in by id and still listed in this executive's history. Reassigning a case
must not hide where a fake fix was reported.

**Detections on a New case.** Excluding noise must never mean hiding evidence. A New component can
only reach the history attached to a detection (it is filtered out of the assigned query), and when
one does, it comes back as a fourth `new` group appended *after* the standard three — labelled *New
(unclaimed)*, so it reads as the exception it is.

---

## 11. Changes to existing behaviour

Two deliberate changes outside the new files.

**`GET /api/v1/reference-data` gained a `mobileAppSettings` field** — additive, so a client that
ignores unknown fields is unaffected. See [§8.5](#85-delivering-settings-to-the-mobile-app). The
app's `ReferenceData` type makes it required, so all three existing test fixtures that build a
`ReferenceData` were updated.

**`src/middleware/authenticate.ts` now requires a `fieldExecutiveId` claim.**

Previously it verified the JWT signature and assigned `req.fieldExecutiveId = payload.fieldExecutiveId`
without checking that the claim existed. Since admin tokens are signed with the same secret, an admin
token would have passed the signature check and set `req.fieldExecutiveId` to `undefined`, which
would then have flowed into case/profile queries. Introducing a second token type made that a real
hole, so the middleware now rejects any token without the claim (`401`, same message as before).

Field-executive tokens always carry `fieldExecutiveId`, so **no existing mobile client is affected**.
Verified by smoke-testing the full mobile flow — FE login, `/me`, `/cases`, `/reference-data`,
`/ui-config` — plus a test asserting an admin token is refused on `/api/v1/me`.

Everything else is additive: new migrations, new files, and new route mounts in `app.ts`.
**No file in `FullScanApp` was modified.**

---

## 12. Testing

### Server — `npx vitest run`

**140 tests across 10 suites, all passing.** Config in `vitest.config.ts`; suites in `tests/`. `tests/helpers/test-app.ts` points `DB_PATH` at a fresh temp SQLite file and runs the
migrations before importing the app, so tests never touch `./data/` and always start from known seed
data. (These are the project's first tests — `vitest` and `supertest` were already dependencies but
no suites existed.)

| Suite                            | Tests | Covers                                                                                                                             |
| -------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `admin-auth.test.ts`             | 19    | Login success/failure, no hash leakage, cookie flags, token scope, user enumeration, deactivated account, FE-at-admin-endpoint, validation, `/me` via cookie and Bearer, garbage/expired/orphaned tokens, **bidirectional token scope isolation**, logout |
| `mobile-app-settings.test.ts`    | 22    | Read/write authorization, metadata and type coercion, enum options, batch update, `updated_by` audit, string trimming, min/max/enum/boolean/unknown-key/duplicate/empty rejection, **atomic rollback of a partly-invalid batch** |
| `admin-portal.test.ts`           | 12    | Page guard redirects (root and deep, `next` preserved), **shell HTML never sent to anonymous browsers**, forged cookie rejected, shell served when signed in, `no-store`, login page reachable, signed-in bounce off login, asset serving, asset 404, portal CSP |
| `admin-portal-menu.test.ts`      | 18    | Registry completeness and unique routes, role gating, section grouping and ungrouped-first ordering, `escapeHtml` (incl. both quote styles, null/undefined), **`formatWallClockTimestamp` not re-zoning a TAT**, icon fallback and coverage |
| `admin-login-rate-limit.test.ts` | 2     | 10 failures allowed then `429`; throttle uses the standard error envelope (isolated file — the limiter's store is per-process)      |
| `reference-data-settings.test.ts` | 9    | Dropdown lists still intact, all settings carried, `locationRetryCount` under its camelCase key, values typed not stringified, portal-only metadata excluded, `updatedAt` is the latest change, **admin-edit → app-payload round trip**, rejected edits not served |
| `mobile-app-settings-migration.test.ts` | 6 | Migration `015` on a staged database: adds `locationRetryCount` (default 3, range 3-10), narrows the geo-fence bounds, **clamps stored values above 2000 and below 10**, leaves in-range values alone, and does not reset an admin-saved value on replay |
| `mock-location-report.test.ts`   | 7     | Mock-location reporting from the app: auth required, full detail persisted, idempotency on `clientEventId`, running totals |
| `admin-cases.test.ts`            | 27    | List auth/shape/category counts, category filter leaving counts stable, search, unknown bucket and unknown assignee rejected, form options, create (multi-component, assignment, duplicate ref `409`, no components, unknown status/profile/assignee, **nothing written when one component is invalid**), update (case fields, in-place component, added component, foreign component `404`, taken ref `409`, missing case `404`), detail and its `404` |
| `admin-field-executive-history.test.ts` | 18 | Roster auth/shape/search, **no password hash**, history `404`, empty-history shape, **one group per category in workflow order**, **New cases excluded although assigned**, assigned count matching the lists, detection filed under its case and rolled up onto its group, full detection detail incl. device, flagged cases sorted first within their list, unlinked detections, summary totals, **detection still visible after the case is reassigned**, **a New case surfacing as its own appended list when a detection points at it** |

### Mobile app — `npx jest`

**123 tests across 17 suites, all passing** (up from 92 — 31 new), plus `npx tsc --noEmit` clean.

| Suite                                                    | Tests | Covers                                                                                                                        |
| -------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------- |
| `domain/reference-data/mobile-app-settings.test.ts`      | 23    | Defaults for null/undefined, strict security defaults, full-payload mapping of all 18 keys, per-setting fallback, `'true'`/`'false'` strings, numeric strings, `NaN`/`Infinity`/blank/unsupported-language rejection, trimming, **`locationRetryCount` 3-10 bounds and its camelCase-only key**, **geo-fence 10-2000 bounds incl. a stale 5000 row**, table-driven range checks for every numeric setting, defaults-within-range invariant, unknown-key forward compatibility |
| `store/reference-data/use-mobile-app-settings.test.ts`   | 8     | Defaults before fetch, server values after fetch, omitted settings defaulted, re-resolve on store update, memo stability, fallback after logout, non-reactive `getMobileAppSettings()` |

Also verified:

- `npx tsc --noEmit` — clean.
- `npm run build` — clean; migrations and the compiled admin modules land in `dist/`, and the portal
  directory resolves correctly from `dist/` as well as `src/`.
- Portal ES modules parse cleanly under `tsc --allowJs`.
- End-to-end smoke test against the **built** server (`node dist/index.js`): anonymous redirect →
  login page → failed login → successful login → cookie set → guarded shell served → signed-in
  bounce off the login page → `/me` → 18 settings across 4 categories → valid update (with
  `updatedBy`) → rejected out-of-range update → 401 without a session → assets → logout → redirect
  again.
- Migration `015` applied to a **copy of the real dev database** (`data/fullscan.sqlite`, WAL files
  included): it upgraded from `014` cleanly, and the portal then reported `locationRetryCount` as a
  numeric field bounded 3-10 and `geo_fence_radius_meters` as 10-2000.
- Bounds exercised through the live API: `locationRetryCount` accepted at 3 and 10, rejected at 2 and
  11; `geo_fence_radius_meters` accepted at 10 and 2000, rejected at 9 and 2001. The saved value then
  appeared on `/reference-data` as a JSON number.
- Mobile regression smoke test (see [§11](#11-changes-to-existing-behaviour)).

`npm run lint` **fails, and did before this change**: ESLint 9 requires an `eslint.config.js` and the
project has none. Left alone deliberately — adding one would lint the entire pre-existing codebase
and pull unrelated files into this change.

---

## 13. Running it

```bash
cd FullScanServer
npm install          # nothing new to install
npm run dev          # migrations 013 + 014 apply automatically on startup
```

Open **<http://localhost:3000/admin>** → redirected to the login page.

| Username   | Password     | Role          | Active |
| ---------- | ------------ | ------------- | ------ |
| `admin001` | `Admin@123!` | `super_admin` | yes    |
| `admin002` | `Admin@123!` | `admin`       | yes    |
| `admin003` | `Admin@123!` | `admin`       | yes    |
| `admin004` | `Admin@123!` | `admin`       | **no** — exercises the deactivated path |

Straight from the API:

```bash
curl -c jar -X POST localhost:3000/api/v1/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin001","password":"Admin@123!"}'

curl -b jar localhost:3000/api/v1/admin/mobile-app-settings

curl -b jar -X PUT localhost:3000/api/v1/admin/mobile-app-settings \
  -H 'Content-Type: application/json' \
  -d '{"settings":[{"key":"geo_fence_radius_meters","value":350}]}'
```

To reset: delete `./data/fullscan.sqlite` and restart.

---

## 14. Security posture & known limits

**In place:** bcrypt (cost 10) password storage; timing-equalised, non-enumerating login failures;
deactivated-account rejection at login *and* on every subsequent request; admin-scoped tokens with
bidirectional isolation from mobile tokens; httpOnly + `SameSite=Strict` + (production) `Secure`
session cookie; server-side page guarding; login rate limiting; a strict portal CSP with no inline
script or style; HTML escaping of all admin-authored data; open-redirect protection on `?next=`;
`no-store` on portal HTML; `updated_by` audit on every settings write; no password hash in any
response; no secret in any log line.

**Known limits — all pre-existing properties of this development-mock server, not introduced here:**

- `JWT_SECRET` defaults to `change-me-in-production`, and `.env` still ships that value. Change it
  before this runs anywhere but a developer's machine.
- The app-wide `cors()` sends `Access-Control-Allow-Origin: *`. The admin cookie is unaffected
  (`SameSite=Strict`, and credentialed CORS is impossible with a wildcard origin), but a
  cross-origin page can still *call* the login endpoint and read the response. Rate limiting caps
  the damage; a real deployment should pin an allowlist of origins.
- Logout cannot invalidate an already-issued Bearer token before expiry (stateless JWT). A denylist
  or refresh-token rotation is the fix if that is ever required.
- There is no password change/reset, MFA, email delivery, or login audit table. A super admin can
  add admins by email, promote/demote, deactivate/reactivate and delete them — see
  [`super-admin-functionality.md`](./super-admin-functionality.md).
- `super_admin` is now enforced: Mobile App Settings and admin-user management are super-admin-only
  on the server (`requireAdminRole`) and in the drawer. See
  [`super-admin-functionality.md`](./super-admin-functionality.md) for the role matrix.

---

## 15. Design decisions and the alternatives rejected

**Static portal, not a React/Vite SPA.** The server had no front-end tooling at all. A SPA would have
added a bundler, a framework, a build step, and a `dist` pipeline to a project whose brief was to
avoid unnecessary dependencies and architectural change. A login page and one settings form do not
need it, and native ES modules with `import()` give lazy per-page loading anyway. If the portal grows
to a dozen interdependent pages, the registry-plus-page-module structure is a clean seam to swap a
framework in behind.

**Separate `admin_users` table, not a role on `field_executives`.** Different principal, different
lifecycle, different token scope — see [§3.1](#31-admin_users--migration-013_create_admin_userssql).

**Typed key/value settings table, not one column per setting.** Makes both the form and its
validation data-driven; a new setting is a seed row, not a code change across five layers.

**httpOnly cookie, not `localStorage`.** Enables genuine server-side page guarding and removes the
token from JavaScript's reach entirely. `SameSite=Strict` covers the CSRF exposure that cookie auth
would otherwise introduce, and Bearer is still accepted for non-browser clients.

**Hash routing, not one HTML file per page.** One shell means the drawer markup exists once. Server
routing still guards every `/admin/*` path, so deep links work and stay protected.

**Hand-rolled cookie helpers, not `cookie-parser`.** One cookie, two operations, ~40 lines,
no new dependency.

---

## 16. File manifest

### New — server

| File                                              | Purpose                                             |
| ------------------------------------------------- | --------------------------------------------------- |
| `src/db/migrations/013_create_admin_users.sql`     | `admin_users` table + 4 seeded admins               |
| `src/db/migrations/014_create_mobile_app_settings.sql` | Settings table + 17 seeded settings             |
| `src/db/migrations/015_add_location_retry_and_tighten_geofence.sql` | `locationRetryCount` + tightened geo-fence bounds |
| `src/types/admin.types.ts`                        | Admin row/DTO/login/JWT-payload types               |
| `src/types/mobile-app-setting.types.ts`           | Setting row/DTO/update types, categories            |
| `src/db/admin-user.dao.ts`                        | Admin lookups, `last_login_at` stamp                |
| `src/db/mobile-app-setting.dao.ts`                | Setting reads, transactional batch write            |
| `src/services/admin-auth.service.ts`              | Credential validation, token issue/verify, profile  |
| `src/services/mobile-app-setting.service.ts`      | Type coercion, per-setting validation, batch update  |
| `src/controllers/admin-auth.controller.ts`        | login / logout / me                                 |
| `src/controllers/mobile-app-setting.controller.ts`| get / update                                        |
| `src/middleware/authenticate-admin.ts`            | `authenticateAdmin` (API) + `authenticateAdminPage` |
| `src/utils/admin-session-cookie.ts`               | Session cookie read / set / clear                   |
| `src/routes/admin-auth.routes.ts`                 | `/api/v1/admin/auth/*` + login rate limit           |
| `src/routes/mobile-app-setting.routes.ts`         | `/api/v1/admin/mobile-app-settings`                 |
| `src/routes/admin-portal.routes.ts`               | `/admin` pages, assets, portal CSP                  |
| `src/routes/schemas/admin.schema.ts`              | Zod schemas for both admin endpoints                |
| `src/types/admin-case.types.ts`                   | Admin case list/detail/input types, bucket + type vocabularies |
| `src/types/admin-field-executive.types.ts`        | Roster, case-wise history and detection types       |
| `src/db/admin-case.dao.ts`                        | Admin case reads, filtered list, counts, transactional writes |
| `src/db/admin-field-executive.dao.ts`             | Roster, assigned components, detections by executive |
| `src/services/admin-case.service.ts`              | Case validation (ref, assignee, status codes), create/upsert |
| `src/services/admin-field-executive.service.ts`   | Folds detections into the cases they happened on    |
| `src/controllers/admin-case.controller.ts`        | list / form-options / get / create / update         |
| `src/controllers/admin-field-executive.controller.ts` | list / history                                  |
| `src/routes/admin-case.routes.ts`                 | `/api/v1/admin/cases`                               |
| `src/routes/admin-field-executive.routes.ts`      | `/api/v1/admin/field-executives`                    |
| `src/routes/schemas/admin-case.schema.ts`         | Zod schemas for the case and history endpoints      |

### New — portal & tests

| File                                                    | Purpose                          |
| ------------------------------------------------------- | -------------------------------- |
| `public/admin/login.html`                               | Login page                       |
| `public/admin/index.html`                               | Authenticated app shell          |
| `public/admin/assets/css/admin.css`                     | All portal styling               |
| `public/admin/assets/js/{api,dom,icons,menu,drawer,router,app,login}.js` | Portal modules |
| `public/admin/assets/js/pages/mobile-app-settings.js`   | Mobile App Settings page         |
| `public/admin/assets/js/pages/cases.js`                 | Cases list + create/update editor |
| `public/admin/assets/js/pages/field-executive-history.js` | Field Executive History page   |
| `vitest.config.ts`                                      | Vitest config                    |
| `tests/helpers/test-app.ts`                             | Temp-DB app bootstrap            |
| `tests/admin-auth.test.ts`                              | 19 auth tests                    |
| `tests/mobile-app-settings.test.ts`                     | 16 settings tests                |
| `tests/admin-portal.test.ts`                            | 12 portal/guard tests            |
| `tests/admin-portal-menu.test.ts`                       | 18 registry/escaping/format tests |
| `tests/admin-login-rate-limit.test.ts`                  | 2 throttling tests               |
| `tests/reference-data-settings.test.ts`                 | 9 settings-delivery tests        |
| `tests/mobile-app-settings-migration.test.ts`           | 6 migration-`015` tests          |
| `tests/admin-cases.test.ts`                             | 27 admin case tests              |
| `tests/admin-field-executive-history.test.ts`           | 18 history tests                 |

### Modified — server

| File                                     | Change                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| `src/app.ts`                             | Mount `/api/v1/admin/auth`, `/api/v1/admin/mobile-app-settings`, `/api/v1/admin/cases`, `/api/v1/admin/field-executives`, `/admin` |
| `src/middleware/authenticate.ts`         | Require a `fieldExecutiveId` claim — see [§11](#11-changes-to-existing-behaviour) |
| `src/types/express.d.ts`                 | Add `adminUserId`, `adminRole` to `Request`                               |
| `src/types/reference-data.types.ts`      | Add `MobileAppSettings` + `mobileAppSettings` on `ReferenceData`          |
| `src/services/reference-data.service.ts` | Flatten admin settings into the reference-data payload                    |
| `README.md`                              | Admin endpoints, Admin Portal section, settings delivery, credentials, layout, test notes |

### New — mobile app (`FullScanApp`)

| File                                                        | Purpose                                             |
| ----------------------------------------------------------- | --------------------------------------------------- |
| `src/domain/reference-data/mobile-app-settings.ts`           | Setting keys, safe defaults, ranges, typed resolver |
| `src/domain/reference-data/mobile-app-settings.test.ts`      | 23 resolver tests                                   |
| `src/store/reference-data/use-mobile-app-settings.ts`        | `useMobileAppSettings()` + `getMobileAppSettings()` |
| `src/store/reference-data/use-mobile-app-settings.test.ts`   | 8 hook tests                                        |

### Modified — mobile app (`FullScanApp`)

| File                                                       | Change                                                     |
| ---------------------------------------------------------- | ---------------------------------------------------------- |
| `src/domain/reference-data/reference-data.entity.ts`        | Add `MobileAppSettings`, `MobileAppSettingValue`, new field |
| `src/domain/reference-data/index.ts`                        | Export the settings types, ranges and resolver              |
| `src/store/reference-data/index.ts`                        | Export the settings hooks                                   |
| `src/store/reference-data/reference-data.store.ts`          | Log setting count / `updatedAt` on arrival                  |
| `src/features/authentication/screens/login-screen.test.tsx` | Fixture: add `mobileAppSettings`                            |
| `src/navigation/root-navigator.test.tsx`                    | Fixture: add `mobileAppSettings`                            |
| `src/features/cases/hooks/use-case-details.test.ts`         | Fixture: add `mobileAppSettings`                            |

No mobile screen, navigator, repository, dependency or native config was touched.
