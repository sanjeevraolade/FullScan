# Admin User Authentication, Portal & Navigation — Implementation Notes

This document describes the Admin User feature added to **FullScanServer**: the database schema and
seed data, the authentication design, the guarded Admin Portal at `/admin`, its navigation drawer,
the Mobile App Settings page, and how to extend any of it.

Scope note: this work is **server-side only**. Nothing in `FullScanApp` (the React Native app) was
touched — no files, no dependencies, no contracts. The existing mobile API surface behaves exactly
as before, with one deliberate security hardening called out in [§9](#9-changes-to-existing-behaviour).

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
9. [Changes to existing behaviour](#9-changes-to-existing-behaviour)
10. [Testing](#10-testing)
11. [Running it](#11-running-it)
12. [Security posture & known limits](#12-security-posture--known-limits)
13. [Design decisions and the alternatives rejected](#13-design-decisions-and-the-alternatives-rejected)
14. [File manifest](#14-file-manifest)

---

## 1. What was built

| Requirement                                        | Delivered                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Update server/schema for Admin Users               | `admin_users` table (migration `013`), plus `mobile_app_settings` (migration `014`)                    |
| Seed admin users for testing                       | 4 admins seeded — 3 active (incl. one `super_admin`), 1 deliberately deactivated                        |
| Admin Login page                                    | `GET /admin/login` — served from `public/admin/login.html`                                              |
| Authenticate against the server                     | `POST /api/v1/admin/auth/login` — bcrypt verify → admin-scoped JWT                                     |
| Handle success and failure                          | Redirect to portal on success; inline, non-enumerating errors on failure; throttling; disabled accounts |
| Protect admin routes/pages                          | `authenticateAdmin` (API, 401) and `authenticateAdminPage` (pages, 302 → login) middleware              |
| Navigation Drawer after login                        | `public/admin/index.html` shell + `assets/js/drawer.js`, docked ≥1024px, off-canvas below               |
| Drawer: Mobile App Settings                          | Data-driven settings page, `assets/js/pages/mobile-app-settings.js`                                     |
| Drawer: Logout at the bottom                         | Pinned in `.drawer__footer`; clears the session cookie and returns to the login page                    |
| Extensible drawer structure                          | Declarative menu registry (`assets/js/menu.js`) + lazily-imported page modules                          |

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

17 settings are seeded across the four categories, chosen to match real FullScan domain concerns:
geo-fence radius, watermarking, photo compression/size, mock-location blocking, biometric login,
session timeout, sync interval and Wi-Fi-only sync, offline retry limit, minimum app version and
force-update, default language (`en`/`hi`/`te`), support number, and maintenance mode.

> These settings are **stored and administered** by this feature. Wiring the mobile app to consume
> them is intentionally *not* part of this change — that needs a mobile-facing read endpoint and app
> changes, both out of scope here.

### 3.3 Migrations

`initDb()` applies pending `src/db/migrations/*.sql` in filename order on startup and records them in
the `migrations` table, so both new migrations apply automatically on the next `npm run dev` /
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
  admin token is rejected on mobile routes. See [§9](#9-changes-to-existing-behaviour).

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
`<div data-drawer-nav>`; `drawer.js` fills it from `menu.js`.

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

---

## 9. Changes to existing behaviour

One deliberate change outside the new files:

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

## 10. Testing

`npx vitest run` — **63 tests across 5 suites, all passing.** Config in `vitest.config.ts`; suites in
`tests/`. `tests/helpers/test-app.ts` points `DB_PATH` at a fresh temp SQLite file and runs the
migrations before importing the app, so tests never touch `./data/` and always start from known seed
data. (These are the project's first tests — `vitest` and `supertest` were already dependencies but
no suites existed.)

| Suite                            | Tests | Covers                                                                                                                             |
| -------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `admin-auth.test.ts`             | 19    | Login success/failure, no hash leakage, cookie flags, token scope, user enumeration, deactivated account, FE-at-admin-endpoint, validation, `/me` via cookie and Bearer, garbage/expired/orphaned tokens, **bidirectional token scope isolation**, logout |
| `mobile-app-settings.test.ts`    | 16    | Read/write authorization, metadata and type coercion, enum options, batch update, `updated_by` audit, string trimming, min/max/enum/boolean/unknown-key/duplicate/empty rejection, **atomic rollback of a partly-invalid batch** |
| `admin-portal.test.ts`           | 12    | Page guard redirects (root and deep, `next` preserved), **shell HTML never sent to anonymous browsers**, forged cookie rejected, shell served when signed in, `no-store`, login page reachable, signed-in bounce off login, asset serving, asset 404, portal CSP |
| `admin-portal-menu.test.ts`      | 14    | Registry completeness and unique routes, role gating, section grouping, `escapeHtml` (incl. both quote styles, null/undefined), icon fallback and coverage |
| `admin-login-rate-limit.test.ts` | 2     | 10 failures allowed then `429`; throttle uses the standard error envelope (isolated file — the limiter's store is per-process)      |

Also verified:

- `npx tsc --noEmit` — clean.
- `npm run build` — clean; migrations and the compiled admin modules land in `dist/`, and the portal
  directory resolves correctly from `dist/` as well as `src/`.
- Portal ES modules parse cleanly under `tsc --allowJs`.
- End-to-end smoke test against the **built** server (`node dist/index.js`): anonymous redirect →
  login page → failed login → successful login → cookie set → guarded shell served → signed-in
  bounce off the login page → `/me` → 17 settings across 4 categories → valid update (with
  `updatedBy`) → rejected out-of-range update → 401 without a session → assets → logout → redirect
  again.
- Mobile regression smoke test (see [§9](#9-changes-to-existing-behaviour)).

`npm run lint` **fails, and did before this change**: ESLint 9 requires an `eslint.config.js` and the
project has none. Left alone deliberately — adding one would lint the entire pre-existing codebase
and pull unrelated files into this change.

---

## 11. Running it

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

## 12. Security posture & known limits

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
- There is no admin-user CRUD, password change/reset, MFA, or login audit table. Admins are seeded
  by migration only.
- `super_admin` is stored and exposed on `req.adminRole` but no endpoint restricts on it yet — the
  hook is there for the first page that needs it.

---

## 13. Design decisions and the alternatives rejected

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

## 14. File manifest

### New — server

| File                                              | Purpose                                             |
| ------------------------------------------------- | --------------------------------------------------- |
| `src/db/migrations/013_create_admin_users.sql`     | `admin_users` table + 4 seeded admins               |
| `src/db/migrations/014_create_mobile_app_settings.sql` | Settings table + 17 seeded settings             |
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

### New — portal & tests

| File                                                    | Purpose                          |
| ------------------------------------------------------- | -------------------------------- |
| `public/admin/login.html`                               | Login page                       |
| `public/admin/index.html`                               | Authenticated app shell          |
| `public/admin/assets/css/admin.css`                     | All portal styling               |
| `public/admin/assets/js/{api,dom,icons,menu,drawer,router,app,login}.js` | Portal modules |
| `public/admin/assets/js/pages/mobile-app-settings.js`   | Mobile App Settings page         |
| `vitest.config.ts`                                      | Vitest config                    |
| `tests/helpers/test-app.ts`                             | Temp-DB app bootstrap            |
| `tests/admin-auth.test.ts`                              | 19 auth tests                    |
| `tests/mobile-app-settings.test.ts`                     | 16 settings tests                |
| `tests/admin-portal.test.ts`                            | 12 portal/guard tests            |
| `tests/admin-portal-menu.test.ts`                       | 14 registry/escaping tests       |
| `tests/admin-login-rate-limit.test.ts`                  | 2 throttling tests               |

### Modified

| File                              | Change                                                                    |
| --------------------------------- | ------------------------------------------------------------------------- |
| `src/app.ts`                      | Mount `/api/v1/admin/auth`, `/api/v1/admin/mobile-app-settings`, `/admin` |
| `src/middleware/authenticate.ts`  | Require a `fieldExecutiveId` claim — see [§9](#9-changes-to-existing-behaviour) |
| `src/types/express.d.ts`          | Add `adminUserId`, `adminRole` to `Request`                               |
| `README.md`                       | Admin endpoints, Admin Portal section, admin credentials, layout, test notes |

**`FullScanApp` (React Native): unchanged.**
