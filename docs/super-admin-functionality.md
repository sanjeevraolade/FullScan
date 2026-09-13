# Super Admin Functionality — Implementation Notes

This document describes the two admin roles in **FullScanServer**'s Admin Portal (`/admin`): what
each role can do, how the server enforces it, and the pages built for it. Those pages are **Add New
Case** and **Add New Admin**, which also manages existing admins: promote or demote, deactivate or
reactivate, and delete.

It builds on [`ADMIN_PORTAL.md`](./ADMIN_PORTAL.md), which covers authentication, the drawer, and the
Cases, Field Executive History and Mobile App Settings pages. **No file in `FullScanApp` was
modified.** Admin work is back-office only; the mobile app is unaffected.

---

## Table of contents

1. [Role matrix](#1-role-matrix)
2. [What was built](#2-what-was-built)
3. [How roles are enforced](#3-how-roles-are-enforced)
4. [Drawer and routing](#4-drawer-and-routing)
5. [Add New Case](#5-add-new-case)
6. [Add New Admin (with email)](#6-add-new-admin-with-email)
7. [Managing admins — role, deactivate, delete](#7-managing-admins--role-deactivate-delete)
8. [API reference](#8-api-reference)
9. [Database — migration 020](#9-database--migration-020)
10. [Testing](#10-testing)
11. [Trying it out](#11-trying-it-out)
12. [Known limits and decisions](#12-known-limits-and-decisions)
13. [File manifest](#13-file-manifest)

---

## 1. Role matrix

| Drawer item                 | Section        | `super_admin` | `admin` |
| --------------------------- | -------------- | :-----------: | :-----: |
| **Mobile App Settings**     | Configuration  |      ✅       |   ❌    |
| **Cases**                   | Operations     |      ✅       |   ✅    |
| **Field Executive History** | Operations     |      ✅       |   ✅    |
| **Add New Case**            | Operations     |      ✅       |   ✅    |
| **Add New Admin**           | Administration |      ✅       |   ❌    |

The **Add New Admin** page covers everything to do with admin accounts:

| Action on another admin                      | `super_admin` | `admin` |
| -------------------------------------------- | :-----------: | :-----: |
| Add a new admin or super admin by email      |      ✅       |   ❌    |
| Promote an admin to super admin              |      ✅       |   ❌    |
| Demote a super admin to admin                |      ✅       |   ❌    |
| Deactivate / reactivate                      |      ✅       |   ❌    |
| Delete permanently                           |  ✅ ¹         |   ❌    |
| Any of the above **on their own account**    |      ❌ ²     |   ❌    |

¹ Only for accounts with no audit history. See [§7.3](#73-delete).
² A super admin can never demote, deactivate or delete themselves. See [§7.4](#74-there-is-always-an-active-super-admin).

The drawer an admin sees:

```text
OPERATIONS
  Cases
  Field Executive History
  Add New Case
```

The drawer a super admin sees:

```text
OPERATIONS
  Cases
  Field Executive History
  Add New Case
CONFIGURATION
  Mobile App Settings
ADMINISTRATION
  Add New Admin
```

A section is left out when a role can see none of its entries.

---

## 2. What was built

| Requirement                                    | Delivered                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Super admin: Mobile App Settings               | Existing page, now `roles: ['super_admin']` in the drawer **and** `requireAdminRole('super_admin')` on its API |
| Super admin & admin: Cases                     | Existing page, open to both roles                                                                      |
| Super admin & admin: Field Executive History    | Existing page, open to both roles                                                                      |
| Super admin & admin: Add New Case              | **New drawer item** `#/new-case`, which reuses the Cases editor in create-only mode                    |
| Super admin: Add New Admin with email          | **New drawer item** `#/admin-users`, plus `GET`/`POST /api/v1/admin/admin-users`                       |
| Super admin can create another super admin     | Role select on the add form (defaults to *Admin*)                                                      |
| Promote an existing admin to super admin (and back) | **Make super admin** / **Make admin** row actions → `PATCH /admin-users/:id { role }`             |
| Deactivate admin                               | **Deactivate** / **Reactivate** row actions → `PATCH /admin-users/:id { isActive }`                    |
| Delete admin                                   | **Delete** row action → `DELETE /admin-users/:id`, refused when the account has audit history          |
| New admins can sign in                         | Login accepts a **username or an email**. New admins sign in with their email and a one-time temporary password |
| Admin cannot reach super-admin pages           | Enforced server-side (`403`). The drawer hides the pages, and the router refuses them                  |
| Email server configuration                     | **Deferred** — see [§12](#12-known-limits-and-decisions)                                               |

**Zero new npm dependencies.** Password generation uses Node's `crypto.randomInt`. Hashing uses
`bcryptjs` and ids use `uuid`, both of which the server already had.

---

## 3. How roles are enforced

### 3.1 The server is the boundary

Hiding a drawer item is presentation, not security. Every super-admin-only feature is guarded in
`src/app.ts`:

```ts
const requireSuperAdmin = requireAdminRole('super_admin');

app.use('/api/v1/admin/auth', adminAuthRoutes);
app.use('/api/v1/admin/mobile-app-settings', authenticateAdmin, requireSuperAdmin, mobileAppSettingRoutes);
app.use('/api/v1/admin/cases', authenticateAdmin, adminCaseRoutes);
app.use('/api/v1/admin/field-executives', authenticateAdmin, adminFieldExecutiveRoutes);
app.use('/api/v1/admin/admin-users', authenticateAdmin, requireSuperAdmin, adminUserRoutes);
```

`requireAdminRole(...roles)` lives in `src/middleware/authenticate-admin.ts`. It runs **after**
`authenticateAdmin` and answers:

```json
403 { "success": false, "error": "Your admin role does not have access to this feature" }
```

- **403, not 404.** The caller is a signed-in admin, and the portal already tells them the page
  exists for someone else. There is nothing to hide.
- **The role check runs before body validation.** An admin sending a malformed request gets `403`,
  not `400`. Validation errors would otherwise describe a request the caller may not make at all.
- **Guarded at the mount, not per route.** Every method on `/admin-users`, including `GET`, `POST`,
  `PATCH` and `DELETE`, and both methods on settings, are covered by one line each. A route added to
  those routers later is covered automatically.

### 3.2 Role and status are read from the database on every request

`verifyAdminToken()` re-reads the admin row on every request and rejects the token if the account
has been deleted or deactivated. It also takes **`role` from that row rather than from the token**:

```ts
if (!row || row.is_active !== 1) {
  return undefined;
}
return { ...payload, role: row.role };
```

That makes every account change in §7 **take effect on the affected admin's very next request**, with
no sign-out or new sign-in:

| Change                  | The affected admin's existing session…                                   |
| ----------------------- | ------------------------------------------------------------------------ |
| Promoted to super admin | can open Mobile App Settings and Add New Admin at once (after a reload, the drawer shows them) |
| Demoted to admin        | gets `403` on those APIs at once                                         |
| Deactivated             | gets `401` on every admin API, and the portal sends them to the login page |
| Deleted                 | the same as deactivated, and signing in again gets `401`                 |

It costs nothing extra, because the row was already being read.

### 3.3 Which APIs are shared

`Add New Case` uses the existing `POST /api/v1/admin/cases`, and the Cases and Field Executive History
pages use their existing endpoints. All of these stay open to **both** roles, with every business rule
from `ADMIN_PORTAL.md` §9.4 unchanged.

---

## 4. Drawer and routing

### 4.1 Registry changes (`public/admin/assets/js/menu.js`)

| Entry id                  | Route                     | Label                   | Section        | `roles`           |
| ------------------------- | ------------------------- | ----------------------- | -------------- | ----------------- |
| `cases`                   | `cases`                   | Cases                   | Operations     | —                 |
| `field-executive-history` | `field-executive-history` | Field Executive History | Operations     | —                 |
| `new-case`                | `new-case`                | Add New Case            | Operations     | —                 |
| `mobile-app-settings`     | `mobile-app-settings`     | Mobile App Settings     | Configuration  | `['super_admin']` |
| `admin-users`             | `admin-users`             | Add New Admin           | Administration | `['super_admin']` |

Two new icons were added to `icons.js`: `plus` and `userPlus`.

### 4.2 A redirect loop that role gating would have caused

The router falls back to a default route when the hash is empty or names a page the role cannot open.
That default used to be `ADMIN_MENU[0].route`, the first entry **regardless of role**. If that entry
were ever super-admin-only, an admin would be redirected to it, fail to resolve it, and be redirected
again, forever.

`menu.js` now exports `getDefaultRoute(role)`: the first entry **that role can see**. The router uses
it for both fallbacks. Today both roles land on Cases, but the guarantee no longer depends on
registry order. A test puts a super-admin-only entry first and checks that an admin still lands on
Cases.

If an admin types `#/mobile-app-settings` or `#/admin-users` into the address bar, they are sent back
to Cases, and even the page's API call would get `403`.

---

## 5. Add New Case

`#/new-case` → `pages/new-case.js` → `renderNewCase()` in `pages/cases.js`.

**Reused, not duplicated.** Add New Case is the Cases page's own editor, mounted blank and on its own
route. It has the same form (case card plus one card per component), the same client-side checks, and
the same `POST /api/v1/admin/cases`, with the same server rules: unique case reference, at least one
component, status codes validated against `dropdown_options`, assignee validated against the roster,
and a single transaction.

`cases.js` now mounts in one of two modes:

| Mode                    | Entry point        | Starts on      | After a successful save                                   | Back / Cancel          |
| ----------------------- | ------------------ | -------------- | --------------------------------------------------------- | ---------------------- |
| Cases (`list`)          | `render()`         | the case list  | returns to the list with a success message                | returns to the list    |
| Add New Case (`create`) | `renderNewCase()`  | a blank editor | **resets to a blank form**, scrolls to the top, and confirms `Case X created with N components` | navigates to `#/cases` |

Staying on a fresh form after saving suits entering several cases in a row. The **New case** button on
the Cases list is now a link to `#/new-case`, so there is exactly one way to create a case. Opening a
row on the Cases list still edits that case in place.

The two page modules share one `cases.js` module instance, which is safe: the router always runs the
outgoing page's `destroy()` before the next `render()`, and `mount()` rebuilds the module state from
scratch.

---

## 6. Add New Admin (with email)

`#/admin-users` → `pages/admin-users.js`. **Super admin only.**

The page has three parts, top to bottom: a one-time **sign-in details** card (after an admin has just
been added), the **New admin** form, and the **Admin accounts** table with its row actions ([§7](#7-managing-admins--role-deactivate-delete)).

### 6.1 The flow

1. The super admin enters a **full name**, an **email address** and a **role**. The role is *Admin* or
   *Super admin*, defaults to *Admin*, and the hint under the select spells out what each can access.
2. The portal checks the name (at least 2 characters) and the email format before sending anything.
   The server re-validates everything.
3. `POST /api/v1/admin/admin-users` creates the account:
   - the **email is trimmed, lower-cased and used as the username**, so the email *is* the sign-in;
   - a **16-character temporary password** is generated from a cryptographically secure source;
   - only its **bcrypt hash** (cost 10, as for the seeded admins) is stored;
   - `created_by` records the super admin who added the account.
4. The page shows a **sign-in details card**: portal address, sign-in email, role and the temporary
   password, with **Copy password** and **Done** buttons. It warns that the password is shown only
   this once.
5. The new account appears in the **Admin accounts** table.

On a failure (for example a duplicate email, `409`) the form is **left as typed**, the email field is
marked invalid, and the error appears in the page alert.

### 6.2 Sign-in by email

`POST /api/v1/admin/auth/login` still takes `{ username, password }`, but `username` may now be
**either a username or an email** (matched case-insensitively):

```sql
SELECT * FROM admin_users
WHERE username = @identifier OR email = @identifier COLLATE NOCASE
ORDER BY username = @identifier DESC   -- an exact username match wins
LIMIT 1
```

- New admins sign in with their email. Seeded admins can use either `admin002` or
  `priya.nair@fullscan.test`.
- Every existing guarantee is kept: an unknown account and a wrong password get the same `401 Invalid
  username or password`, with the timing equalised against a dummy hash; a deactivated account gets
  `403`; the 10-failures-per-15-minutes throttle is unchanged.
- The login form's label now reads **Username or email**, and it accepts up to 254 characters.

### 6.3 Server-side rules for adding

| Rule                                                              | Where                          | Answer |
| ----------------------------------------------------------------- | ------------------------------ | ------ |
| Caller must be a signed-in super admin                            | `requireAdminRole` in `app.ts` | `401` / `403` |
| `name` 2–100 characters (trimmed)                                  | `admin.schema.ts` (zod)        | `400`  |
| `email` must be a valid email, at most 254 characters              | `admin.schema.ts` (zod)        | `400`  |
| `role` must be `admin` or `super_admin`; defaults to `admin`       | `admin.schema.ts` (zod)        | `400`  |
| **No other fields**: the caller cannot choose a password or id      | `.strict()` schema             | `400`  |
| Email not already used as any admin's email **or username**, ignoring case | `admin-user.service.ts` + unique index | `409` |

An email can be reused once the account holding it has been **deleted**, but not while it is merely
deactivated.

### 6.4 The temporary password

`generateTemporaryPassword()` in `src/services/admin-user.service.ts`:

- **16 characters**, each drawn with `crypto.randomInt` (a CSPRNG, not `Math.random`);
- **at least one** uppercase letter, lowercase letter, digit and symbol (`@#$%&*!?`), then shuffled
  with Fisher–Yates;
- **no look-alike characters** (`0 O 1 l I`), because it is read off a screen and typed by hand.

It is returned **once**, in the `201` response, and never logged. The page drops it from memory on
**Done**, when the admin leaves the page, or when that account is deleted.

---

## 7. Managing admins — role, deactivate, delete

Every row in the **Admin accounts** table has three actions, except the signed-in super admin's own
row, which shows **You** and no actions:

| Button                              | Asks first? | Request                                               |
| ----------------------------------- | :---------: | ----------------------------------------------------- |
| **Make super admin** / **Make admin** |   yes      | `PATCH /admin-users/:id` with `{ "role": "super_admin" }` or `{ "role": "admin" }` |
| **Deactivate**                      |    yes      | `PATCH /admin-users/:id` with `{ "isActive": false }` |
| **Reactivate**                      |    no ¹     | `PATCH /admin-users/:id` with `{ "isActive": true }`  |
| **Delete**                          |    yes      | `DELETE /admin-users/:id`                             |

¹ Reactivating only restores access the person already had, so it runs straight away.

Each confirmation says exactly what will happen. For example: *"Make Kavya Reddy a super admin?
They will be able to change Mobile App Settings and add, promote, deactivate or delete admins —
including you."*

While an action runs, that row's buttons are disabled. Afterwards the account list is reloaded (even
after an error, in case another super admin already changed it), the result appears in the page alert,
and focus returns to the same button. Only the **table** is repainted, so a half-filled New admin form
or an unread sign-in details card survives. Every action button has an accessible name that includes
the admin's name, for example "Deactivate — Kavya Reddy".

### 7.1 Promote / demote

- Any admin can be made a super admin, and any other super admin can be made an admin.
- The change applies on that admin's next request ([§3.2](#32-role-and-status-are-read-from-the-database-on-every-request)).
- A newly promoted super admin can immediately manage other admins in turn.

### 7.2 Deactivate / reactivate

- **Deactivate** is the normal way to remove someone's access. Their **session stops working at
  once**: the next admin API call gets `401`, so the portal sends them to the login page. Signing in
  again gets `403 This admin account has been deactivated`.
- **Nothing is lost.** Their name stays on the settings they changed and the admins they added, and
  the row stays in the table as *Deactivated*.
- **Reactivate** restores access with the same email and password.
- Role and status can be changed together in one request (for example demote and deactivate).

### 7.3 Delete

Delete **permanently removes** the account: the row is gone, any session dies at once, signing in gets
`401`, and the email becomes free to use for a new admin.

**Delete is refused when the account is part of the audit trail.** Two tables point at `admin_users`
through foreign keys:

| Reference                          | Meaning                                         |
| ---------------------------------- | ----------------------------------------------- |
| `mobile_app_settings.updated_by`   | this admin made the latest change to a setting  |
| `admin_users.created_by`           | this admin added another admin                  |

Deleting such an account would either fail on the foreign key or require erasing who did what. So the
server answers `409` with a message naming the history and pointing to the alternative:

```
Meera Iyer last changed 2 mobile app settings and added 1 admin, so deleting the account would
erase that audit history. Deactivate it instead.
```

In practice, **delete** is for accounts that did nothing (added by mistake, never used) and
**deactivate** is for everyone else. `updated_by` holds only the *latest* change per setting, so once
another admin changes those settings the reference moves and delete becomes possible.

### 7.4 There is always an active super admin

A super admin **cannot demote, deactivate or delete their own account**. The server answers `409 You
cannot change your own role, deactivate or delete your own account. Ask another super admin.`, and the
portal does not offer those buttons on their row.

That one rule is what guarantees the portal can never be left without an active super admin:

- only an active super admin can change accounts, because the route requires one and status is read
  live;
- whatever they do to other accounts, **they themselves remain** an active super admin.

No separate "last super admin" counter is needed. For example, with super admins A and B, A demotes B.
B is now an admin and gets `403` trying to touch A, and A cannot demote themselves, so A remains.
A test walks exactly this sequence.

### 7.5 Server-side rules for managing

| Rule                                                            | Answer |
| --------------------------------------------------------------- | ------ |
| Caller must be a signed-in super admin                          | `401` / `403` |
| Target admin must exist                                         | `404`  |
| Target must not be the caller                                   | `409`  |
| `PATCH` body: at least one of `role` (`admin`\|`super_admin`) and `isActive` (boolean), no other fields | `400`  |
| `DELETE`: target has no audit references                        | `409`  |

Every change is logged with the acting super admin's id, the target's id, and the role/status sent.
No names, emails or passwords are logged.

---

## 8. API reference

All responses use the server's standard `{ success, data }` / `{ success, error }` envelope. Every
`/admin-users` endpoint is **super admin only**.

### `GET /api/v1/admin/admin-users`

```jsonc
{
  "success": true,
  "data": [
    {
      "id": "admin-001",
      "username": "admin001",
      "name": "Ravi Menon",
      "email": "ravi.menon@fullscan.test",
      "role": "super_admin",
      "lastLoginAt": "2026-09-13 07:10:02",
      "isActive": true,
      "createdAt": "2026-09-03 13:56:27",
      "createdBy": null            // seeded by migration
    }
  ]
}
```

Ordered super admins first, then active before deactivated, then by name. No password hash in any
form.

### `POST /api/v1/admin/admin-users`

```jsonc
// request — role optional, defaults to "admin"
{ "name": "Kavya Reddy", "email": "Kavya.Reddy@FullScan.test", "role": "admin" }

// 201
{
  "success": true,
  "data": {
    "adminUser": {
      "id": "admin-3f0c…", "username": "kavya.reddy@fullscan.test", "name": "Kavya Reddy",
      "email": "kavya.reddy@fullscan.test", "role": "admin", "lastLoginAt": null,
      "isActive": true, "createdAt": "2026-09-13 07:12:44", "createdBy": "admin-001"
    },
    "temporaryPassword": "pX7#kQm2@vRt9sHa"   // shown once, never retrievable again
  }
}
```

| Status | Cause                                                               |
| ------ | ------------------------------------------------------------------- |
| `400`  | Validation failed: bad email, short name, unknown role, extra field |
| `401`  | No or invalid admin session                                         |
| `403`  | Signed in, but not a super admin                                    |
| `409`  | `An admin with this email already exists`                           |

### `PATCH /api/v1/admin/admin-users/:adminUserId`

```jsonc
// promote
{ "role": "super_admin" }
// demote
{ "role": "admin" }
// deactivate / reactivate
{ "isActive": false }
{ "isActive": true }
// both at once
{ "role": "admin", "isActive": false }

// 200 — the updated account, same shape as a GET list entry
{ "success": true, "data": { "id": "admin-3f0c…", "role": "super_admin", "isActive": true, /* … */ } }
```

| Status | Cause                                                                  |
| ------ | ---------------------------------------------------------------------- |
| `400`  | Empty body, unknown role, non-boolean `isActive`, or any other field    |
| `401`  | No or invalid admin session                                            |
| `403`  | Signed in, but not a super admin                                       |
| `404`  | `Admin user not found`                                                 |
| `409`  | The target is the caller's own account                                  |

### `DELETE /api/v1/admin/admin-users/:adminUserId`

```jsonc
// 200
{ "success": true, "data": { "deleted": true, "id": "admin-3f0c…" } }
```

| Status | Cause                                                                  |
| ------ | ---------------------------------------------------------------------- |
| `401`  | No or invalid admin session                                            |
| `403`  | Signed in, but not a super admin                                       |
| `404`  | `Admin user not found`                                                 |
| `409`  | The target is the caller's own account, **or** it has audit history (the message says to deactivate instead) |

### Changed: `GET` / `PUT /api/v1/admin/mobile-app-settings`

These are now **super admin only**, and an admin gets `403`. The request and response shapes are
unchanged. Settings still reach the mobile app on `GET /api/v1/reference-data`, which is untouched.

### Changed: `POST /api/v1/admin/auth/login`

`username` accepts a username **or** an email, up to 254 characters. Everything else is unchanged.

---

## 9. Database — migration 020

`src/db/migrations/020_add_admin_user_management.sql`:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email COLLATE NOCASE);
ALTER TABLE admin_users ADD COLUMN created_by TEXT REFERENCES admin_users(id);
```

| Change                       | Why                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| Unique `NOCASE` email index  | The email is now a sign-in identifier, so two accounts must never share one, in any letter case |
| `created_by` column          | An audit trail of which super admin added an account (`NULL` for seeded admins). Also one of the references that blocks deleting an account ([§7.3](#73-delete)) |

Promote, demote, deactivate and delete needed **no schema change**. They use the existing `role` and
`is_active` columns and stamp the existing `updated_at`.

It applies automatically on the next `npm run dev` / `npm start`. `npm run build` copies it into
`dist/` like the others.

**Verified against a copy of the real dev database** (`data/fullscan.sqlite` with its WAL files, in a
scratch directory). It upgraded from `019` cleanly, and the four seeded admins got `created_by = NULL`
with their data intact. The seeded emails were already distinct, so creating the unique index cannot
fail on existing data.

---

## 10. Testing

`npx vitest run` → **187 tests across 11 files, all passing** (140 before this work). `npx tsc
--noEmit` is clean, and the portal ES modules parse-check under `tsc --allowJs`.

| Suite                                  | Tests  | Covers |
| -------------------------------------- | ------ | ------ |
| `super-admin.test.ts` **(new)**        | 42     | See the breakdown below |
| `admin-portal-menu.test.ts` (updated)  | 23 (+5) | Every route resolves for a super admin; exact visible entries per role; admin cannot resolve Mobile App Settings or Add New Admin; an unknown role sees only unrestricted pages; **each role's default route is one it can open**; **a restricted first entry never becomes an admin's fallback** (the loop guard); section grouping per role, including dropping empty sections |

`super-admin.test.ts` in detail:

| Area                     | What is asserted |
| ------------------------ | ---------------- |
| **Role access**          | Super admin reads/writes settings and reaches cases, form options, roster and the admin list. Admin gets `403` on settings read and write, and nothing is written; `403` comes before body validation; `403` on the admin list and on adding an admin (incl. trying to add a super admin), and no row is written; admin can view cases, form options, roster and one executive's history, and **can create a case** (`201`) |
| **Live role changes**    | A signed-in admin promoted directly in the DB gains access on the next request and loses it again when demoted |
| **List**                 | Auth required; super admins first; no password or bcrypt hash anywhere; `isActive`/`createdBy` on seeded rows |
| **Add**                  | Auth required; trims and lower-cases the email, username = email, defaults role to `admin`, stamps `createdBy`; stores only a bcrypt hash that verifies the returned password; **new admin signs in with the email in any case** and has admin-only access; a created super admin has super admin access; appears in the list; duplicate email in a different case → `409`; bad email / short name / unknown role / missing name → `400`; **caller-chosen password rejected** |
| **Temporary password**   | Length, every character class, no look-alikes (50 samples), no repeats |
| **Sign-in by email**     | Seeded admin by email; generic `401` on a wrong password; deactivated admin still `403` |
| **Promote / demote**     | **Promote takes effect on the target's existing session** (settings and admin list open up); **demote takes effect on the existing session** (settings `403`, cases still `200`); a promoted super admin can manage others |
| **Deactivate / reactivate** | Deactivated admin's **session gets `401` immediately** and sign-in gets `403`; reactivated admin can sign in again with the same password; role + status in one request |
| **Management refusals**  | Admin `403` and anonymous `401`, with the row unchanged; **self-demote and self-deactivate `409`**, with the row unchanged; **the A-demotes-B, B-cannot-touch-A sequence always leaves an active super admin**; unknown id `404`; empty body / unknown role / non-boolean status / other fields `400` |
| **Delete**               | **Deletes an account with no history**: gone from the DB and the list, session `401`, sign-in `401`, **email reusable**; **refused (`409`, "Deactivate it instead") after the target changed a mobile app setting**, and deactivating it then works; **refused after the target added an admin**; self-delete `409`; admin `403`, anonymous `401`; unknown id `404` |

Every pre-existing suite passes unchanged. `mobile-app-settings.test.ts`, `admin-cases.test.ts` and
the others sign in as `admin001`, the seeded super admin, so their access is unaffected. The test
helper gained `SEEDED_REGULAR_ADMIN` (`admin002`). Management tests create their own throwaway admins
rather than altering seeded rows.

> One early run showed a single `socket hang up` in the pre-existing `admin-cases.test.ts`. It passed
> when rerun alone and in every full run since. It is a transient supertest socket error, not an
> assertion failure, on a path these changes do not alter.

---

## 11. Trying it out

```bash
cd FullScanServer
npm run dev          # migration 020 applies on startup
```

Open **<http://localhost:3000/admin>**.

| Sign in as                                 | Password     | Role          | Drawer shows |
| ------------------------------------------ | ------------ | ------------- | ------------ |
| `admin001` or `ravi.menon@fullscan.test`   | `Admin@123!` | `super_admin` | all five pages |
| `admin002` or `priya.nair@fullscan.test`   | `Admin@123!` | `admin`       | Cases, Field Executive History, Add New Case |

Walkthrough:

1. Sign in as `admin001` → **Add New Admin** → add `Kavya Reddy` / `kavya.reddy@fullscan.test` →
   copy the temporary password.
2. In a private window, sign in as `kavya.reddy@fullscan.test`. The drawer shows only the three admin
   pages, and typing `#/mobile-app-settings` returns you to Cases.
3. Back as `admin001`, click **Make super admin** on Kavya's row. Reload Kavya's window: the drawer
   now shows all five pages.
4. Click **Deactivate** on Kavya's row. Kavya's next click sends her to the login page, where signing
   in is refused. **Reactivate** lets her back in.
5. **Delete** Kavya: it works if she hasn't changed a setting or added an admin. If she has, you are
   told to deactivate instead.
6. **Add New Case** → create a case → the form resets for the next one.

From the API:

```bash
curl -c jar -X POST localhost:3000/api/v1/admin/auth/login \
  -H 'Content-Type: application/json' -d '{"username":"admin001","password":"Admin@123!"}'

# add
curl -b jar -X POST localhost:3000/api/v1/admin/admin-users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Kavya Reddy","email":"kavya.reddy@fullscan.test","role":"admin"}'

# promote / deactivate / delete  (use the id from the add response)
curl -b jar -X PATCH  localhost:3000/api/v1/admin/admin-users/<id> \
  -H 'Content-Type: application/json' -d '{"role":"super_admin"}'
curl -b jar -X PATCH  localhost:3000/api/v1/admin/admin-users/<id> \
  -H 'Content-Type: application/json' -d '{"isActive":false}'
curl -b jar -X DELETE localhost:3000/api/v1/admin/admin-users/<id>

# an admin is refused Mobile App Settings
curl -c jar2 -X POST localhost:3000/api/v1/admin/auth/login \
  -H 'Content-Type: application/json' -d '{"username":"priya.nair@fullscan.test","password":"Admin@123!"}'
curl -b jar2 localhost:3000/api/v1/admin/mobile-app-settings     # → 403
```

---

## 12. Known limits and decisions

**Email server configuration — deferred (planned).** "Add New Admin with email" currently means the
email *identifies* the new admin and is their sign-in. The server has no mail transport yet, so the
temporary password is shown to the super admin to pass on. When the email server is configured, the
natural change is an emailed invite link carrying a single-use, expiring token. `POST /admin-users`
would keep its request shape and stop returning `temporaryPassword`, and the sign-in details card
would become an "invite sent" confirmation.

**No forced password change or password reset yet.** A new admin can keep using the temporary
password, and the super admin who saw it could in principle sign in as them. There is also no way to
reset a forgotten password other than deleting and re-adding the account (only possible without audit
history). A `must_change_password` flag, a change-password page and a super-admin "reset password"
action belong with the email work above.

**Delete is deliberately conservative.** An account referenced by the audit trail cannot be deleted,
only deactivated ([§7.3](#73-delete)). A deactivated account also keeps its email reserved, so that
address cannot be reused for a different person while the old account exists.

**Self-management is refused, even for harmless changes.** A super admin cannot change their own role
or status at all. This is what guarantees an active super admin always exists ([§7.4](#74-there-is-always-an-active-super-admin));
someone else must make changes to your account.

**Confirmations use the browser's native dialog** (`window.confirm`). It is accessible and allowed by
the portal's strict CSP. A styled in-page dialog could replace it later without changing the API.

**Audit of account changes is log-based.** Promote, demote, deactivate and delete are written to the
server log (acting admin id, target id, change) and stamp `updated_at`, but there is no history table
of account changes. Add one if the back office needs to answer "who deactivated this account, and
when?" from the portal.

**The drawer is not a security boundary.** `roles` in `menu.js` hides pages. `requireAdminRole` on
the server enforces access. Any new super-admin-only page needs **both**, and the comment block at
the top of `menu.js` says so.

---

## 13. File manifest

### New — server

| File                                                   | Purpose                                                         |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| `src/db/migrations/020_add_admin_user_management.sql`  | Unique case-insensitive email index; `created_by` audit column  |
| `src/services/admin-user.service.ts`                   | List, add by email (temporary password), update role/status, delete with audit-history and self-change guards |
| `src/controllers/admin-user.controller.ts`             | list / create / update / delete                                 |
| `src/routes/admin-user.routes.ts`                      | `GET`, `POST /api/v1/admin/admin-users`; `PATCH`, `DELETE /:adminUserId` |

### Modified — server

| File                                     | Change                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/app.ts`                             | `requireSuperAdmin` on Mobile App Settings; mount `/api/v1/admin/admin-users`        |
| `src/middleware/authenticate-admin.ts`   | New `requireAdminRole(...roles)` middleware (`403`)                                  |
| `src/services/admin-auth.service.ts`     | Login by username **or** email; role read from the live row; `toAdminUser` exported   |
| `src/db/admin-user.dao.ts`               | `findAdminUserByLogin`, `isAdminIdentifierTaken`, `listAdminUsers`, `insertAdminUser`, `updateAdminUser`, `countAdminAuditReferences`, `deleteAdminUser`; unused `findAdminUserByUsername` removed |
| `src/types/admin.types.ts`               | `ADMIN_ROLES`, `created_by`, `AdminUserSummary`, `CreateAdminUserInput`, `CreateAdminUserResult`, `UpdateAdminUserInput` |
| `src/routes/schemas/admin.schema.ts`     | `createAdminUserSchema`, `updateAdminUserSchema`, `deleteAdminUserSchema` (strict); login identifier up to 254 characters |

### New — portal

| File                                           | Purpose                                                       |
| ---------------------------------------------- | ------------------------------------------------------------- |
| `public/admin/assets/js/pages/new-case.js`     | Add New Case page — mounts the Cases editor in create-only mode |
| `public/admin/assets/js/pages/admin-users.js`  | Add New Admin page — form, one-time credentials card, admin table with promote/demote, deactivate/reactivate and delete actions |

### Modified — portal

| File                                      | Change                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| `public/admin/assets/js/menu.js`          | `new-case` and `admin-users` entries; `roles` on Mobile App Settings; `getDefaultRoute(role)`; role matrix in the header comment |
| `public/admin/assets/js/router.js`        | Role-aware default route (prevents a redirect loop)                        |
| `public/admin/assets/js/pages/cases.js`   | `renderNewCase()` / create-only mode; New case button links to `#/new-case` |
| `public/admin/assets/js/api.js`           | `listAdminUsers()`, `createAdminUser()`, `updateAdminUser()`, `deleteAdminUser()` |
| `public/admin/assets/js/icons.js`         | `plus`, `userPlus` icons                                                   |
| `public/admin/assets/css/admin.css`       | Card footer, success card, flush/static/actions table, row actions, small buttons, role badges, credential styling |
| `public/admin/login.html`, `assets/js/login.js` | "Username or email" label, 254-character limit, message wording        |

### Tests & docs

| File                                   | Change                                                  |
| -------------------------------------- | ------------------------------------------------------- |
| `tests/super-admin.test.ts`            | **New** — 42 role-access, add, promote/demote, deactivate/reactivate and delete tests |
| `tests/admin-portal-menu.test.ts`      | Updated for role gating; default-route loop guard (+5)   |
| `tests/helpers/test-app.ts`            | `SEEDED_REGULAR_ADMIN`                                   |
| `docs/super-admin-functionality.md`    | **New** — this document                                  |
| `docs/ADMIN_PORTAL.md`                 | Known-limits section updated to point here               |
| `README.md`                            | Endpoint table: super-admin-only settings; all four admin-users endpoints |
