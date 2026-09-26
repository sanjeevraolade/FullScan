# Field Executive Web Login — Implementation Notes

This document describes the web login added to **FullScanServer** for field executives (FEs): a
browser portal at `/fe` where an FE signs in with the same credentials as the FullScan mobile app
and sees their profile and their Pending, Beyond TAT and Completed cases.
No changes were made to the mobile app (`FullScanApp`).

---

## Table of contents

1. [What was built](#1-what-was-built)
2. [Architecture & where things live](#2-architecture--where-things-live)
3. [Authentication design](#3-authentication-design)
4. [API reference](#4-api-reference)
5. [The portal front end](#5-the-portal-front-end)
6. [Changes to existing behaviour](#6-changes-to-existing-behaviour)
7. [Testing](#7-testing)
8. [Running it](#8-running-it)
9. [Security posture & known limits](#9-security-posture--known-limits)
10. [Open question: case work on the web](#10-open-question-case-work-on-the-web)
11. [File manifest](#11-file-manifest)

---

## 1. What was built

| Requirement                           | Delivered                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| FE login page on the web              | `GET /fe/login`, served from `public/fe/login.html`                                         |
| Authenticate against the server       | `POST /api/v1/fe-web/auth/login`: bcrypt verify, then a web-scoped JWT in an httpOnly cookie |
| Same accounts as the mobile app       | Reads `field_executives` (`fe001` … `fe051` / `Password123!` in development)                |
| Signed-in page                        | `GET /fe`: the same drawer layout as the Admin Portal (account block, menu, Logout pinned at the bottom) |
| Drawer menu: Profile                  | `#/profile` (landing page): the FE's name, email, role and executive ID                     |
| Mobile device on Profile              | If the FE has signed in to the mobile app, the bound phone's name, brand/model, OS, app version and device ID; otherwise a "not signed in to the app yet" message |
| Device change requests                | Request device change on Profile, admin approval, request limit and full phone history: see [`device-change-requests.md`](./device-change-requests.md) |
| Drawer menu: Cases                    | `#/cases`: the FE's own cases in three headed tables: Pending, Beyond TAT, Completed         |
| Case data for the web                 | `GET /api/v1/fe-web/cases`: read-only, grouped, status labels resolved, web session only    |
| Logout                                | `POST /api/v1/fe-web/auth/logout` clears the cookie and returns to the login page           |
| Protect pages and API                 | `authenticateFeWebPage` (pages, 302 to login) and `authenticateFeWeb` (API, 401)            |

**Not built yet:** opening a case's details or working on a case from the web (accepting, capturing
evidence, submitting an outcome). The web case lists are read-only; case work still happens only in
the mobile app. See [§10](#10-open-question-case-work-on-the-web).

**Zero new npm dependencies.**

---

## 2. Architecture & where things live

The feature follows the server's existing layering and mirrors the Admin Portal
(see [`ADMIN_PORTAL.md`](./ADMIN_PORTAL.md)):

```
route  →  middleware (validate / rate limit / authenticate)  →  controller  →  service  →  DAO  →  SQLite
```

```
                    ┌──────────────────────────────────────────────┐
  Browser ─────────▶│ GET /fe/*                                    │
                    │   authenticateFeWebPage → 302 /fe/login       │
                    │   (valid session) → index.html shell          │
                    └──────────────────────────────────────────────┘
                                     │ fetch (fs_fe_session cookie)
                                     ▼
                    ┌──────────────────────────────────────────────┐
                    │ /api/v1/fe-web/auth/login   (rate limited)   │
                    │ /api/v1/fe-web/auth/logout  authenticateFeWeb │
                    │ /api/v1/fe-web/auth/me      authenticateFeWeb │
                    │ /api/v1/fe-web/cases        authenticateFeWeb │
                    │ /api/v1/fe-web/profile      authenticateFeWeb │
                    └──────────────────────────────────────────────┘
```

No database migration was needed. The portal reads the existing `field_executives`,
`case_components`, `cases` and `dropdown_options` tables and never writes to any of them.

---

## 3. Authentication design

### 3.1 Sign-in

`POST /api/v1/fe-web/auth/login` → `feWebAuthService.loginFieldExecutiveWeb()`:

1. Look up the FE row by username (trimmed, exact match, same as mobile login).
2. Check the password with `verifyPassword()`. **When the username does not exist, a bcrypt
   comparison still runs against a dummy hash**, so a missing account takes the same time as a wrong
   password. Both return the same `401 Invalid username or password`, so the endpoint cannot be used
   to discover valid usernames.
3. Sign a JWT: `{ fieldExecutiveId, scope: 'fe_web' }`, 8-hour expiry.
4. Set the session cookie. **The token is not returned in the response body.**

### 3.2 No device binding

Mobile login (`POST /api/v1/auth/login`) binds an account to one handset through
`field_executives.device_id`. Web login deliberately does not:

- It needs no `deviceId` or `deviceDetails`.
- It neither checks nor changes `device_id` / `device_details`.

A browser has no stable device identity. Binding one would lock the FE out of their handset, and
checking the handset binding would block the web entirely. Device reset remains an admin-portal
action, as before.

The web portal does **show** the binding, read-only, on the Profile page (see
`GET /api/v1/fe-web/profile` in [§4](#4-api-reference)), so an FE can see which phone their account
is locked to before asking an admin for a reset.

### 3.3 Token scope isolation

Mobile, admin and FE web tokens are all signed with `JWT_SECRET`, so a valid signature alone proves
nothing about which API the holder may use. Every direction is closed:

| Token presented to → | Mobile API (`authenticate`) | FE web API (`authenticateFeWeb`) | Admin API (`authenticateAdmin`) |
| -------------------- | --------------------------- | -------------------------------- | ------------------------------- |
| Mobile token         | ✅ accepted                 | ❌ 401 (no `fe_web` scope)       | ❌ 401 (no `admin` scope)       |
| FE web token         | ❌ 401 (has a `scope`)      | ✅ accepted                      | ❌ 401 (no `admin` scope)       |
| Admin token          | ❌ 401 (has a `scope`)      | ❌ 401 (no `fe_web` scope)       | ✅ accepted                     |

The important one is **FE web token → mobile API**. A web token carries `fieldExecutiveId` just like a
mobile token, but it was issued without device binding. If the mobile API accepted it, web login
would be a way around device binding. `authenticate` therefore requires a token with **no** `scope`
claim.

`verifyFeWebToken()` also re-reads the FE row on every request, so a deleted account stops working
before its token expires.

### 3.4 Session transport: httpOnly cookie only

```
fs_fe_session=<jwt>; Path=/; Max-Age=28800; HttpOnly; SameSite=Strict[; Secure]
```

- **`HttpOnly`**: portal JavaScript cannot read the token, so an XSS bug has no session to steal.
- **`SameSite=Strict`**: cross-site requests never carry the cookie, which protects against CSRF.
- **`Secure`** only when `NODE_ENV === 'production'`, so development over `http://localhost` works.
- **Different name from the admin cookie** (`fs_admin_session`): an admin and an FE can be signed in
  in the same browser without signing each other out.
- **No Bearer transport.** Unlike the admin API, the FE web API does not accept
  `Authorization: Bearer`. The token never leaves the cookie, so there is nothing to send as a header.

### 3.5 Route protection

| Guard                   | Applied to                                        | No/invalid session                      |
| ----------------------- | ------------------------------------------------- | --------------------------------------- |
| `authenticateFeWeb`     | `/api/v1/fe-web/auth/logout`, `/api/v1/fe-web/auth/me`, `/api/v1/fe-web/cases`, `/api/v1/fe-web/profile` | `401` JSON |
| `authenticateFeWebPage` | every `/fe/*` page except `/fe/login` and assets  | `302` → `/fe/login?next=<original-url>` |

The shell HTML is never sent to an anonymous browser, and portal HTML is served with
`Cache-Control: no-store, must-revalidate`. An FE who is already signed in and visits `/fe/login` is
redirected to `/fe`.

### 3.6 Brute-force throttling

Login is limited to **10 failed attempts per IP per 15 minutes** (`skipSuccessfulRequests: true`),
answered with `429` in the standard error envelope. The limiter comes from `createLoginRateLimit()`,
which gives each caller its own store: **failed FE logins never count against admin login**, and the
reverse.

### 3.7 Logout

`POST /api/v1/fe-web/auth/logout` expires the cookie (`Max-Age=0`) and logs the event. Because the
token only ever lived in that cookie, the browser is fully signed out.

---

## 4. API reference

All endpoints use the server's standard envelope: `{ success: true, data }` or
`{ success: false, error }`.

### `POST /api/v1/fe-web/auth/login`

Request:

```json
{ "username": "fe001", "password": "Password123!" }
```

Validation: `username` 1–100 chars, `password` 1–200 chars.

`200` response (also sets the `fs_fe_session` cookie):

```json
{
  "success": true,
  "data": {
    "expiresInSeconds": 28800,
    "fieldExecutive": {
      "id": "fe-001",
      "name": "Amit Verma",
      "email": "amit.verma@fullscan.example",
      "role": "Field Agent"
    }
  }
}
```

| Status | When                                                       |
| ------ | ---------------------------------------------------------- |
| `400`  | Body fails validation (`error: "Validation failed"`)       |
| `401`  | Unknown username or wrong password (same message for both) |
| `429`  | More than 10 failed attempts from this IP in 15 minutes    |

### `POST /api/v1/fe-web/auth/logout`

Requires the session cookie. `200` → `{ "success": true, "data": { "signedOut": true } }` and an
expired cookie. `401` without a valid session.

### `GET /api/v1/fe-web/auth/me`

Requires the session cookie. Returns the same profile shape as the mobile `GET /api/v1/me`
(it reuses that controller). `401` without a valid session.

### `GET /api/v1/fe-web/cases`

Requires the session cookie. Returns the signed-in FE's **own** cases, grouped by workflow category.
`401` without a valid session.

```json
{
  "success": true,
  "data": {
    "caseGroups": [
      {
        "bucket": "pending",
        "caseCount": 10,
        "cases": [
          {
            "componentId": "…",
            "caseId": "…",
            "caseRef": "FS-2026-00072",
            "clientName": "…",
            "candidateName": "Meera Joshi",
            "verificationType": "Address",
            "addressType": "present",
            "address": "…",
            "componentStatus": "new_component",
            "componentStatusLabel": "New Component",
            "tatDueAt": "2026-08-21 18:00:00",
            "updatedAt": "…"
          }
        ]
      },
      { "bucket": "beyond_tat", "caseCount": 7, "cases": ["…"] },
      { "bucket": "completed", "caseCount": 7, "cases": ["…"] }
    ]
  }
}
```

- **Always three groups, always in this order:** `pending`, `beyond_tat`, `completed`. An empty group
  is still returned with `caseCount: 0`, so "no pending cases" is an answer, not a missing section.
- **New is never included.** The New bucket is the shared pool of unclaimed work that the mobile app
  re-draws at random on every request, not cases this FE holds. Claiming a case still happens in the
  app.
- **Same source as the mobile app.** Cases come from `caseDao.findComponentsByFieldExecutive()`, the
  query behind the mobile `GET /cases`, so web and app agree on what an FE holds. As on mobile, one
  entry is one **case component** (a case with address and employment checks appears twice).
- **Ordering:** Pending and Beyond TAT by TAT due, soonest first (what needs doing next). Completed by
  most recent update.
- **Status labels** are resolved on the server from `dropdown_options` (`component_status`), the same
  rows the app reads. An unknown code falls back to the code itself.
- **List-level fields only.** No contact numbers (masked or raw), GPS targets, respondent details or
  mock-location detections.
- **Read-only.** There is no accept, update or submit route under `/api/v1/fe-web/cases`.

### `GET /api/v1/fe-web/profile`

Requires the session cookie. Returns the signed-in FE's profile and the mobile device their account
is bound to. `401` without a valid session.

After the FE has signed in to the mobile app:

```json
{
  "success": true,
  "data": {
    "fieldExecutive": {
      "id": "fe-001",
      "name": "Amit Verma",
      "email": "amit.verma@fullscan.example",
      "role": "Field Agent"
    },
    "mobileDevice": {
      "deviceId": "e2eda104bcacf53b",
      "deviceName": "Galaxy S25",
      "brand": "samsung",
      "model": "SM-S931B",
      "systemName": "Android",
      "osVersion": "16",
      "appVersion": "1.0"
    }
  }
}
```

Before the FE has signed in to the mobile app (no device bound): `"mobileDevice": null`.

- **Source:** `field_executives.device_id` and `device_details`, written by the mobile login
  (`POST /api/v1/auth/login`). Because an account can be bound to only one phone, this is the phone
  of the FE's first and only permitted mobile login. When an admin resets the binding, it goes back
  to `null`.
- **Fixed field list.** Only the seven fields above are returned. Any other keys the app stored in
  `device_details` (including `uniqueId`, which duplicates `deviceId`) are not echoed.
- **Defensive parsing.** If `device_details` is missing, not valid JSON, or holds blank or non-string
  values, those fields come back `null` but `deviceId` is still returned, so the binding is never
  hidden. Invalid JSON is logged as a warning (without the content).
- `/auth/me` is unchanged and still returns only the profile; the shell uses it for the drawer.

---

## 5. The portal front end

Static HTML, CSS and native ES modules under `public/fe/`, no build step, same approach as the
Admin Portal.

| File                         | Role                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `login.html`                 | Sign-in form                                                                  |
| `index.html`                 | Signed-in shell: same drawer + topbar + content structure as `/admin`         |
| `assets/js/menu.js`          | Drawer menu registry: Profile, then Cases                                     |
| `assets/js/pages/profile.js` | Profile page: loads `/profile` on every visit; account card + mobile device card |
| `assets/js/pages/cases.js`   | Cases page: loads `/cases` on every visit, one table per category             |
| `assets/js/api.js`           | `fetch` wrapper for `/api/v1/fe-web/*`; unwraps the envelope; 401 → login page |
| `assets/js/login.js`         | Form handling, inline errors, busy state, safe `?next=` redirect              |
| `assets/js/app.js`           | Loads the profile via `/auth/me`, then starts the shared drawer and router with this portal's menu |
| `assets/css/fe.css`          | Only the FE-specific layout (profile grid)                                    |

**Shared with the Admin Portal:** the FE pages load `/admin/assets/css/admin.css` (design tokens,
drawer shell, cards, tables, badges, forms, alerts, light/dark theme) and import these modules from
`/admin/assets/js/`:

| Module      | Used for                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------- |
| `drawer.js` | The drawer: account block, menu links, open/close on narrow screens, Escape, Logout       |
| `router.js` | Hash routing, lazy page loading, page header, topbar title, `document.title`, page alerts |
| `icons.js`  | Menu icons (`user` for Profile, `briefcase` for Cases)                                    |
| `dom.js`    | `escapeHtml`, `renderAlert`, `formatWallClockTimestamp`                                   |

Admin assets are served without a session, so this works for FEs. If any of these change, check
the FE portal too.

To make the drawer and router shareable they no longer import the admin menu themselves. Each
portal's `app.js` passes in what differs: the account block, the menu sections, the route lookup,
the default route, the app name and the context its pages receive.

**Layout after sign-in:** identical to the Admin Portal. A dark drawer holds the FullScan brand,
the FE's avatar initials, name and role, the menu, and Logout pinned at the bottom. The drawer is
docked at 1024px and wider; below that it is hidden behind a menu button in the topbar and slides
in over the page. Tapping a menu item on a narrow screen closes it, as does the scrim or Escape.

**Drawer menu** (`assets/js/menu.js`):

| Item    | Route       | Page                                                                                    |
| ------- | ----------- | --------------------------------------------------------------------------------------- |
| Profile | `#/profile` | Account card (Name, Email, Role, Executive ID), then the **Mobile app device** card     |
| Cases   | `#/cases`   | The three case groups (below)                                                           |

- **Profile is the landing page**, as the first menu entry. An empty or unknown hash (e.g.
  `/fe#/not-a-page`) falls back to it.
- The current page is highlighted in the drawer (`aria-current="page"`), and the topbar title, page
  header and browser tab title follow the page (e.g. `Cases · FullScan Field Executive`).
- **Mobile app device card** on Profile, loaded fresh on every visit so a new or reset binding
  shows without a reload:
  - **Signed in to the app:** "Your account is linked to this phone." with Device name, Brand &
    model (e.g. "Samsung SM-S931B"; the brand's first letter is capitalised for display), Operating
    system (e.g. "Android 16"), FullScan app version and Device ID, then a note that the app only
    works on this phone and the admin must reset the link to switch phones. A missing value shows
    as "—".
  - **Not signed in to the app yet:** "Not signed in to the FullScan mobile app yet." and a note that
    the first app sign-in links the account to that phone.
  - All device values are HTML-escaped: they are whatever the handset reported.
- **Cases** shows each category's title, a colour-coded count badge (Pending amber, Beyond TAT red,
  Completed green) and a table with Case (ref + client), Candidate, Component (type + address type),
  Address, Status and TAT due. Empty groups show a one-line message. The cases are fetched again on
  every visit to the page, so switching back shows current data. If the call fails, the error shows
  as the page alert. Rows are not clickable, since there is no web case detail yet. On narrow
  screens each table scrolls sideways inside its frame, as on the admin Cases page.

To add a page: create `assets/js/pages/<page>.js` exporting `render(container, context)` (context
is `{ fieldExecutive, setStatus }`), add one entry to `FE_MENU` in `menu.js`, and add an icon to
`/admin/assets/js/icons.js` if needed. Guard any API it calls with `authenticateFeWeb`; the drawer
is not a security boundary.

- **`?next=` redirect** only accepts `/fe`, `/fe/…` or `/fe#…`. Anything else (absolute URLs,
  `//host`, paths outside the portal, backslashes) falls back to `/fe`, so the login page cannot be
  used as an open redirect.
- **CSP**: the same portal policy as `/admin` (everything `'self'`, no inline script or style,
  `frame-ancestors 'none'`). All FE-provided data is HTML-escaped before rendering.
- **Accessibility**: labelled inputs, `aria-invalid` on failure, alerts with `role="alert"`, a
  skip link, a labelled navigation landmark, `aria-expanded` on the menu button, the closed
  off-canvas drawer taken out of the tab order (`inert`), and tables labelled by their group heading.
- User-facing text is English only, like the Admin Portal.

---

## 6. Changes to existing behaviour

| File                                   | Change                                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/middleware/authenticate.ts`       | Mobile API now also rejects any token with a `scope` claim (see [§3.3](#33-token-scope-isolation)). Mobile tokens have no scope, so the app is unaffected. |
| `src/app.ts`                           | Mounts `/api/v1/fe-web/auth`, `/api/v1/fe-web/cases` and `/api/v1/fe-web/profile` (both behind `authenticateFeWeb`) and `/fe` |
| `src/types/auth.types.ts`              | `JwtPayload` gains optional `scope`                                                                  |
| `src/routes/schemas/auth.schema.ts`    | Adds `feWebLoginSchema`                                                                              |
| `src/services/field-executive.service.ts` | Extracts `toFieldExecutive(row)`, reused by web login                                             |
| `src/utils/admin-session-cookie.ts`    | Now thin wrappers over the shared `session-cookie.ts`; same exports and behaviour                   |
| `src/services/admin-auth.service.ts`   | Uses the shared `verifyPassword()` instead of its own dummy-hash comparison; same behaviour         |
| `src/routes/admin-auth.routes.ts`      | Uses the shared `createLoginRateLimit()`; same limits                                                |
| `src/routes/admin-portal.routes.ts`    | Uses the shared `createPortalContentSecurityPolicy()`; same policy                                  |
| `public/admin/assets/js/drawer.js`     | `createDrawer({ shell, account, sections, onSignOut })`: takes the account block and menu sections instead of `adminUser` + importing `menu.js` |
| `public/admin/assets/js/router.js`     | `createRouter({ shell, drawer, findMenuItem, defaultRoute, appName, pageContext })`: takes the route lookup, default route, app name and page context instead of `adminUser` + importing `menu.js` |
| `public/admin/assets/js/app.js`        | Passes the admin's account, role-filtered sections, role-aware lookup and default route, `'FullScan Admin'` and `{ adminUser }`; admin behaviour unchanged |
| `public/admin/assets/js/icons.js`      | Adds the `user` icon                                                                                 |
| `tests/helpers/test-app.ts`            | `extractSessionCookie()` takes an optional cookie name; adds `SEEDED_FIELD_EXECUTIVE`               |
| `README.md`                            | API rows, "Field Executive Web Portal" section, project layout                                       |

The admin refactors are covered by the existing admin suites, which all still pass.

---

## 7. Testing

```bash
npx vitest run
npx tsc --noEmit
```

Latest result: **17 files, 246 tests passed** (187 pre-existing + 59 for this feature); typecheck
clean.

| Suite                                  | Tests | Covers                                                                                                    |
| -------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------- |
| `tests/fe-web-auth.test.ts`            | 22    | Login success/profile; no token or hash in body; cookie flags and name; `fe_web` scope; device binding untouched (bound and unbound); wrong password / unknown user / admin credentials / bad body; `/me` with cookie, without, via Bearer, expired, deleted FE; scope isolation against mobile and admin APIs; mobile token still works; logout |
| `tests/fe-web-portal.test.ts`          | 11    | Anonymous redirect; shell never sent anonymously; forged cookie; shell + `no-store` when signed in; admin session can't open `/fe` and FE session can't open `/admin`; login page; signed-in bounce; assets (own + shared admin); asset 404; CSP |
| `tests/fe-web-portal-menu.test.ts`     | 7     | Menu is exactly Profile then Cases; lands on Profile; route lookup and unknown-route fallback; required fields; unique routes; real icons; one unlabelled section |
| `tests/fe-web-profile.test.ts`         | 8     | Requires web session; mobile token rejected; `mobileDevice: null` when unbound; device from a real mobile login; only the seven known fields (extra stored keys not echoed); unreadable JSON still shows `deviceId`; blank/non-string values become `null`; no password hash, raw `device_details` or `uniqueId` |
| `tests/fe-web-login-rate-limit.test.ts`| 2     | 10 × 401 then 429; admin login unaffected by exhausted FE window                                          |
| `tests/fe-web-cases.test.ts`           | 9     | Requires web session; mobile token rejected; three groups in order, no New; exactly this FE's components per bucket (checked against the DB); another FE never sees them; status labels match `dropdown_options`; TAT/updated ordering; no phones, GPS or detections in the payload; no accept route |

It was also smoke-tested against a real server on a throwaway database: anonymous redirect, login
page, wrong password, login, shell, `/me`, web token rejected by `/api/v1/me`, logout, and redirect
after logout all behaved as expected. The cases call was checked the same way: `401` without a
session, and for `fe001` it returned 10 Pending, 7 Beyond TAT and 7 Completed (matching the seeded
data) with readable status labels.

**Browser check.** Both portals were driven in headless Chrome against a real server on a
throwaway database, with screenshots reviewed:

- FE sign-in lands on `/fe#/profile`; the drawer shows Profile (highlighted) and Cases, the account
  block reads "AV · Amit Verma · Field Agent", and the profile shows name, email, role and ID.
- **Mobile device, bound:** after a mobile login for `fe001` with an Android handset, Profile shows
  "Your account is linked to this phone." with Galaxy S25 · Samsung SM-S931B · Android 16 · app 1.0 ·
  device ID `e2eda104bcacf53b`.
- **Mobile device, not bound:** `fe002` (no mobile login on that database) sees "Not signed in to
  the FullScan mobile app yet." and the linking note.
- Clicking Cases goes to `#/cases`, highlights it, sets the tab title to
  `Cases · FullScan Field Executive`, and renders Pending 10, Beyond TAT 7, Completed 7 with matching
  row counts and no error.
- At phone width (400px) the drawer starts closed, opens from the menu button, and closes after
  choosing a menu item.
- `/fe#/not-a-page` falls back to Profile; Logout returns to `/fe/login`.
- **Admin Portal after the shared drawer/router change:** super admin lands on Cases with all five
  menu items under Operations, Configuration and Administration, the account block reads
  "Ravi Menon · super admin", and navigating to Mobile App Settings works.
- No JavaScript errors in either portal (the only console error is the pre-existing missing
  `/favicon.ico`).

---

## 8. Running it

```bash
npm run dev
```

Open `http://localhost:3000/fe` (or your `PORT`). Sign in with any seeded FE: `fe001` … `fe051`,
password `Password123!`.

---

## 9. Security posture & known limits

**In place:** bcrypt password check; timing-equalised, non-enumerating failures; web-scoped tokens
isolated from mobile and admin in every direction; device binding preserved for the mobile API;
httpOnly + `SameSite=Strict` + (production) `Secure` cookie; token never exposed to JavaScript or
response bodies; server-side page guarding; per-portal login rate limiting; strict CSP; HTML escaping;
open-redirect protection; `no-store` on portal HTML; no password or token in logs.

**Known limits:**

- `field_executives` has no active/disabled flag, so an FE account cannot be deactivated; only a
  deleted account loses its web session early.
- The Profile page cannot show **when** the phone was linked or last used: the server stores the
  device binding but no timestamp for it. The app version shown is the one reported at that first
  mobile login, not necessarily what is installed now.
- JWTs are stateless: there is no server-side session revocation beyond deleting the account.
- No password change/reset or MFA for FEs (same as mobile).
- Same development-server caveats as the Admin Portal: default `JWT_SECRET`, wildcard `cors()`.
  See `ADMIN_PORTAL.md` §14.

---

## 10. Open question: case work on the web

> **Update:** a read-only case detail endpoint and web evidence upload now exist, used by the React
> app at `/app`. Web uploads are a deliberate, recorded exception to camera-only evidence — see
> [`field-executive-web-app.md`](field-executive-web-app.md). Changing a case's status from the web is
> still not built.

The portal now shows an FE's profile and read-only lists of their cases. Going further (opening a
case's details, or working on a case from the web) needs a product decision first, because the mobile
workflow's rules are hard to meet in a browser:

- Evidence must be **camera-only** (no gallery or file picker), with **GPS, timestamp and watermark**.
- Mock-location detection and geofence checks rely on native device APIs.
- The mobile case routes assume a device-bound session, which web tokens intentionally cannot use.

The read-only case lists follow the intended pattern: new `/api/v1/fe-web/*` routes guarded by
`authenticateFeWeb`, rather than opening the mobile routes to web tokens. A read-only case detail
view would be the natural next step in the same style; anything that changes a case should wait for
that decision.

---

## 11. File manifest

### New — server

| File                                      | Purpose                                                        |
| ----------------------------------------- | -------------------------------------------------------------- |
| `src/types/fe-web-auth.types.ts`          | Web login input/result and `fe_web` JWT payload types          |
| `src/services/fe-web-auth.service.ts`     | Credential check, web token issue/verify                       |
| `src/controllers/fe-web-auth.controller.ts` | login / logout                                               |
| `src/middleware/authenticate-fe-web.ts`   | `authenticateFeWeb` (API) + `authenticateFeWebPage` (pages)    |
| `src/routes/fe-web-auth.routes.ts`        | `/api/v1/fe-web/auth/*`                                        |
| `src/routes/fe-web-portal.routes.ts`      | `/fe` pages, assets, CSP                                       |
| `src/utils/fe-web-session-cookie.ts`      | `fs_fe_session` read / set / clear                             |
| `src/utils/session-cookie.ts`             | Shared cookie helpers (admin + FE web)                         |
| `src/utils/password.ts`                   | Shared timing-equalised `verifyPassword()`                     |
| `src/middleware/login-rate-limit.ts`      | Shared `createLoginRateLimit()` factory                        |
| `src/middleware/portal-csp.ts`            | Shared portal Content-Security-Policy                          |
| `src/types/fe-web-case.types.ts`          | Web case summary, group and list types                         |
| `src/services/fe-web-case.service.ts`     | Groups the FE's cases, resolves status labels, sorts           |
| `src/controllers/fe-web-case.controller.ts` | `getMyCases`                                                 |
| `src/routes/fe-web-case.routes.ts`        | `/api/v1/fe-web/cases`                                         |
| `src/types/fe-web-profile.types.ts`       | Web profile and mobile device types                            |
| `src/services/fe-web-profile.service.ts`  | Profile + bound device, with defensive `device_details` parsing |
| `src/controllers/fe-web-profile.controller.ts` | `getMyProfile`                                            |
| `src/routes/fe-web-profile.routes.ts`     | `/api/v1/fe-web/profile`                                       |

### New — portal & tests

| File                                          | Purpose                          |
| --------------------------------------------- | -------------------------------- |
| `public/fe/login.html`                        | Login page                       |
| `public/fe/index.html`                        | Signed-in shell                  |
| `public/fe/assets/css/fe.css`                 | FE-specific styles               |
| `public/fe/assets/js/{api,login,app,menu}.js` | Portal modules + drawer menu registry |
| `public/fe/assets/js/pages/{profile,cases}.js` | Drawer pages                    |
| `tests/fe-web-auth.test.ts`                   | 22 auth tests                    |
| `tests/fe-web-portal.test.ts`                 | 11 portal/guard tests            |
| `tests/fe-web-login-rate-limit.test.ts`       | 2 throttling tests               |
| `tests/fe-web-cases.test.ts`                  | 9 case-list tests                |
| `tests/fe-web-portal-menu.test.ts`            | 7 drawer menu registry tests     |
| `tests/fe-web-profile.test.ts`                | 8 profile / mobile device tests  |

### Modified

See [§6](#6-changes-to-existing-behaviour).
