# FullScan Server — API curl reference

Every JSON endpoint the server exposes (`src/app.ts`), with a runnable curl, the request payload the Zod
schema accepts (`src/routes/schemas/`), and the response shape (`src/types/`). Values in responses are
examples taken from the seed data in `src/db/seed/`.

Timestamps are written as ISO 8601 below, but seeded and legacy rows come back as
`YYYY-MM-DD HH:MM:SS` (e.g. `"2026-08-31 17:19:14"`). Rows written by newer code paths, and
`masterDataUpdatedAt`, use ISO. Parse both.

## Setup

```bash
BASE=http://localhost:3000/api/v1
```

Seeded accounts:

| Who              | Username                | Password       | Notes                                   |
| ---------------- | ----------------------- | -------------- | --------------------------------------- |
| Field executive  | `fe001` … `fe051`       | `Password123!` | `fe001` = `fe-001`, Amit Verma          |
| Super admin      | `admin001`              | `Admin@123!`   | Ravi Menon                              |
| Admin            | `admin002`, `admin003`  | `Admin@123!`   |                                         |
| Deactivated      | `admin004`              | `Admin@123!`   | login returns 403                       |

## Authentication — three separate sessions

| API group        | Mounted at              | How to authenticate                                           | Lifetime |
| ---------------- | ----------------------- | ------------------------------------------------------------- | -------- |
| Mobile app       | `/api/v1/*`             | `Authorization: Bearer <token>` from `POST /auth/login`       | 12 h, or until `POST /auth/logout` or the account's next login |
| Admin            | `/api/v1/admin/*`       | `Authorization: Bearer <token>` **or** `fs_admin_session` cookie | 8 h   |
| FE web portal    | `/api/v1/fe-web/*`      | `fs_fe_session` cookie **only** (token is never in the body)  | 8 h      |

All three tokens are signed with the same secret but carry a different `scope`, so a token from one group
is rejected with `401` by the others.

## Common response envelope

Success:

```json
{ "success": true, "data": { } }
```

Error (`AppError` → `src/middleware/error-handler.ts`):

```json
{ "success": false, "error": "Case component not found: case-0123-comp-9" }
```

Validation failure (`src/middleware/validate.ts`) — always `400`:

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [{ "path": "body.password", "message": "Required" }]
}
```

Unreadable JSON bodies, on every route (`src/middleware/error-handler.ts`): `400 Malformed JSON body`,
`413 Request body is too large` (JSON bodies are capped at 100 kb, except 14 MB on the mobile evidence
upload, 1.14). The body is never echoed.

Auth failures common to every protected route:

| Status | `error`                                                        |
| ------ | -------------------------------------------------------------- |
| 401    | `Missing authentication token` / `Invalid or expired authentication token` (mobile) |
| 401    | `Missing admin authentication token` / `Invalid or expired admin session` (admin) |
| 403    | `Your admin role does not have access to this feature` (super-admin-only route) |
| 401    | `Missing field executive web session` / `Invalid or expired session` (FE web) |

---

## 1. Mobile app API

### 1.1 `POST /auth/login` — sign in, bind device

No auth.

```bash
curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "fe001",
    "password": "Password123!",
    "deviceId": "a1b2c3d4-device-id",
    "deviceDetails": {
      "deviceName": "Amit'"'"'s Pixel",
      "model": "Pixel 7",
      "brand": "google",
      "osVersion": "14",
      "appVersion": "1.0.0",
      "systemName": "Android",
      "uniqueId": "a1b2c3d4-device-id"
    }
  }'
```

Save the token for the rest of this section:

```bash
TOKEN=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d '{ …same body… }' | jq -r .data.token)
```

| Field                         | Type   | Rules       |
| ----------------------------- | ------ | ----------- |
| `username`                    | string | 1–100       |
| `password`                    | string | 1–200       |
| `deviceId`                    | string | 1–500       |
| `deviceDetails.*` (all 7 keys)| string | required, ≤255 (`uniqueId` ≤500) |

`200`:

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…",
    "fieldExecutive": {
      "id": "fe-001",
      "name": "Amit Verma",
      "email": "amit.verma@fullscan.example",
      "role": "Field Agent"
    },
    "masterDataUpdatedAt": "2026-10-04T09:15:02.481Z"
  }
}
```

Errors: `401 Invalid username or password` · `400 Device ID is required` ·
`403 This device is already bound to <name>. Please contact admin to change device binding.` ·
`403 This account is already logged in from <device>. Request a device change from the FullScan web portal, or contact admin to change device binding.`

A successful login revokes every earlier mobile token for the account (one live mobile session —
see 1.15). A refused login changes nothing.

### 1.2 `GET /ui-config` — all screen configs

No auth.

```bash
curl -s "$BASE/ui-config"
```

`200`:

```json
{
  "success": true,
  "data": [
    {
      "screenId": "assignment-list",
      "version": 1,
      "title": "Assignment List",
      "components": [
        {
          "type": "card",
          "fields": [
            { "key": "candidateName", "label": "Candidate Name", "type": "text", "visible": true, "order": 1 },
            { "key": "address", "label": "Address", "type": "text", "visible": true, "order": 2 },
            { "key": "status", "label": "Status", "type": "status", "visible": true, "order": 3 }
          ]
        }
      ],
      "updatedAt": "2026-10-04T09:15:02.481Z"
    }
  ]
}
```

Seeded `screenId`s: `assignment-list`, `assignment-detail`, `evidence-capture`, `verification-report`.

### 1.3 `GET /ui-config/:screenId` — one screen config

No auth.

```bash
curl -s "$BASE/ui-config/assignment-list"
```

`200`: `data` is a single `ScreenConfig` object (same shape as one item of 1.2).
Errors: `404 Screen config not found: <screenId>`.

### 1.4 `PUT /ui-config/:screenId` — replace a screen config

No auth (see note at the end).

```bash
curl -s -X PUT "$BASE/ui-config/assignment-list" \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Assignment List",
    "components": [
      {
        "type": "card",
        "fields": [
          { "key": "candidateName", "label": "Candidate Name", "type": "text", "visible": true, "order": 1 }
        ]
      }
    ]
  }'
```

| Field                         | Rules                                                          |
| ----------------------------- | -------------------------------------------------------------- |
| `title`                       | string 1–100                                                   |
| `components[]`                | ≥1; `type` ∈ `card` `list` `form` `detail` `header`            |
| `components[].fields[]`       | ≥1; `type` ∈ `text` `date` `location` `status` `image` `badge`; `order` int ≥0 |

`200`: `data` is the updated `ScreenConfig` (version incremented).

### 1.5 `GET /master-data` — dropdowns + mobile app settings

No auth.

```bash
curl -s "$BASE/master-data"
```

`200`:

```json
{
  "success": true,
  "data": {
    "updatedAt": "2026-10-04T09:15:02.481Z",
    "verificationTypeStatuses": [
      { "code": "verified_clear", "label": "Verified Clear" },
      { "code": "utv", "label": "UTV" },
      { "code": "insufficient", "label": "Insufficient" }
    ],
    "utvOptions": [{ "code": "shifted", "label": "Shifted" }],
    "insuffOptions": [{ "code": "candidate_not_responding", "label": "Candidate not responding" }],
    "photoTypes": [{ "code": "house_photo_1", "label": "House Photo 1" }],
    "componentStatuses": [{ "code": "new_component", "label": "New Component" }],
    "actionStatuses": [{ "code": "accepted", "label": "Accepted" }],
    "profileStatuses": [{ "code": "wip", "label": "WIP" }],
    "mobileAppSettings": {
      "values": {
        "min_supported_app_version": "1.0.0",
        "force_update_enabled": false,
        "default_language": "en",
        "biometric_login_enabled": true,
        "session_timeout_minutes": 30,
        "geo_fence_radius_meters": 200,
        "locationRetryCount": 3,
        "device_change_max_requests": 2,
        "device_change_window_days": 30
      },
      "updatedAt": "2026-10-04T09:15:02.481Z"
    }
  }
}
```

`updatedAt` equals login's `masterDataUpdatedAt` while master data is unchanged; the app only re-fetches
when they differ.

### 1.6 `GET /cases?type=<tab>[&cursor=…]` — one page of one tab

Bearer.

```bash
curl -s "$BASE/cases?type=pending" -H "Authorization: Bearer $TOKEN"

# next page
curl -s "$BASE/cases?type=pending&cursor=eyJ0IjoicGVuZGluZyIsInUiOi…" -H "Authorization: Bearer $TOKEN"
```

| Query    | Rules                                                                 |
| -------- | --------------------------------------------------------------------- |
| `type`   | `new` \| `pending` \| `beyond_tat` \| `completed`                     |
| `cursor` | opaque, from the previous page's `nextCursor`; requires `type`; not allowed for `new` |

`200`:

```json
{
  "success": true,
  "data": {
    "type": "pending",
    "items": [
      {
        "id": "case-0123-comp-1",
        "checkId": "case-0123-comp-1",
        "caseRef": "FS-2026-00123",
        "clientName": "Acme Corp",
        "candidateName": "Rahul Sharma",
        "verificationType": "Address Verification",
        "address": "12-3-45, Chanda Nagar, Hyderabad",
        "updatedAt": "2026-10-03T11:42:10.000Z"
      }
    ],
    "nextCursor": "eyJ0IjoicGVuZGluZyIsInUiOi…",
    "pageSize": 100
  }
}
```

`nextCursor: null` means no more items (always `null` for `new`, which is a random draw from the shared
pool). Errors: `400 Invalid cursor`; `400 Validation failed` (`cursor requires type`).

### 1.7 `GET /cases` (no `type`) — DEPRECATED all-buckets list

Bearer. Kept for app builds already in the field.

```bash
curl -s "$BASE/cases" -H "Authorization: Bearer $TOKEN"
```

`200` — a flat array; items carry `caseId` and `bucket`:

```json
{
  "success": true,
  "data": [
    {
      "id": "case-0123-comp-1",
      "caseId": "case-0123",
      "caseRef": "FS-2026-00123",
      "clientName": "Acme Corp",
      "candidateName": "Rahul Sharma",
      "verificationType": "Address Verification",
      "address": "12-3-45, Chanda Nagar, Hyderabad",
      "bucket": "pending",
      "updatedAt": "2026-10-03T11:42:10.000Z"
    }
  ]
}
```

### 1.8 `GET /cases/counts` — the four tab counts

Bearer. No query parameters allowed.

```bash
curl -s "$BASE/cases/counts" -H "Authorization: Bearer $TOKEN"
```

`200`:

```json
{ "success": true, "data": { "new": 12, "pending": 5, "beyond_tat": 2, "completed": 31 } }
```

### 1.9 `PATCH /cases/:caseId/accept` — New → Pending (claims the component)

Bearer. `:caseId` is a **component** id. No body.

```bash
curl -s -X PATCH "$BASE/cases/case-0123-comp-1/accept" -H "Authorization: Bearer $TOKEN"
```

`200`: `data` is a `CaseSummary` (same shape as one item of 1.6).
Errors: `404 Case component not found: <id>` · `409 Case component <id> is not in the New bucket`.

### 1.10 `GET /cases/:caseId` — full Case Details

Bearer. `:caseId` is a **component** id.

```bash
curl -s "$BASE/cases/case-0123-comp-1" -H "Authorization: Bearer $TOKEN"
```

`200`:

```json
{
  "success": true,
  "data": {
    "id": "case-0123-comp-1",
    "checkId": "case-0123-comp-1",
    "caseRef": "FS-2026-00123",
    "bucket": "pending",
    "tatDueAt": "2026-10-06T18:30:00.000Z",
    "candidateName": "Rahul Sharma",
    "fatherOrSpouseName": "Suresh Sharma",
    "employerName": "Globex Pvt Ltd",
    "verificationType": "Address Verification",
    "clientName": "Acme Corp",
    "address": "12-3-45, Chanda Nagar, Hyderabad",
    "addressType": "present",
    "residenceType": "rented",
    "gpsCheck": {
      "targetLatitude": 17.4932,
      "targetLongitude": 78.3326,
      "distanceMeters": 0,
      "isWithinRange": false
    },
    "maskedPrimaryPhone": "98XXXXXX21",
    "maskedSecondaryPhone": "",
    "clientInstructions": "Verify with neighbours if candidate is unavailable",
    "fieldExecutiveNotes": "",
    "selectedVerificationStatus": null,
    "respondent": null,
    "componentStatus": "component_accepted",
    "actionStatus": "accepted",
    "profileStatus": "wip",
    "costRequested": null,
    "insuffRaisedAt": null,
    "insuffClearedAt": null,
    "addlDocRequestedAt": null,
    "addlDocClearedAt": null,
    "costApprovalRequestedAt": null,
    "costApprovedAt": null,
    "costRejectedAt": null,
    "siblingComponents": [
      {
        "id": "case-0123-comp-2",
        "verificationType": "Address Verification",
        "addressType": "permanent",
        "componentStatus": "new_component",
        "bucket": "new"
      }
    ]
  }
}
```

`costRequested`, when set: `{ "currency": "INR", "amount": 500 }`. `respondent`, when set:
`{ "name": "…", "relation": "…" }`. Errors: `404 Case component not found: <id>`.

### 1.11 `POST /cases/:caseId/verification-outcome` — submit outcome, move to Completed

Bearer. `:caseId` is a **component** id. Every body key is required (use `null` only where the table
allows it); other keys are ignored. Contract: `docs/api-contracts/verification-outcome-submission.md`
(monorepo root).

```bash
curl -s -X POST "$BASE/cases/case-0123-comp-1/verification-outcome" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "verificationStatus": "verified_clear",
    "utvReason": null,
    "utvRemarks": null,
    "insufficientReason": null,
    "insufficientRemarks": null,
    "residenceType": "rented",
    "addressType": "present",
    "respondent": { "name": "Suresh Sharma", "relation": "Father" },
    "isSignatureCaptured": true,
    "currentLatitude": 17.4461,
    "currentLongitude": 78.3821,
    "distanceToCaseMeters": 98.4,
    "forceProceed": false
  }'
```

| Field                                   | Rules                                                                 |
| --------------------------------------- | --------------------------------------------------------------------- |
| `verificationStatus`                    | string 1–100; must be a `verification_type_status` code (`verified_clear` \| `utv` \| `insufficient`) |
| `utvReason` / `insufficientReason`      | string ≤200 or `null` (codes from `utvOptions` / `insuffOptions`)     |
| `utvRemarks` / `insufficientRemarks`    | string ≤2000 or `null`                                                |
| `residenceType`                         | `owned` `rented` `hostel` `paying_guest` `company_quarters` `relative_owned` or `null` |
| `addressType`                           | `present` `permanent` `previous` or `null`                            |
| `respondent`                            | `{ name: 1–200, relation: 1–100 }` or `null`; both trimmed first, so whitespace-only is rejected |
| `isSignatureCaptured`                   | boolean                                                               |
| `currentLatitude` / `currentLongitude`  | number (−90…90 / −180…180) or `null`; both `null` or both numbers      |
| `distanceToCaseMeters`                  | number ≥ 0, or `null` when the case location could not be determined  |
| `forceProceed`                          | boolean — never defaulted                                             |

For `verified_clear`, `residenceType`, `addressType` and `respondent` must be non-null and
`isSignatureCaptured` must be `true`; each failing field is its own `details` entry (e.g.
`{ "path": "body.residenceType", "message": "residenceType is required for verified_clear" }`). Other
statuses store what was sent.

Every field is stored on the component, with the server's submission time. `residenceType` /
`addressType` are stored as what was observed; the back-office values that Case Details returns are not
changed. A second submission replaces the first.

`200`: `data` is the updated `CaseSummary` (shape of 1.6 items) — unchanged.
Errors: `400 Validation failed` (shape or `verified_clear` rules), `404 Case component not found: <id>`
(also when the component isn't assigned to the calling executive — same body, so ids can't be probed),
then `400 Unknown verificationStatus`.

### 1.12 `GET /me` — current field executive

Bearer.

```bash
curl -s "$BASE/me" -H "Authorization: Bearer $TOKEN"
```

`200`:

```json
{
  "success": true,
  "data": { "id": "fe-001", "name": "Amit Verma", "email": "amit.verma@fullscan.example", "role": "Field Agent" }
}
```

Errors: `404 No field executive session found`.

### 1.13 `POST /security/mock-location` — report a faked GPS location

Bearer. Idempotent on `clientEventId`.

```bash
curl -s -X POST "$BASE/security/mock-location" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "clientEventId": "7f1c2b9e-5d1a-4c1e-9a77-1e2f3a4b5c6d",
    "detectionStage": "photo_capture",
    "detectedAt": "2026-10-04T10:21:33.000Z",
    "caseId": "case-0123-comp-1",
    "fix": {
      "latitude": 17.4932,
      "longitude": 78.3326,
      "accuracyMeters": 5,
      "capturedAt": "2026-10-04T10:21:32.000Z",
      "source": "fresh"
    },
    "device": {
      "deviceId": "a1b2c3d4-device-id",
      "deviceName": "Amit'"'"'s Pixel",
      "model": "Pixel 7",
      "brand": "google",
      "manufacturer": "Google",
      "deviceType": "Handset",
      "systemName": "Android",
      "osVersion": "14",
      "appVersion": "1.0.0",
      "appBuildNumber": "42",
      "installerPackageName": "com.android.vending",
      "isEmulator": false,
      "timeZone": "Asia/Kolkata"
    }
  }'
```

| Field            | Rules                                                                        |
| ---------------- | ---------------------------------------------------------------------------- |
| `clientEventId`  | **required**, string 1–100                                                   |
| `detectionStage` | **required**, `post_login` \| `app_resume` \| `manual_recheck` \| `photo_capture` |
| `detectedAt`     | **required**, string 1–40 (device clock)                                     |
| `fix`            | optional; lat −90..90, lng −180..180, accuracy 0..1 000 000, `source` `fresh` \| `lastKnown` |
| `caseId`         | optional, string ≤100 (component id)                                         |
| `device`         | optional; every key optional                                                 |

`201` (first delivery) / `200` (retry of the same `clientEventId`):

```json
{
  "success": true,
  "data": {
    "eventId": "3c0f…",
    "isDuplicate": false,
    "reportedAt": "2026-10-04T10:21:35.112Z",
    "totalEventCount": 3,
    "firstDetectedAt": "2026-09-28T08:02:11.000Z"
  }
}
```

Errors: `404 No field executive session found`.

### 1.14 `POST /cases/:caseId/evidence` — upload one camera photo (base64 in JSON)

Bearer. `:caseId` is a **component** id assigned to you, in Pending or Beyond TAT. One photo per request,
sent base64-encoded inside an `application/json` body. This route accepts bodies up to **14 MB**; every
other route keeps the app-wide 100 kb JSON limit. The decoded photo must be a JPEG (checked against its
real bytes) of at most 10 MB. Idempotent by the SHA-256 of the decoded photo: the same bytes again for the
same component return the existing record with `200`.
Contract: `docs/api-contracts/mobile-evidence-upload.md` (monorepo root).

```bash
# base64 -i is macOS; on Linux use `base64 -w0`. The output must be one line, no data: prefix.
PHOTO_B64=$(base64 -i ./house_photo_1-1791105302123.jpg | tr -d '\n')
curl -s -X POST "$BASE/cases/case-0123-comp-1/evidence" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary @- <<JSON
{
  "documentTypeCode": "house_photo_1",
  "latitude": 17.4935,
  "longitude": 78.3129,
  "accuracyMeters": 8.5,
  "capturedAt": "2026-10-04T09:15:02.123Z",
  "isMockLocation": false,
  "fileName": "house_photo_1-1791105302123.jpg",
  "contentBase64": "$PHOTO_B64"
}
JSON
```

| Field              | Rules                                                                    |
| ------------------ | ------------------------------------------------------------------------ |
| `documentTypeCode` | **required** string, a `photo_type` master-data code                      |
| `latitude`         | **required** number −90..90 (a JSON number, not a string)                 |
| `longitude`        | **required** number −180..180                                             |
| `accuracyMeters`   | **required** number ≥ 0                                                   |
| `capturedAt`       | **required** ISO 8601 with offset or `Z` (device clock, not checked against server time) |
| `isMockLocation`   | **required** boolean — `true` is accepted and recorded                    |
| `fileName`         | **required** string 1–255; kept as a sanitized display name               |
| `contentBase64`    | **required** strict standard base64 (`A–Z a–z 0–9 + /`, `=` padding, length a multiple of 4), no `data:` prefix, no whitespace or line breaks; decoded: a JPEG of 1 byte … 10 MB |

The body is strict: no other field is accepted.

`201` (new) / `200` (same bytes already recorded — first write wins, this request's metadata is ignored):

```json
{
  "success": true,
  "data": {
    "id": "3f1c9a52-6a0e-4a8e-9d55-0c3a3a5f2b11",
    "componentId": "case-0123-comp-1",
    "source": "mobile_capture",
    "fileName": "house_photo_1-1791105302123.jpg",
    "mimeType": "image/jpeg",
    "sizeBytes": 482113,
    "sha256": "9b0f…e41a",
    "documentTypeCode": "house_photo_1",
    "latitude": 17.4935,
    "longitude": 78.3129,
    "accuracyMeters": 8.5,
    "isMockLocation": false,
    "capturedAt": "2026-10-04 09:15:02",
    "uploadedAt": "2026-10-04 09:20:11"
  }
}
```

Errors: `400 Malformed JSON body` · `400 Validation failed` (missing, mistyped or unknown field, or
`contentBase64` empty / not strict base64 — with `details`) · `400 Unknown documentTypeCode` ·
`404 Case not found` (unknown, or not assigned to you) · `409 Accept the case before adding evidence` (New) ·
`409 Evidence can no longer be added to a completed case` · `413 Request body is too large` (body over 14 MB) ·
`413 The photo must be 10 MB or smaller` (decoded photo) · `415 Send the photo as application/json` ·
`415 The photo must be a JPEG image` (decoded bytes).

### 1.15 `POST /auth/logout` — revoke this mobile session

Bearer. No body.

```bash
curl -s -X POST "$BASE/auth/logout" -H "Authorization: Bearer $TOKEN"
```

`200`: `{ "success": true, "data": { "signedOut": true } }` — same shape as 2.2 and 3.2.

The token is revoked on the server: every mobile route (this one included) then answers it with
`401 Invalid or expired authentication token`. Revocation is a per-account session version
(`field_executives.mobile_session_version`, carried in the token as `sessionVersion`; absent reads as
`0`), bumped only if it still matches this token — a logout that arrives after a newer login leaves
that login signed in. Device binding and device history are unchanged: the next login on the bound
phone works as normal, and moving to another phone still needs a device change request.
Contract: `docs/api-contracts/mobile-logout.md` (monorepo root).

Errors (from the Bearer check): `401 Missing authentication token` ·
`401 Invalid or expired authentication token` (invalid, expired, already logged out, superseded by a
newer login, or the account no longer exists).

---

## 2. Admin API

Sign in once and reuse either the token or the cookie jar:

### 2.1 `POST /admin/auth/login`

No auth. Rate limited: 10 failed attempts per IP per 15 min → `429`.

```bash
curl -s -X POST "$BASE/admin/auth/login" \
  -H 'Content-Type: application/json' \
  -c admin.cookies \
  -d '{ "username": "admin001", "password": "Admin@123!" }'

ADMIN_TOKEN=$(curl -s -X POST "$BASE/admin/auth/login" -H 'Content-Type: application/json' \
  -d '{ "username": "admin001", "password": "Admin@123!" }' | jq -r .data.token)
```

`username` accepts the username or the email (1–254); `password` 1–200.

`200` (also sets `fs_admin_session` httpOnly cookie):

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…",
    "expiresInSeconds": 28800,
    "adminUser": {
      "id": "admin-001",
      "username": "admin001",
      "name": "Ravi Menon",
      "email": "ravi.menon@fullscan.test",
      "role": "super_admin",
      "lastLoginAt": "2026-10-04T09:00:00.000Z"
    }
  }
}
```

Errors: `401` invalid credentials · `403 This admin account has been deactivated. Contact a super admin.` ·
`429 Too many sign-in attempts. Please try again in a few minutes.`

### 2.2 `POST /admin/auth/logout`

```bash
curl -s -X POST "$BASE/admin/auth/logout" -b admin.cookies
```

`200`: `{ "success": true, "data": { "signedOut": true } }` (clears the cookie; a Bearer token stays valid until expiry).

### 2.3 `GET /admin/auth/me`

```bash
curl -s "$BASE/admin/auth/me" -H "Authorization: Bearer $ADMIN_TOKEN"
```

`200`: `data` is the `adminUser` object from 2.1. Errors: `404 Admin user not found`.

### 2.4 `GET /admin/mobile-app-settings` — **super admin only**

```bash
curl -s "$BASE/admin/mobile-app-settings" -H "Authorization: Bearer $ADMIN_TOKEN"
```

`200`:

```json
{
  "success": true,
  "data": [
    {
      "key": "default_language",
      "value": "en",
      "valueType": "enum",
      "label": "Default language",
      "description": null,
      "category": "general",
      "options": ["en", "hi", "te"],
      "minValue": null,
      "maxValue": null,
      "updatedAt": null,
      "updatedBy": null
    },
    {
      "key": "device_change_max_requests",
      "value": 2,
      "valueType": "number",
      "label": "Device change requests allowed",
      "description": null,
      "category": "security",
      "options": null,
      "minValue": 1,
      "maxValue": 20,
      "updatedAt": null,
      "updatedBy": null
    }
  ]
}
```

`valueType` ∈ `boolean` `number` `string` `enum`; `category` ∈ `general` `security` `evidence` `sync`.

### 2.5 `PUT /admin/mobile-app-settings` — batch update, **super admin only**

```bash
curl -s -X PUT "$BASE/admin/mobile-app-settings" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "settings": [
      { "key": "force_update_enabled", "value": true },
      { "key": "session_timeout_minutes", "value": 45 },
      { "key": "default_language", "value": "hi" }
    ]
  }'
```

`settings`: 1–100 entries; `value` is boolean | number | string (≤500).

`200`: `data` is the full updated list (shape of 2.4).
Errors (`400`): `Unknown setting: <key>` · `Duplicate setting in request: <key>` ·
`"<label>" must be true or false` / `must be a number` / `must be at least N` / `must be at most N` /
`must be text` / `must be one of: …`.

### 2.6 `GET /admin/cases` — component list with tab counts

```bash
curl -s "$BASE/admin/cases?bucket=pending&search=Sharma&limit=25&offset=0" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

| Query              | Rules                                                    |
| ------------------ | -------------------------------------------------------- |
| `bucket`           | optional, `new` \| `pending` \| `beyond_tat` \| `completed` |
| `search`           | optional, ≤200                                           |
| `fieldExecutiveId` | optional, ≤100                                           |
| `limit`            | optional int 1–200, default 25                           |
| `offset`           | optional int ≥0, default 0                               |

`200`:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "case-0123-comp-1",
        "caseId": "case-0123",
        "caseRef": "FS-2026-00123",
        "clientName": "Acme Corp",
        "candidateName": "Rahul Sharma",
        "bucket": "pending",
        "verificationType": "Address Verification",
        "addressType": "present",
        "address": "12-3-45, Chanda Nagar, Hyderabad",
        "componentStatus": "component_accepted",
        "actionStatus": "accepted",
        "profileStatus": "wip",
        "assignedFieldExecutiveId": "fe-001",
        "assignedFieldExecutiveName": "Amit Verma",
        "assignedToName": "Amit Verma",
        "tatDueAt": "2026-10-06T18:30:00.000Z",
        "updatedAt": "2026-10-03T11:42:10.000Z"
      }
    ],
    "total": 1,
    "categories": [
      { "bucket": "new", "count": 4 },
      { "bucket": "pending", "count": 1 },
      { "bucket": "beyond_tat", "count": 0 },
      { "bucket": "completed", "count": 2 }
    ],
    "limit": 25,
    "offset": 0
  }
}
```

### 2.7 `POST /admin/cases` — create a case with its components

```bash
curl -s -X POST "$BASE/admin/cases" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "caseRef": "FS-2026-09001",
    "clientName": "Acme Corp",
    "candidateName": "Neha Gupta",
    "fatherOrSpouseName": "Rakesh Gupta",
    "employerName": "Globex Pvt Ltd",
    "primaryContactNumber": "9876543210",
    "secondaryContactNumber": "",
    "profileStatus": "bgv_profile_created",
    "components": [
      {
        "bucket": "new",
        "componentStatus": "new_component",
        "actionStatus": null,
        "verificationType": "Address Verification",
        "addressType": "present",
        "residenceType": "rented",
        "address": "Flat 302, Sai Residency, Kondapur",
        "location": "Kondapur, Hyderabad, Telangana",
        "remarks": "",
        "additionalVerificationInstructions": "",
        "additionalVerificationRemarks": "",
        "assignedFieldExecutiveId": null,
        "assignedToName": "",
        "tatDueAt": "2026-10-10T18:30:00.000Z",
        "targetLatitude": 17.4699,
        "targetLongitude": 78.3578,
        "maskedPrimaryPhone": "98XXXXXX10",
        "maskedSecondaryPhone": "",
        "clientInstructions": "Call before visiting",
        "fieldExecutiveNotes": ""
      }
    ]
  }'
```

Case fields: `caseRef` 1–100, `clientName` 1–200, `candidateName` 1–200, `profileStatus` 1–100 are
required; the rest optional. `components`: 1–20.

Component fields — required: `bucket`, `componentStatus` (1–100), `verificationType` (1–100), `address`
(1–1000). Optional: everything else. `addressType` / `residenceType` accept `""` or `null` for "not set".
`targetLatitude` −90..90, `targetLongitude` −180..180. Status codes must exist in master data.

`201`: `data` is an `AdminCaseDetail` (see 2.9).
Errors: `409 A case already exists with reference <caseRef>` · `400 Unknown <field>: <code>` ·
`400 Unknown field executive: <id>`.

### 2.8 `GET /admin/cases/form-options` — vocabularies for the case editor

```bash
curl -s "$BASE/admin/cases/form-options" -H "Authorization: Bearer $ADMIN_TOKEN"
```

`200`:

```json
{
  "success": true,
  "data": {
    "buckets": ["new", "pending", "beyond_tat", "completed"],
    "addressTypes": ["present", "permanent", "previous"],
    "residenceTypes": ["owned", "rented", "hostel", "paying_guest", "company_quarters", "relative_owned"],
    "componentStatuses": [{ "code": "new_component", "label": "New Component" }],
    "actionStatuses": [{ "code": "accepted", "label": "Accepted" }],
    "profileStatuses": [{ "code": "wip", "label": "WIP" }]
  }
}
```

### 2.9 `GET /admin/cases/:caseId` — one case with all components

`:caseId` here is a **case** id (e.g. `case-0123`), not a component id.

```bash
curl -s "$BASE/admin/cases/case-0123" -H "Authorization: Bearer $ADMIN_TOKEN"
```

`200`:

```json
{
  "success": true,
  "data": {
    "id": "case-0123",
    "caseRef": "FS-2026-00123",
    "clientName": "Acme Corp",
    "candidateName": "Rahul Sharma",
    "fatherOrSpouseName": "Suresh Sharma",
    "employerName": "Globex Pvt Ltd",
    "primaryContactNumber": "9876543221",
    "secondaryContactNumber": "",
    "profileStatus": "wip",
    "createdAt": "2026-09-20T05:00:00.000Z",
    "updatedAt": "2026-10-03T11:42:10.000Z",
    "components": [
      {
        "id": "case-0123-comp-1",
        "bucket": "pending",
        "componentStatus": "component_accepted",
        "actionStatus": "accepted",
        "verificationType": "Address Verification",
        "addressType": "present",
        "residenceType": "rented",
        "address": "12-3-45, Chanda Nagar, Hyderabad",
        "location": "Chanda Nagar, Hyderabad, Telangana",
        "remarks": "",
        "additionalVerificationInstructions": "",
        "additionalVerificationRemarks": "",
        "assignedFieldExecutiveId": "fe-001",
        "assignedFieldExecutiveName": "Amit Verma",
        "assignedToName": "Amit Verma",
        "tatDueAt": "2026-10-06T18:30:00.000Z",
        "targetLatitude": 17.4932,
        "targetLongitude": 78.3326,
        "maskedPrimaryPhone": "98XXXXXX21",
        "maskedSecondaryPhone": "",
        "clientInstructions": "",
        "fieldExecutiveNotes": "",
        "selectedVerificationStatus": null,
        "createdAt": "2026-09-20T05:00:00.000Z",
        "updatedAt": "2026-10-03T11:42:10.000Z"
      }
    ]
  }
}
```

Errors: `404 Case not found: <caseId>`.

### 2.10 `GET /admin/cases/:caseId/evidence` — evidence for the case (web uploads and app captures)

Newest first. Web uploads have `source: "web_upload"` and null capture fields; photos from the app have
`source: "mobile_capture"` and the capture fields set (see 1.14).

```bash
curl -s "$BASE/admin/cases/case-0123/evidence" -H "Authorization: Bearer $ADMIN_TOKEN"
```

`200`:

```json
{
  "success": true,
  "data": {
    "caseId": "case-0123",
    "evidence": [
      {
        "id": "ev-9b1e…",
        "componentId": "case-0123-comp-1",
        "source": "web_upload",
        "fileName": "front-door.jpg",
        "mimeType": "image/jpeg",
        "sizeBytes": 482113,
        "sha256": "e3b0c44298fc1c149afbf4c8996fb924…",
        "documentTypeCode": null,
        "latitude": null,
        "longitude": null,
        "accuracyMeters": null,
        "isMockLocation": null,
        "capturedAt": null,
        "uploadedAt": "2026-10-04 08:12:00",
        "uploadedBy": { "id": "fe-001", "name": "Amit Verma", "username": "fe001" }
      }
    ]
  }
}
```

### 2.11 `PUT /admin/cases/:caseId` — update case + upsert components

Same body as 2.7, except each component may carry `id` (update that component; omit it to add a new one)
and `components` may be empty (0–20). Components not listed are left untouched.

```bash
curl -s -X PUT "$BASE/admin/cases/case-0123" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "caseRef": "FS-2026-00123",
    "clientName": "Acme Corp",
    "candidateName": "Rahul Sharma",
    "profileStatus": "wip",
    "components": [
      {
        "id": "case-0123-comp-1",
        "bucket": "pending",
        "componentStatus": "component_accepted",
        "verificationType": "Address Verification",
        "address": "12-3-45, Chanda Nagar, Hyderabad",
        "assignedFieldExecutiveId": "fe-002"
      }
    ]
  }'
```

`200`: `data` is the updated `AdminCaseDetail` (shape of 2.9).
Errors: `404 Case not found: <caseId>` · `404 Component <id> does not belong to case <caseId>` ·
`409 A case already exists with reference <caseRef>` · `400 Unknown …`.

### 2.12 `GET /admin/field-executives` — roster

```bash
curl -s "$BASE/admin/field-executives?search=amit" -H "Authorization: Bearer $ADMIN_TOKEN"
```

`search` optional, ≤200.

`200`:

```json
{
  "success": true,
  "data": [
    {
      "id": "fe-001",
      "name": "Amit Verma",
      "email": "amit.verma@fullscan.example",
      "role": "Field Agent",
      "username": "fe001",
      "isDeviceBound": true,
      "assignedComponentCount": 7,
      "mockLocationEventCount": 3,
      "lastMockLocationDetectedAt": "2026-10-04T10:21:33.000Z"
    }
  ]
}
```

### 2.13 `GET /admin/field-executives/:fieldExecutiveId/history` — case-wise history

```bash
curl -s "$BASE/admin/field-executives/fe-001/history" -H "Authorization: Bearer $ADMIN_TOKEN"
```

`200`:

```json
{
  "success": true,
  "data": {
    "fieldExecutive": { "id": "fe-001", "name": "Amit Verma", "…": "same shape as 2.12 item" },
    "summary": {
      "assignedComponentCount": 7,
      "mockLocationEventCount": 3,
      "firstDetectedAt": "2026-09-28T08:02:11.000Z",
      "lastDetectedAt": "2026-10-04T10:21:33.000Z",
      "distinctDeviceCount": 1
    },
    "caseGroups": [
      {
        "bucket": "pending",
        "caseCount": 1,
        "mockLocationEventCount": 1,
        "cases": [
          {
            "componentId": "case-0123-comp-1",
            "caseId": "case-0123",
            "caseRef": "FS-2026-00123",
            "clientName": "Acme Corp",
            "candidateName": "Rahul Sharma",
            "verificationType": "Address Verification",
            "addressType": "present",
            "address": "12-3-45, Chanda Nagar, Hyderabad",
            "bucket": "pending",
            "componentStatus": "component_accepted",
            "actionStatus": "accepted",
            "tatDueAt": "2026-10-06T18:30:00.000Z",
            "updatedAt": "2026-10-03T11:42:10.000Z",
            "mockLocationEvents": [
              {
                "id": "3c0f…",
                "detectionStage": "photo_capture",
                "detectedAt": "2026-10-04T10:21:33.000Z",
                "reportedAt": "2026-10-04T10:21:35.112Z",
                "latitude": 17.4932,
                "longitude": 78.3326,
                "accuracyMeters": 5,
                "fixCapturedAt": "2026-10-04T10:21:32.000Z",
                "fixSource": "fresh",
                "device": {
                  "deviceId": "a1b2c3d4-device-id",
                  "deviceName": "Amit's Pixel",
                  "model": "Pixel 7",
                  "brand": "google",
                  "manufacturer": "Google",
                  "deviceType": "Handset",
                  "osName": "Android",
                  "osVersion": "14",
                  "appVersion": "1.0.0",
                  "appBuildNumber": "42",
                  "installerPackageName": "com.android.vending",
                  "isEmulator": false,
                  "timeZone": "Asia/Kolkata"
                }
              }
            ]
          }
        ]
      },
      { "bucket": "beyond_tat", "caseCount": 0, "mockLocationEventCount": 0, "cases": [] },
      { "bucket": "completed", "caseCount": 0, "mockLocationEventCount": 0, "cases": [] }
    ],
    "unlinkedMockLocationEvents": [],
    "deviceHistory": [
      {
        "id": "fed-1",
        "device": {
          "deviceId": "a1b2c3d4-device-id",
          "deviceName": "Amit's Pixel",
          "brand": "google",
          "model": "Pixel 7",
          "systemName": "Android",
          "osVersion": "14",
          "appVersion": "1.0.0"
        },
        "boundAt": "2026-09-01T04:00:00.000Z",
        "lastLoginAt": "2026-10-04T09:00:00.000Z",
        "releasedAt": null,
        "releaseReason": null,
        "releasedByRequestId": null,
        "boundAfterRequestId": null,
        "isCurrent": true
      }
    ],
    "deviceChangeRequests": []
  }
}
```

`deviceChangeRequests[]` items have the shape shown in 2.14. Errors: `404 Field executive not found: <id>`.

### 2.14 `GET /admin/device-change-requests` — list with per-status counts

```bash
curl -s "$BASE/admin/device-change-requests?status=pending&fieldExecutiveId=fe-001" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

`status` optional (`pending` \| `approved` \| `rejected`); `fieldExecutiveId` optional. No other query keys.

`200`:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "dcr-5a7e…",
        "status": "pending",
        "reason": "Phone screen broken",
        "requestedAt": "2026-10-04T07:30:00.000Z",
        "deviceAtRequest": {
          "deviceId": "a1b2c3d4-device-id",
          "deviceName": "Amit's Pixel",
          "brand": "google",
          "model": "Pixel 7",
          "systemName": "Android",
          "osVersion": "14",
          "appVersion": "1.0.0"
        },
        "decidedAt": null,
        "decisionNote": null,
        "newDevice": null,
        "fieldExecutive": { "id": "fe-001", "name": "Amit Verma", "username": "fe001" },
        "decidedBy": null
      }
    ],
    "counts": { "pending": 1, "approved": 0, "rejected": 0, "all": 1 }
  }
}
```

`newDevice`, once approved and the FE has signed in on the new phone: a device object plus
`boundAt` and `lastLoginAt`.

### 2.15 `POST /admin/device-change-requests/:requestId/approve`

Releases the FE's device binding so they can sign in on a new phone. Body optional.

```bash
curl -s -X POST "$BASE/admin/device-change-requests/dcr-5a7e…/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{ "note": "Approved — sign in on the new phone" }'
```

`note` optional, ≤500.

`200`: `data` is the decided request (shape of a 2.14 item, `status: "approved"`, `decidedBy` set).
Errors: `404 Device change request not found` · `409 This device change request has already been decided.`

### 2.16 `POST /admin/device-change-requests/:requestId/reject`

Binding unchanged. Same body and response as 2.15 (`status: "rejected"`).

```bash
curl -s -X POST "$BASE/admin/device-change-requests/dcr-5a7e…/reject" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{ "note": "Please contact your supervisor" }'
```

### 2.17 `GET /admin/admin-users` — **super admin only**

```bash
curl -s "$BASE/admin/admin-users" -H "Authorization: Bearer $ADMIN_TOKEN"
```

`200`:

```json
{
  "success": true,
  "data": [
    {
      "id": "admin-001",
      "username": "admin001",
      "name": "Ravi Menon",
      "email": "ravi.menon@fullscan.test",
      "role": "super_admin",
      "lastLoginAt": "2026-10-04T09:00:00.000Z",
      "isActive": true,
      "createdAt": "2026-09-01T00:00:00.000Z",
      "createdBy": null
    }
  ]
}
```

### 2.18 `POST /admin/admin-users` — add an admin, **super admin only**

```bash
curl -s -X POST "$BASE/admin/admin-users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{ "name": "Kavya Rao", "email": "kavya.rao@fullscan.test", "role": "admin" }'
```

`name` 2–100, `email` valid email ≤254, `role` `admin` (default) \| `super_admin`. No other keys allowed.

`201` — the temporary password is returned **only once**:

```json
{
  "success": true,
  "data": {
    "adminUser": {
      "id": "admin-7d3f…",
      "username": "kavya.rao@fullscan.test",
      "name": "Kavya Rao",
      "email": "kavya.rao@fullscan.test",
      "role": "admin",
      "lastLoginAt": null,
      "isActive": true,
      "createdAt": "2026-10-04T10:30:00.000Z",
      "createdBy": "admin-001"
    },
    "temporaryPassword": "Xk9#mP2…"
  }
}
```

Errors: `409 An admin with this email already exists`.

### 2.19 `PATCH /admin/admin-users/:adminUserId` — promote/demote, (de)activate, **super admin only**

```bash
curl -s -X PATCH "$BASE/admin/admin-users/admin-002" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{ "role": "super_admin", "isActive": true }'
```

At least one of `role` / `isActive`. No other keys allowed.

`200`: `data` is the updated admin (shape of a 2.17 item).
Errors: `404 Admin user not found` ·
`409 You cannot change your own role, deactivate or delete your own account. Ask another super admin.`

### 2.20 `DELETE /admin/admin-users/:adminUserId` — **super admin only**

```bash
curl -s -X DELETE "$BASE/admin/admin-users/admin-7d3f…" -H "Authorization: Bearer $ADMIN_TOKEN"
```

`200`: `{ "success": true, "data": { "deleted": true, "id": "admin-7d3f…" } }`
Errors: `404 Admin user not found` · `409` (self) · `409 <name> … so deleting the account would erase that audit history. Deactivate it instead.`

---

## 3. Field executive web portal API

Cookie only — there is no Bearer transport. Log in with `-c` to save the cookie, then send it with `-b`.

### 3.1 `POST /fe-web/auth/login`

No auth. No device binding. Rate limited (10 failures / IP / 15 min, separate from admin).

```bash
curl -s -X POST "$BASE/fe-web/auth/login" \
  -H 'Content-Type: application/json' \
  -c fe.cookies \
  -d '{ "username": "fe001", "password": "Password123!" }'
```

`200` (sets `fs_fe_session` httpOnly cookie — the token is **not** in the body):

```json
{
  "success": true,
  "data": {
    "expiresInSeconds": 28800,
    "fieldExecutive": { "id": "fe-001", "name": "Amit Verma", "email": "amit.verma@fullscan.example", "role": "Field Agent" }
  }
}
```

Errors: `401` invalid credentials · `429 Too many sign-in attempts…`.

### 3.2 `POST /fe-web/auth/logout`

```bash
curl -s -X POST "$BASE/fe-web/auth/logout" -b fe.cookies -c fe.cookies
```

`200`: `{ "success": true, "data": { "signedOut": true } }`

### 3.3 `GET /fe-web/auth/me`

```bash
curl -s "$BASE/fe-web/auth/me" -b fe.cookies
```

`200`: `data` is the `fieldExecutive` object (same as `GET /me`, 1.12).

### 3.4 `GET /fe-web/cases` — my Pending / Beyond TAT / Completed cases

```bash
curl -s "$BASE/fe-web/cases" -b fe.cookies
```

`200` — always three groups, in this order, even when empty:

```json
{
  "success": true,
  "data": {
    "caseGroups": [
      {
        "bucket": "pending",
        "caseCount": 1,
        "cases": [
          {
            "componentId": "case-0123-comp-1",
            "caseId": "case-0123",
            "caseRef": "FS-2026-00123",
            "clientName": "Acme Corp",
            "candidateName": "Rahul Sharma",
            "verificationType": "Address Verification",
            "addressType": "present",
            "address": "12-3-45, Chanda Nagar, Hyderabad",
            "componentStatus": "component_accepted",
            "componentStatusLabel": "Component Accepted",
            "tatDueAt": "2026-10-06T18:30:00.000Z",
            "updatedAt": "2026-10-03T11:42:10.000Z"
          }
        ]
      },
      { "bucket": "beyond_tat", "caseCount": 0, "cases": [] },
      { "bucket": "completed", "caseCount": 0, "cases": [] }
    ]
  }
}
```

### 3.5 `GET /fe-web/cases/:componentId` — one of my components

```bash
curl -s "$BASE/fe-web/cases/case-0123-comp-1" -b fe.cookies
```

`200`:

```json
{
  "success": true,
  "data": {
    "componentId": "case-0123-comp-1",
    "caseId": "case-0123",
    "caseRef": "FS-2026-00123",
    "bucket": "pending",
    "clientName": "Acme Corp",
    "candidateName": "Rahul Sharma",
    "fatherOrSpouseName": "Suresh Sharma",
    "employerName": "Globex Pvt Ltd",
    "verificationType": "Address Verification",
    "addressType": "present",
    "residenceType": "rented",
    "address": "12-3-45, Chanda Nagar, Hyderabad",
    "location": "Chanda Nagar, Hyderabad, Telangana",
    "componentStatus": "component_accepted",
    "componentStatusLabel": "Component Accepted",
    "clientInstructions": "",
    "tatDueAt": "2026-10-06T18:30:00.000Z",
    "updatedAt": "2026-10-03T11:42:10.000Z",
    "canUploadEvidence": true,
    "siblingComponents": [
      {
        "componentId": "case-0123-comp-2",
        "verificationType": "Address Verification",
        "addressType": "permanent",
        "componentStatusLabel": "New Component",
        "isAssignedToYou": false
      }
    ]
  }
}
```

Errors: `404 Case not found` (also for components assigned to someone else, or in `new`).

### 3.6 `GET /fe-web/cases/:componentId/evidence`

Newest first; includes photos captured in the app (`source: "mobile_capture"`, capture fields set — see 1.14).
Web uploads carry null capture fields.

```bash
curl -s "$BASE/fe-web/cases/case-0123-comp-1/evidence" -b fe.cookies
```

`200`:

```json
{
  "success": true,
  "data": {
    "componentId": "case-0123-comp-1",
    "evidence": [
      {
        "id": "ev-9b1e…",
        "componentId": "case-0123-comp-1",
        "source": "web_upload",
        "fileName": "front-door.jpg",
        "mimeType": "image/jpeg",
        "sizeBytes": 482113,
        "sha256": "e3b0c44298fc1c149afbf4c8996fb924…",
        "documentTypeCode": null,
        "latitude": null,
        "longitude": null,
        "accuracyMeters": null,
        "isMockLocation": null,
        "capturedAt": null,
        "uploadedAt": "2026-10-04 08:12:00"
      }
    ]
  }
}
```

### 3.7 `POST /fe-web/cases/:componentId/evidence` — upload images (multipart)

Files go under the field name `files`. Up to 10 files, 10 MB each, JPEG / PNG / WebP (checked against the
file's real bytes). No other form fields are accepted.

```bash
curl -s -X POST "$BASE/fe-web/cases/case-0123-comp-1/evidence" \
  -b fe.cookies \
  -F "files=@./front-door.jpg" \
  -F "files=@./nameplate.png"
```

`201`: `data` is the component's full evidence list (shape of 3.6).
Errors: `415 Upload evidence as multipart/form-data` · `413 Each file must be 10 MB or smaller` ·
`400 Upload at most 10 files at a time` · `400 Files must be sent in the "files" field` · `404 Case not found`.

### 3.8 `GET /fe-web/profile` — my profile + bound phone

```bash
curl -s "$BASE/fe-web/profile" -b fe.cookies
```

`200`:

```json
{
  "success": true,
  "data": {
    "fieldExecutive": { "id": "fe-001", "name": "Amit Verma", "email": "amit.verma@fullscan.example", "role": "Field Agent" },
    "mobileDevice": {
      "deviceId": "a1b2c3d4-device-id",
      "deviceName": "Amit's Pixel",
      "brand": "google",
      "model": "Pixel 7",
      "systemName": "Android",
      "osVersion": "14",
      "appVersion": "1.0.0"
    }
  }
}
```

`mobileDevice` is `null` if the FE has never signed in to the mobile app.

### 3.9 `GET /fe-web/device-change` — eligibility + history

```bash
curl -s "$BASE/fe-web/device-change" -b fe.cookies
```

`200`:

```json
{
  "success": true,
  "data": {
    "eligibility": {
      "policy": { "maxRequests": 2, "windowDays": 30 },
      "requestsInWindow": 0,
      "canRequest": true,
      "blockedReason": null,
      "nextRequestAllowedAt": null
    },
    "requests": [],
    "deviceHistory": [
      {
        "id": "fed-1",
        "device": { "deviceId": "a1b2c3d4-device-id", "deviceName": "Amit's Pixel", "brand": "google", "model": "Pixel 7", "systemName": "Android", "osVersion": "14", "appVersion": "1.0.0" },
        "boundAt": "2026-09-01T04:00:00.000Z",
        "lastLoginAt": "2026-10-04T09:00:00.000Z",
        "releasedAt": null,
        "releaseReason": null,
        "releasedByRequestId": null,
        "boundAfterRequestId": null,
        "isCurrent": true
      }
    ]
  }
}
```

`blockedReason` ∈ `no_device` \| `pending_request` \| `limit_reached` \| `null`. `requests[]` items are
the 2.14 item shape without `fieldExecutive` / `decidedBy`.

### 3.10 `POST /fe-web/device-change/requests` — request a device change

```bash
curl -s -X POST "$BASE/fe-web/device-change/requests" \
  -b fe.cookies \
  -H 'Content-Type: application/json' \
  -d '{ "reason": "Phone screen broken" }'
```

`reason` optional, ≤500. No other keys allowed (send `{}` for no reason).

`201`: `data` is the refreshed overview (shape of 3.9).
Errors: `409 Your account is not linked to a phone yet…` ·
`409 You already have a device change request waiting for admin approval.` ·
`429 You can request a device change at most N times every N days. You can request again after <date> UTC.`

---

## 4. Non-JSON routes (browser pages)

These serve HTML, not JSON, and redirect to their login page when there is no session:

| Path          | What                                   | Session cookie      |
| ------------- | -------------------------------------- | ------------------- |
| `/admin`      | Admin Portal (static)                  | `fs_admin_session`  |
| `/admin-app`  | Admin React app (Vite build)           | `fs_admin_session`  |
| `/fe`         | Field executive portal (static)        | `fs_fe_session`     |
| `/app`        | Field executive React app (Vite build) | `fs_fe_session`     |
