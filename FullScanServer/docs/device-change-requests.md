# Device Change Requests — Implementation Notes

A field executive's (FE's) account is bound to one phone: the first phone they sign in to the FullScan
mobile app on. This feature lets an FE ask to move to another phone from the web portal, lets an admin
approve or reject that request, and keeps a permanent history of every request, decision and phone.

Related: [`field-executive-web-login.md`](./field-executive-web-login.md) (the FE web portal) and
[`ADMIN_PORTAL.md`](./ADMIN_PORTAL.md) (the admin portal).

---

## Table of contents

1. [What was built](#1-what-was-built)
2. [The flow](#2-the-flow)
3. [Rules](#3-rules)
4. [History: what is recorded, and never deleted](#4-history-what-is-recorded-and-never-deleted)
5. [Settings](#5-settings)
6. [API reference](#6-api-reference)
7. [Field executive web portal](#7-field-executive-web-portal)
8. [Admin portal](#8-admin-portal)
9. [Changes to existing behaviour](#9-changes-to-existing-behaviour)
10. [Testing](#10-testing)
11. [Known limits](#11-known-limits)
12. [File manifest](#12-file-manifest)

---

## 1. What was built

| Requirement                                          | Delivered                                                                                             |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| "Request device change" in the Mobile device section | FE web Profile → Mobile app device card → **Change device**: optional reason, then **Send request**    |
| Admin approves                                       | Admin portal → **Device Change Requests** (both admin roles): **Approve** / **Reject** (with optional note) |
| After approval, sign in on any phone, old one too    | Approval clears the account's binding; the next mobile login binds whichever phone it comes from     |
| History of request, approval and the new phone       | `device_change_requests` + `field_executive_devices`, shown to the FE (Profile) and admins (both pages) |
| Old login/device history never deleted               | Both tables are append-only in practice: requests are decided once, bindings are only ever closed      |
| Limit: max xx requests in yy days                    | `device_change_max_requests` (xx, default 2) and `device_change_window_days` (yy, default 30) in Mobile App Settings |

No new npm dependencies. One new migration: `021_create_device_change_requests.sql`.

---

## 2. The flow

```
 Mobile app               FE web portal                 Admin portal                Database
 ──────────               ─────────────                 ────────────                ────────
 login on Phone A ─────────────────────────────────────────────────────────────────▶ FE bound to A
                                                                                     history row A opened
                          Profile → Request device change
                          (reason optional) ───────────────────────────────────────▶ request: pending
                                                                                     (snapshot of Phone A)
 login on Phone B ─▶ 403 (still bound to A)
                                                        Approve ───────────────────▶ request: approved
                                                                                     history row A closed
                                                                                     FE binding cleared
 login on Phone B (or A) ──────────────────────────────────────────────────────────▶ FE bound to that phone
                                                                                     new history row, linked
                                                                                     to the approved request
                          Profile shows new phone,                                   
                          request + phone history       Approved tab shows "New phone"
```

A **rejected** request changes nothing about the binding: the FE keeps using their current phone.

---

## 3. Rules

**Who can request.** An FE whose account is currently bound to a phone. With no phone bound there is
nothing to change: the first mobile login binds any phone.

**One at a time.** An FE can have at most one pending request (checked by the service and enforced by
a unique partial index).

**The limit.** An FE may submit at most `device_change_max_requests` requests in any rolling
`device_change_window_days`-day window.

- **Every request counts**, whatever happens to it: pending, approved or rejected. The limit is on
  asking, so repeated rejected requests cannot be used to pester admins.
- The window is rolling, not calendar-based: it is "the last N days" at the moment of asking.
- When the limit is reached the FE is told when they can ask again: the time the oldest counted
  request leaves the window (if an admin lowers the limit below what an FE already used, it is the
  point at which enough requests have aged out).
- Changes to either setting apply immediately to the next check.

**Checking order.** No phone bound → pending request exists → limit reached. Only the first that
applies is reported.

**Approving** (either admin role):

1. Marks the request `approved` with the admin, time and optional note.
2. Closes the FE's current history row (`released_at`, reason `device_change_approved`, the request id).
3. Clears `field_executives.device_id` / `device_details`.

All in one transaction. From then on the FE can sign in to the mobile app on **any** phone, including
the one they had. That login binds the phone again and opens a new history row pointing at the
approved request, which is how admins and the FE see "the new phone" for that request.

**Rejecting** marks the request `rejected` with the admin, time and optional note. The note is shown
to the FE. The binding is untouched.

**A decision is final.** Approving or rejecting an already-decided request answers `409`. There is no
cancel, reopen or undo.

**Pending doesn't block the current phone.** While a request is pending the FE keeps using their bound
phone; a different phone is still refused until approval.

---

## 4. History: what is recorded, and never deleted

### `device_change_requests`

One row per request. Columns: `field_executive_id`, `status` (`pending` → `approved`/`rejected`, once),
`reason`, **`device_id` + `device_details` snapshot of the phone bound when asked**, `requested_at`,
`decided_at`, `decided_by` (admin), `decision_note`.

### `field_executive_devices`

One row per period a phone was bound to an account:

| Column                     | Meaning                                                                     |
| -------------------------- | --------------------------------------------------------------------------- |
| `device_id`, `device_details` | The phone, as reported at its first login                               |
| `bound_at`                 | First mobile login on this phone (NULL for bindings made before this table) |
| `last_login_at`            | Most recent mobile login on it while bound — updated on every login         |
| `released_at`              | When the binding ended (NULL = current phone)                              |
| `release_reason`           | `device_change_approved` or `binding_replaced` (see below)                  |
| `released_by_request_id`   | The approved request that ended it                                          |
| `bound_after_request_id`   | The approved request this binding followed — "the new phone" for it        |

Guarantees:

- **Nothing is deleted.** No code path deletes from either table. Requests are decided once; bindings are
  closed, never reopened. Signing in again on an old phone after approval creates a **new** row.
- At most one open (current) binding per FE, and at most one new binding per approved request
  (both unique partial indexes).
- An admin who has decided a request **cannot be deleted** (the Add New Admin page refuses with `409`
  and suggests deactivating), so "who approved this" is never lost.

**Existing bindings.** Migration 021 copies every phone already bound into `field_executive_devices`
with `bound_at` NULL ("before device history was kept"). If a binding is ever found without a history
row (e.g. set directly in the database), the next login or approval records one first.

**`binding_replaced`.** Only used if an account's binding was cleared some other way than an approved
request (for example directly in the database) while its history row was still open: the next login
closes that row with this reason before opening the new one.

---

## 5. Settings

Seeded by migration 021 into `mobile_app_settings`, under **Security**, editable by a super admin on
the Mobile App Settings page (no portal change needed — the form is data-driven):

| Key                          | Label                                  | Default | Allowed |
| ---------------------------- | -------------------------------------- | ------- | ------- |
| `device_change_max_requests` | Device change requests allowed         | 2       | 1–20    |
| `device_change_window_days`  | Device change request window (days)    | 30      | 1–365   |

So the rule reads "an FE can request at most **2** device changes every **30** days" by default.

Like every mobile app setting, both are also included in the `mobileAppSettings` values of
`GET /api/v1/master-data`. The mobile app does not use them today; the server enforces the limit.

If a row were missing or unreadable, the server falls back to 2 / 30.

---

## 6. API reference

All responses use the standard `{ success, data }` / `{ success: false, error }` envelope. Timestamps
are UTC in SQLite format (`YYYY-MM-DD HH:MM:SS`).

### Field executive (web session cookie, `authenticateFeWeb`)

#### `GET /api/v1/fe-web/device-change`

```json
{
  "eligibility": {
    "policy": { "maxRequests": 2, "windowDays": 30 },
    "requestsInWindow": 1,
    "canRequest": false,
    "blockedReason": "pending_request",
    "nextRequestAllowedAt": null
  },
  "requests": [
    {
      "id": "device-change-…",
      "status": "pending",
      "reason": "Phone screen broken",
      "requestedAt": "2026-09-14 10:02:11",
      "deviceAtRequest": { "deviceId": "e2eda104bcacf53b", "deviceName": "Galaxy S25", "brand": "samsung", "model": "SM-S931B", "systemName": "Android", "osVersion": "16", "appVersion": "1.0" },
      "decidedAt": null,
      "decisionNote": null,
      "newDevice": null
    }
  ],
  "deviceHistory": [
    {
      "id": "device-binding-…",
      "device": { "deviceId": "e2eda104bcacf53b", "deviceName": "Galaxy S25", "…": "…" },
      "boundAt": "2026-09-14 09:55:40",
      "lastLoginAt": "2026-09-14 09:55:40",
      "releasedAt": null,
      "releaseReason": null,
      "releasedByRequestId": null,
      "boundAfterRequestId": null,
      "isCurrent": true
    }
  ]
}
```

- `blockedReason`: `no_device` | `pending_request` | `limit_reached` | `null` (`canRequest` is true only when null).
- `nextRequestAllowedAt`: set only when the limit is reached.
- `newDevice` (on an approved request, once the FE has signed in on a phone again) adds `boundAt` and
  `lastLoginAt` to the device fields.
- The FE view does not include which admin decided.

#### `POST /api/v1/fe-web/device-change/requests`

Body: `{ "reason": "…" }` (optional, up to 500 characters, trimmed; no other fields allowed).

| Status | When                                                          |
| ------ | ------------------------------------------------------------- |
| `201`  | Created; `data` is the refreshed overview (as above)          |
| `400`  | Body fails validation                                         |
| `409`  | No phone bound, or a request is already pending               |
| `429`  | Limit reached — message says the limit and when to ask again  |

### Admin (`authenticateAdmin`, both `admin` and `super_admin`)

#### `GET /api/v1/admin/device-change-requests?status=&fieldExecutiveId=`

`status`: `pending` | `approved` | `rejected` (omit for all). Returns newest first:

```json
{
  "items": [
    {
      "id": "device-change-…",
      "status": "approved",
      "reason": "Phone screen broken",
      "requestedAt": "…",
      "deviceAtRequest": { "deviceId": "…", "…": "…" },
      "decidedAt": "…",
      "decisionNote": null,
      "newDevice": { "deviceId": "…", "…": "…", "boundAt": "…", "lastLoginAt": "…" },
      "fieldExecutive": { "id": "fe-001", "name": "Amit Verma", "username": "fe001" },
      "decidedBy": { "id": "admin-002", "name": "Priya Nair" }
    }
  ],
  "counts": { "pending": 0, "approved": 1, "rejected": 0, "all": 1 }
}
```

`counts` ignore the `status` filter (so every tab can show its number) but honour `fieldExecutiveId`.

#### `POST /api/v1/admin/device-change-requests/:requestId/approve`
#### `POST /api/v1/admin/device-change-requests/:requestId/reject`

Body: `{ "note": "…" }` (optional, up to 500 characters). Returns the decided request (same shape as a
list item). `404` unknown id; `409` already decided.

#### `GET /api/v1/admin/field-executives/:fieldExecutiveId/history` (extended)

Now also returns `deviceHistory` and `deviceChangeRequests` (admin shape) for that FE.

---

## 7. Field executive web portal

On **Profile**, loaded fresh on every visit:

**Mobile app device card** (when a phone is bound) gains a **Change device** section:

| State              | What the FE sees                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| Can request        | **Request device change** button and "You can request a device change up to 2 times every 30 days. Requests in the last 30 days: 0." |
| Form open          | Optional reason (500 chars), what approval will do, the limit line, **Send request** / **Cancel** |
| Pending            | "Waiting for admin approval" badge, when it was requested, and that the current phone keeps working |
| Limit reached      | "Request limit reached" badge, the limit, and the date/time they can ask again                    |

After sending, a green "Your device change request was sent to your admin." alert shows. If the server
refuses (e.g. a request was made in another tab), its message is shown and the section refreshes.

**When approved and no phone is linked yet**, the card says "Device change approved. No phone is linked
right now." and tells the FE to sign in to the app on any phone, including their previous one.

**Two history cards** (shown once there is something in them):

- **Device change requests**: Requested, Phone at request, Reason, Status (with decision time and the
  admin's note), New phone (with first sign-in time, or "Not signed in on a phone yet").
- **Phones linked to your account**: Phone, Linked (first app sign-in), Last app sign-in, Status
  (Current, or when it was unlinked and why).

---

## 8. Admin portal

**Device Change Requests** — new drawer item under *Operations*, for both admin roles.

- Tabs: **Pending** (default), **Approved**, **Rejected**, **All**, each with its count.
- Columns: Field executive, Phone at request, Reason, Requested, Status (with who decided, when, note),
  New phone, Actions.
- **Approve** asks for confirmation, explaining the FE will be unlinked from their phone and can sign in
  on any phone including it.
- **Reject** asks for an optional note, shown to the FE; the current phone stays linked.
- While an action runs, all action buttons are disabled; the list then reloads. A refusal (e.g. someone
  else decided first) shows as an error and the list refreshes.

**Field Executive History** now shows two more sections for the selected FE, above the case tables:
**Linked phones** and **Device change requests** (including who decided each).

**Mobile App Settings** shows the two new settings under Security.

The shared rendering for device cells, status badges and both history tables lives in
`public/admin/assets/js/device-change.js` and is used by both portals.

---

## 9. Changes to existing behaviour

| Area                          | Change                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| Mobile login (`auth.service.ts`) | Binding now goes through `recordMobileDeviceLogin()`: opens a history row on first bind (linked to the approved request, if any) and stamps `last_login_at` on later logins. Which logins succeed or fail is unchanged. |
| Mobile login 403 message      | "…already logged in from X. **Request a device change from the FullScan web portal, or** contact admin to change device binding." |
| Delete admin                  | Also refused (409) when the admin decided a device change request                              |
| Field Executive History API   | Adds `deviceHistory` and `deviceChangeRequests`                                                 |
| Admin drawer                  | New Device Change Requests item (menu tests updated)                                            |
| `fe-web-profile.service.ts`   | Device-details parsing moved to the shared `src/utils/device-details.ts`; output unchanged      |
| Portal table cells            | `class="cell__muted"` (which is `display: block`) moved from `<td>` onto an inner `<span>`. On a `<td>` it broke the table layout, pushing that column's values out of line. Fixed in the new tables and in the existing admin Cases (Updated), Field Executive History (TAT due), Add New Admin (Last sign-in, Added) and FE Cases (TAT due) tables. |

---

## 10. Testing

```bash
npx vitest run
npx tsc --noEmit
```

Result: **18 files, 272 tests passed**; typecheck clean. `tests/device-change.test.ts` (26 tests):

- **Settings:** both seeded under Security with defaults and bounds; out-of-range values refused.
- **Mobile login history:** first login opens a row; later logins update `last_login_at` without new
  rows; another phone while bound is refused (with the new message) and records nothing.
- **Requesting:** refused with no phone (409, nothing stored); allowed once bound; stores the phone
  snapshot and trimmed reason; one pending at a time; current phone keeps working while pending;
  body validation; web session required.
- **Admin list:** pending item with executive, counts add up, status and executive filters, bad status
  400, closed to anonymous and FE sessions, unknown id 404.
- **Reject:** decision, note and admin recorded; phone stays linked; FE can ask again; cannot decide twice.
- **Approve:** binding released into history with the request id; FE can sign in again on the **old**
  phone (new row linked to the request, shown as "new phone"); or on a **different** phone (bound to it,
  both rows kept, one request row); a binding with no history row is recorded then released.
- **Limit:** with max 1, a rejected request still counts → `limit_reached` with the exact next-allowed
  time, `429` on submit; ageing the request past the window frees the slot; lengthening the window
  applies immediately.
- **Back office:** Field Executive History includes both lists with the new phone and decider; an admin
  who decided a request cannot be deleted.

### Browser check

The whole flow was driven in headless Chrome against a real server on a throwaway database:

1. `fe001` signs in to the mobile app on a Galaxy S25 (`200`).
2. On the web Profile, **Change device** shows the button and "up to 2 times every 30 days. Requests in
   the last 30 days: 0". The form opens with the reason box focused; **Send request** shows the green
   confirmation, the "Waiting for admin approval" state, and one Pending row in the requests table.
3. A mobile login on an iPhone while the request is pending is refused (`403`).
4. Regular admin `admin002` sees **Device Change Requests** in the drawer; the Pending tab shows 1 with
   the executive, phone, reason and Approve/Reject. **Approve** shows "Approved. Amit Verma can now sign
   in to the FullScan app on any phone." and the tabs change to Pending 0 / Approved 1.
5. Before the FE signs in again, the Approved row shows "Not signed in on a phone yet".
6. A mobile login on the iPhone now succeeds (`200`); the Approved row's **New phone** shows the iPhone
   with its first sign-in time.
7. **Field Executive History** for `fe001` shows Linked phones (iPhone current, Galaxy unlinked "after
   an approved device change") and the request, approved by Priya Nair, with the iPhone as new phone.
8. Back on the web, Profile shows the iPhone as the linked phone, the request as Approved with the new
   phone, both phones in history, and "Requests in the last 30 days: 1". Checked at desktop and phone
   (400px) widths.

No JavaScript errors (only the pre-existing missing `/favicon.ico`), and no server errors.

---

## 11. Known limits

- **Login history is per phone, not per login.** Each binding keeps its first and latest mobile login,
  not every individual sign-in. A full sign-in log would be a separate table.
- **No cancel.** An FE cannot withdraw a pending request; an admin can reject it.
- **No notifications.** Admins see new requests by opening the page (the Pending tab count); FEs see the
  outcome on their Profile. Nothing is emailed or pushed.
- **The mobile app is not told about an approval.** It learns nothing until the FE signs in again. An
  app session already open on the old phone keeps its existing token until it expires.
- **Device details come from the handset** and are only as trustworthy as the app's login payload.
- All timestamps are server UTC; the portals display them in the viewer's local time.

---

## 12. File manifest

### New

| File                                                  | Purpose                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| `src/db/migrations/021_create_device_change_requests.sql` | Both tables, indexes, backfill of existing bindings, two settings |
| `src/types/device.types.ts`                           | Shared device detail/view types                              |
| `src/types/device-change.types.ts`                    | Request, binding, eligibility and list types                 |
| `src/utils/device-details.ts`                         | Defensive `device_details` JSON parsing (shared)             |
| `src/db/device-change.dao.ts`                         | Request and binding SQL, transactions                        |
| `src/services/device-change.service.ts`               | Eligibility/limit, request, approve, reject, mobile login history |
| `src/routes/schemas/device-change.schema.ts`          | Zod schemas                                                  |
| `src/controllers/fe-web-device-change.controller.ts`  | FE overview + create request                                 |
| `src/routes/fe-web-device-change.routes.ts`           | `/api/v1/fe-web/device-change`                               |
| `src/controllers/admin-device-change.controller.ts`   | Admin list / approve / reject                                |
| `src/routes/admin-device-change.routes.ts`            | `/api/v1/admin/device-change-requests`                       |
| `public/admin/assets/js/device-change.js`             | Shared device/request/history rendering (both portals)       |
| `public/admin/assets/js/pages/device-change-requests.js` | Admin Device Change Requests page                         |
| `tests/device-change.test.ts`                         | 26 end-to-end tests                                          |

### Modified

| File                                                   | Change                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| `src/app.ts`                                           | Mount both new route groups                                |
| `src/services/auth.service.ts`                         | Record device history on mobile login; 403 message        |
| `src/db/admin-user.dao.ts`, `src/services/admin-user.service.ts` | Count device change decisions as audit history    |
| `src/services/admin-field-executive.service.ts`, `src/types/admin-field-executive.types.ts` | Device records in FE history |
| `src/services/fe-web-profile.service.ts`, `src/types/fe-web-profile.types.ts` | Use shared device parsing/types     |
| `public/admin/assets/js/menu.js`, `api.js`, `icons.js` | Drawer entry, API calls, `phone` icon                     |
| `public/admin/assets/js/pages/field-executive-history.js` | Linked phones + Device change requests sections        |
| `public/fe/assets/js/pages/profile.js`, `api.js`, `public/fe/assets/css/fe.css` | Change device section, history cards |
| `tests/admin-portal-menu.test.ts`, `tests/fe-web-portal.test.ts` | New menu entry; shared asset served                |
