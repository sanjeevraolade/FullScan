# FullScan Server — API curl reference

Every JSON endpoint the server exposes, with a runnable curl, the request payload, and the **real response**
the server returned on 2026-10-05.

- **Live**: captured from the running dev server (`localhost:3000`) as field executive `fe003`
  (Ashok Gupta) and admin `admin001` (Ravi Menon).
- **Sandbox**: endpoints that change data (accept, outcome, uploads, mock-location reports, case create,
  approvals, admin users…) were run against a throwaway copy of the seeded database, so the live data
  was not touched. The response shapes are the same.

Tokens, cookies and some ids are shortened with `…`. Long arrays show their first items only.

| Section                                   | Mounted at           | Used by                                      | Auth                                                     |
| ----------------------------------------- | -------------------- | -------------------------------------------- | -------------------------------------------------------- |
| [1. Mobile-only APIs](#1-mobile-only-apis) | `/api/v1/*`          | React Native app (`FullScanApp`)             | `Authorization: Bearer <token>`                          |
| [2. App APIs](#2-app-apis-field-executive-web-app) | `/api/v1/fe-web/*`   | Field executive web app (`/app`, `/fe`)      | `fs_fe_session` cookie only                              |
| [3. Admin APIs](#3-admin-apis)            | `/api/v1/admin/*`    | Admin portal (`/admin`, `/admin-app`)        | `Authorization: Bearer <token>` or `fs_admin_session` cookie |

## Setup

```bash
BASE=http://localhost:3000/api/v1
```

| Who              | Username              | Password       |
| ---------------- | --------------------- | -------------- |
| Field executive  | `fe001` … `fe051`     | `Password123!` |
| Super admin      | `admin001`            | `Admin@123!`   |
| Admin            | `admin002`, `admin003`| `Admin@123!`   |
| Deactivated      | `admin004`            | `Admin@123!`   |

## Common rules

**Envelope.** Success is `{ "success": true, "data": … }`. Errors are `{ "success": false, "error": "…" }`.

**Validation failure** (Zod) is always `400`:

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [{ "path": "query.cursor", "message": "cursor requires type" }]
}
```

**Body errors** (every route):

| Status | `error`                     | When                                                                   |
| ------ | --------------------------- | ---------------------------------------------------------------------- |
| 400    | `Malformed JSON body`       | body is not valid JSON                                                 |
| 413    | `Request body is too large` | JSON body over 100 KB (the mobile photo upload allows 14 MB)           |

**Timestamps.** Stored times come back as `YYYY-MM-DD HH:MM:SS` in UTC (e.g. `"2026-10-05 09:55:15"`).
Values the client sent, plus `masterDataUpdatedAt`, stay ISO 8601 (e.g. `"2026-10-04T05:46:18.670Z"`).
Parse both formats.

**Sessions are isolated.** All three token types share a signing secret but carry different scopes. A
mobile token is rejected by `/fe-web/*` and `/admin/*`, and vice versa (`401`).

---

## 1. Mobile-only APIs

Used by the React Native app. All endpoints except login, `/master-data` and `/ui-config` need
`Authorization: Bearer <token>`.

**One live session per account.** Each login revokes every earlier mobile token for that account, and
logout revokes the current one. A revoked token gets `401 Invalid or expired authentication token`.

### 1.1 `POST /auth/login` — sign in and bind the device

**Live.** No auth.

```bash
curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "fe003",
    "password": "Password123!",
    "deviceId": "e2eda104bcacf53b",
    "deviceDetails": {
      "deviceName": "Galaxy S25",
      "model": "SM-S931B",
      "brand": "samsung",
      "osVersion": "16",
      "appVersion": "1.0",
      "systemName": "Android",
      "uniqueId": "e2eda104bcacf53b"
    }
  }'

# keep the token for the rest of this section
TOKEN=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d '{ …same body… }' | jq -r .data.token)
```

| Field             | Rules                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `username`        | string 1–100                                                                              |
| `password`        | string 1–200                                                                              |
| `deviceId`        | string 1–500. Bound to the account on first login; must match on every later login       |
| `deviceDetails`   | all 7 keys required: `deviceName` `model` `brand` `osVersion` `appVersion` `systemName` (≤255), `uniqueId` (≤500) |

`200`

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmaWVsZEV4ZWN1dGl2ZUlkIjoiZmUtMDAzIiwic2Vzc2lvblZlcnNpb24iOjIs…",
    "fieldExecutive": {
      "id": "fe-003",
      "name": "Ashok Gupta",
      "email": "ashok.gupta3@fullscan.example",
      "role": "Field Agent"
    },
    "masterDataUpdatedAt": "2026-10-04T05:46:18.670Z"
  }
}
```

The token lasts 12 h. Its payload is `{ fieldExecutiveId, sessionVersion }`. Re-fetch `/master-data`
only when `masterDataUpdatedAt` differs from the cached copy.

Errors (captured)

| Status | `error`                                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| 401    | `Invalid username or password`                                                                                                 |
| 403    | `This account is already logged in from Galaxy S25. Request a device change from the FullScan web portal, or contact admin to change device binding.` |
| 403    | `This device is already bound to <name>. Please contact admin to change device binding.`                                      |
| 400    | `Device ID is required`                                                                                                        |

### 1.2 `POST /auth/logout` — revoke this mobile session

**Live.** Bearer. No body. Device binding is unchanged, so the next login on the same phone works.

```bash
curl -s -X POST "$BASE/auth/logout" -H "Authorization: Bearer $TOKEN"
```

`200`

```json
{ "success": true, "data": { "signedOut": true } }
```

Any call with the same token afterwards → `401`:

```json
{ "success": false, "error": "Invalid or expired authentication token" }
```

### 1.3 `GET /me` — signed-in field executive

**Live.** Bearer.

```bash
curl -s "$BASE/me" -H "Authorization: Bearer $TOKEN"
```

`200`

```json
{
  "success": true,
  "data": { "id": "fe-003", "name": "Ashok Gupta", "email": "ashok.gupta3@fullscan.example", "role": "Field Agent" }
}
```

### 1.4 `GET /master-data` — dropdowns + mobile app settings

**Live.** No auth.

```bash
curl -s "$BASE/master-data"
```

`200`

```json
{
  "success": true,
  "data": {
    "updatedAt": "2026-10-04T05:46:18.670Z",
    "verificationTypeStatuses": [
      { "code": "verified_clear", "label": "Verified Clear" },
      { "code": "utv", "label": "UTV" },
      { "code": "insufficient", "label": "Insufficient" }
    ],
    "utvOptions": [
      { "code": "shifted", "label": "Shifted" },
      { "code": "resigned", "label": "Resigned" },
      { "code": "not_joining", "label": "Not Joining" },
      { "code": "neighbours_not_supporting", "label": "Neighbours/Family Not Supporting" }
    ],
    "insuffOptions": [
      { "code": "candidate_not_responding", "label": "Candidate Not Responding" },
      { "code": "incorrect_address", "label": "Incorrect Address" },
      { "code": "not_guiding", "label": "Not Guiding" }
    ],
    "photoTypes": [
      { "code": "house_photo_1", "label": "House Photo 1" },
      { "code": "house_photo_2", "label": "House Photo 2" },
      { "code": "aadhar", "label": "Aadhar" },
      { "code": "pan", "label": "PAN" },
      { "code": "id_proof", "label": "ID Proof" }
    ],
    "componentStatuses": [
      { "code": "new_component", "label": "New Component" },
      { "code": "additional_verification_requested", "label": "Additional Verification Request Raised" },
      { "code": "component_accepted", "label": "Component Accepted" },
      { "code": "insuff_raised", "label": "Insuff Raised" },
      { "code": "insuff_cleared", "label": "Insuff Cleared" },
      { "code": "addl_doc_requested", "label": "Additional Doc Requested" },
      { "code": "addl_doc_cleared", "label": "Additional Doc Cleared" },
      { "code": "cost_approval_requested", "label": "Cost Approval Requested" },
      { "code": "cost_approved", "label": "Cost Approved" },
      { "code": "cost_rejected", "label": "Cost Rejected" },
      { "code": "verified_clear", "label": "Verified Clear" },
      { "code": "discrepancy", "label": "Discrepancy" },
      { "code": "utv", "label": "UTV" },
      { "code": "component_stopped", "label": "Component Stopped" }
    ],
    "actionStatuses": [
      { "code": "uploaded", "label": "Uploaded" },
      { "code": "accepted", "label": "Accept/Approve" },
      { "code": "stopped", "label": "Stop" },
      { "code": "rejected", "label": "Rejected" }
    ],
    "profileStatuses": [
      { "code": "bgv_profile_created", "label": "BGV Profile Created" },
      { "code": "wip", "label": "WIP" },
      { "code": "interim_report_generated", "label": "Interim Report Generated" },
      { "code": "final_report_generated", "label": "Final Report Generated" },
      { "code": "completed", "label": "Completed" },
      { "code": "stop_profile", "label": "Stop Profile" }
    ],
    "mobileAppSettings": {
      "values": {
        "geo_fence_radius_meters": 2000,
        "locationRetryCount": 3,
        "photo_compression_quality": 80,
        "max_photo_upload_size_mb": 5,
        "watermark_enabled": true,
        "min_supported_app_version": "1.0.0",
        "force_update_enabled": false,
        "default_language": "en",
        "support_contact_number": "+911800123456",
        "maintenance_mode_enabled": false,
        "maintenance_message": "Scheduled maintenance is in progress. Please try again shortly.",
        "biometric_login_enabled": true,
        "session_timeout_minutes": 720,
        "max_login_attempts": 5,
        "device_change_max_requests": 2,
        "device_change_window_days": 30,
        "sync_interval_minutes": 15,
        "offline_queue_retry_limit": 5,
        "sync_on_wifi_only": false
      },
      "updatedAt": "2026-09-13 19:28:09"
    }
  }
}
```

### 1.5 `GET /ui-config` — all screen configs

**Live.** No auth.

```bash
curl -s "$BASE/ui-config"
```

`200`: an array of 4 screens (`assignment-detail`, `assignment-list`, `evidence-capture`,
`verification-report`), each shaped like 1.6.

### 1.6 `GET /ui-config/:screenId` — one screen config

**Live.** No auth.

```bash
curl -s "$BASE/ui-config/assignment-list"
```

`200`

```json
{
  "success": true,
  "data": {
    "screenId": "assignment-list",
    "version": 1,
    "title": "Assignment List",
    "components": [
      {
        "type": "card",
        "fields": [
          { "key": "candidateName", "label": "Candidate Name", "type": "text", "visible": true, "order": 1 },
          { "key": "address", "label": "Address", "type": "text", "visible": true, "order": 2 },
          { "key": "status", "label": "Status", "type": "status", "visible": true, "order": 3 },
          { "key": "assignedDate", "label": "Assigned Date", "type": "date", "visible": true, "order": 4 }
        ]
      }
    ],
    "updatedAt": "2026-08-31 17:19:14"
  }
}
```

`404` → `{ "success": false, "error": "Screen config not found: nope" }`

### 1.7 `PUT /ui-config/:screenId` — replace a screen config

**Sandbox.** ⚠ **No auth.** The code comment says "admin only", but nothing enforces it.

```bash
curl -s -X PUT "$BASE/ui-config/assignment-list" \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Assignment List",
    "components": [
      {
        "type": "card",
        "fields": [
          { "key": "candidateName", "label": "Candidate Name", "type": "text", "visible": true, "order": 1 },
          { "key": "address", "label": "Address", "type": "text", "visible": true, "order": 2 }
        ]
      }
    ]
  }'
```

| Field                    | Rules                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `title`                  | string 1–100                                                                       |
| `components[]`           | ≥1; `type` ∈ `card` `list` `form` `detail` `header`                                |
| `components[].fields[]`  | ≥1; `type` ∈ `text` `date` `location` `status` `image` `badge`; `order` int ≥ 0    |

`200`: `version` goes up by one on every save.

```json
{
  "success": true,
  "data": {
    "screenId": "assignment-list",
    "version": 2,
    "title": "Assignment List",
    "components": [
      {
        "type": "card",
        "fields": [
          { "key": "candidateName", "label": "Candidate Name", "type": "text", "visible": true, "order": 1 },
          { "key": "address", "label": "Address", "type": "text", "visible": true, "order": 2 }
        ]
      }
    ],
    "updatedAt": "2026-10-05 09:55:15"
  }
}
```

### 1.8 `GET /cases/counts` — the four tab counts

**Live.** Bearer. No query parameters allowed.

```bash
curl -s "$BASE/cases/counts" -H "Authorization: Bearer $TOKEN"
```

`200`

```json
{ "success": true, "data": { "new": 8, "pending": 2, "beyond_tat": 3, "completed": 0 } }
```

`new` is a random draw (3–10, capped by the pool size), not the size of the shared pool.

### 1.9 `GET /cases?type=<tab>[&cursor=…]` — one page of one tab

**Live.** Bearer.

```bash
curl -s "$BASE/cases?type=pending" -H "Authorization: Bearer $TOKEN"

# next page — pass back nextCursor exactly as received
curl -s "$BASE/cases?type=pending&cursor=<nextCursor>" -H "Authorization: Bearer $TOKEN"
```

| Query    | Rules                                                                                                    |
| -------- | -------------------------------------------------------------------------------------------------------- |
| `type`   | `new` \| `pending` \| `beyond_tat` \| `completed`                                                        |
| `cursor` | opaque; from the previous page. Requires `type`, and must belong to that tab. Not allowed with `new`     |

`200` (`type=pending`)

```json
{
  "success": true,
  "data": {
    "type": "pending",
    "items": [
      {
        "id": "case-bulk-0054-comp-1",
        "checkId": "case-bulk-0054-comp-1",
        "caseRef": "FS-2026-10054",
        "clientName": "Acme Corp",
        "candidateName": "Geeta Kumar",
        "verificationType": "Employment",
        "address": "H.No. 82-33/1, Near Beeramguda X Roads, Ramachandrapuram, Beeramguda, Hyderabad, Telangana 502032",
        "updatedAt": "2026-08-31 17:19:14"
      },
      {
        "id": "case-bulk-0309-comp-1",
        "checkId": "case-bulk-0309-comp-1",
        "caseRef": "FS-2026-10309",
        "clientName": "Quess Corp",
        "candidateName": "Kavita Naidu",
        "verificationType": "Address",
        "address": "H.No. 67-8/4, Near Lingampally Bus Depot, BHEL Road, Lingampally, Hyderabad, Telangana 500019",
        "updatedAt": "2026-08-31 17:19:14"
      }
    ],
    "nextCursor": null,
    "pageSize": 100
  }
}
```

`type=new` returns 3–10 random components from the shared pool, always with `nextCursor: null`.
`type=completed` for fe003 was empty: `"items": []`.

Errors (captured)

| Status | Response                                                                                   |
| ------ | ------------------------------------------------------------------------------------------ |
| 400    | `{ "error": "Invalid cursor" }` — malformed, or issued for another tab                     |
| 400    | `Validation failed` → `{ "path": "query.cursor", "message": "cursor requires type" }`      |
| 401    | `{ "error": "Missing authentication token" }`                                             |

### 1.10 `GET /cases` (no `type`) — ⚠ deprecated all-buckets list

**Live.** Bearer. Only kept for old app builds. Returns a flat array; items carry `caseId` and `bucket`.

```bash
curl -s "$BASE/cases" -H "Authorization: Bearer $TOKEN"
```

`200`

```json
{
  "success": true,
  "data": [
    {
      "id": "case-bulk-0229-comp-1",
      "caseId": "case-bulk-0229",
      "caseRef": "FS-2026-10229",
      "clientName": "Globex Corp",
      "candidateName": "Alok Agarwal",
      "verificationType": "Address",
      "address": "H.No. 77-8/5, Near Lingampally Bus Depot, BHEL Road, Lingampally, Hyderabad, Telangana 500019",
      "bucket": "new",
      "updatedAt": "2026-08-31 17:19:14"
    }
  ]
}
```

### 1.11 `PATCH /cases/:caseId/accept` — claim a New component (→ Pending)

**Sandbox.** Bearer. `:caseId` is a **component** id. No body.

```bash
curl -s -X PATCH "$BASE/cases/case-bulk-0476-comp-1/accept" -H "Authorization: Bearer $TOKEN"
```

`200`

```json
{
  "success": true,
  "data": {
    "id": "case-bulk-0476-comp-1",
    "checkId": "case-bulk-0476-comp-1",
    "caseRef": "FS-2026-10476",
    "clientName": "Cognizant",
    "candidateName": "Ritika Shetty",
    "verificationType": "Address",
    "address": "H.No. 54-15/9, Near Durgam Cheruvu, Ayyappa Society, Madhapur, Hyderabad, Telangana 500081",
    "updatedAt": "2026-10-05 09:55:15"
  }
}
```

Errors: `409 Case component case-bulk-0476-comp-1 is not in the New bucket` ·
`404 Case component not found: <id>`.

### 1.12 `GET /cases/:caseId` — full Case Details

**Live.** Bearer. `:caseId` is a **component** id.

```bash
curl -s "$BASE/cases/case-bulk-0054-comp-1" -H "Authorization: Bearer $TOKEN"
```

`200`

```json
{
  "success": true,
  "data": {
    "id": "case-bulk-0054-comp-1",
    "checkId": "case-bulk-0054-comp-1",
    "caseRef": "FS-2026-10054",
    "bucket": "pending",
    "tatDueAt": "2026-09-03 00:00:00",
    "candidateName": "Geeta Kumar",
    "fatherOrSpouseName": "Ritika Kumar",
    "employerName": "Federal Bank",
    "verificationType": "Employment",
    "clientName": "Acme Corp",
    "address": "H.No. 82-33/1, Near Beeramguda X Roads, Ramachandrapuram, Beeramguda, Hyderabad, Telangana 502032",
    "addressType": "present",
    "residenceType": "rented",
    "gpsCheck": {
      "targetLatitude": 17.506,
      "targetLongitude": 78.292,
      "distanceMeters": 37,
      "isWithinRange": true
    },
    "maskedPrimaryPhone": "+91-8XXXX-01054",
    "maskedSecondaryPhone": "+91-7XXXX-01054",
    "clientInstructions": "Standard address verification.",
    "fieldExecutiveNotes": "Building has no lift — flat is on the upper floor.",
    "selectedVerificationStatus": null,
    "respondent": null,
    "componentStatus": "new_component",
    "actionStatus": null,
    "profileStatus": "wip",
    "costRequested": null,
    "insuffRaisedAt": null,
    "insuffClearedAt": null,
    "addlDocRequestedAt": null,
    "addlDocClearedAt": null,
    "costApprovalRequestedAt": null,
    "costApprovedAt": null,
    "costRejectedAt": null,
    "siblingComponents": []
  }
}
```

After an outcome is submitted, `respondent` reads `{ "name": "Suresh Gupta", "relation": "Father" }` and
`selectedVerificationStatus` reads `"verified_clear"`. `costRequested`, when set:
`{ "currency": "INR", "amount": 500 }`. `siblingComponents[]`:
`{ id, verificationType, addressType, componentStatus, bucket }`.

`404` → `{ "success": false, "error": "Case component not found: does-not-exist" }`

### 1.13 `POST /cases/:caseId/evidence` — upload one camera photo (JSON + base64)

**Sandbox.** Bearer. `:caseId` is a **component** id. Content-Type must be `application/json`.
Body limit is 14 MB; the decoded photo can be up to 10 MB, **JPEG only**.

```bash
PHOTO_B64=$(base64 -i ./house_photo_1.jpg | tr -d '\n')

curl -s -X POST "$BASE/cases/case-bulk-0476-comp-1/evidence" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "documentTypeCode": "house_photo_1",
    "latitude": 17.493212,
    "longitude": 78.332611,
    "accuracyMeters": 4.8,
    "capturedAt": "2026-10-05T10:21:33+05:30",
    "isMockLocation": false,
    "fileName": "house_photo_1-1791179817325.jpg",
    "contentBase64": "'"$PHOTO_B64"'"
  }'
```

| Field              | Rules                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------- |
| `documentTypeCode` | string 1–100, must be a `photoTypes` code from `/master-data`                           |
| `latitude`         | number −90..90                                                                          |
| `longitude`        | number −180..180                                                                        |
| `accuracyMeters`   | number ≥ 0                                                                              |
| `capturedAt`       | ISO 8601 with offset or `Z`. Stored as UTC (`+05:30` 10:21:33 → `04:51:33`)             |
| `isMockLocation`   | boolean                                                                                 |
| `fileName`         | string 1–255 (display only)                                                             |
| `contentBase64`    | strict standard base64. No `data:` prefix, no whitespace                                |

No other keys are allowed.

`201` (new) / `200` (same bytes already uploaded for this component; the existing record is returned)

```json
{
  "success": true,
  "data": {
    "id": "9dd83afd-bbca-42c8-ba2c-165b3e225f4d",
    "componentId": "case-bulk-0476-comp-1",
    "source": "mobile_capture",
    "fileName": "house_photo_1-1791179817325.jpg",
    "mimeType": "image/jpeg",
    "sizeBytes": 776,
    "sha256": "487d764d7fc4880e4b806def25efde2ea4231b387e5ac96d07dcb338e1c1d655",
    "documentTypeCode": "house_photo_1",
    "latitude": 17.493212,
    "longitude": 78.332611,
    "accuracyMeters": 4.8,
    "isMockLocation": false,
    "capturedAt": "2026-10-05 04:51:33",
    "uploadedAt": "2026-10-05 09:55:15"
  }
}
```

Errors (captured)

| Status | `error`                                                                                       |
| ------ | --------------------------------------------------------------------------------------------- |
| 400    | `Validation failed` → `body.capturedAt`: `capturedAt must be an ISO 8601 datetime with an offset or Z` |
| 400    | `Validation failed` → `body.contentBase64`: `contentBase64 must be standard base64 (A-Z a-z 0-9 + /, = padding, length a multiple of 4) with no data: prefix or whitespace` |
| 400    | `Unknown documentTypeCode`                                                                    |
| 404    | `Case not found` — unknown id, or a component not assigned to you (including New ones)        |
| 409    | `Evidence can no longer be added to a completed case`                                         |
| 409    | `Accept the case before adding evidence`                                                      |
| 413    | `The photo must be 10 MB or smaller`                                                          |
| 415    | `Send the photo as application/json`                                                          |
| 415    | `The photo must be a JPEG image`                                                              |

### 1.14 `POST /cases/:caseId/verification-outcome` — submit the outcome (→ Completed)

**Sandbox.** Bearer. `:caseId` is a **component** id, and it must be assigned to you. Every key is required
(use `null` where not applicable). Re-submitting overwrites the earlier outcome.

```bash
curl -s -X POST "$BASE/cases/case-bulk-0476-comp-1/verification-outcome" \
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
    "respondent": { "name": "Suresh Gupta", "relation": "Father" },
    "isSignatureCaptured": true,
    "currentLatitude": 17.493212,
    "currentLongitude": 78.332611,
    "distanceToCaseMeters": 42.7,
    "forceProceed": false
  }'
```

| Field                                | Rules                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `verificationStatus`                 | a `verificationTypeStatuses` code: `verified_clear` \| `utv` \| `insufficient`            |
| `utvReason` / `insufficientReason`   | string ≤200 or `null` (codes from `utvOptions` / `insuffOptions`)                         |
| `utvRemarks` / `insufficientRemarks` | string ≤2000 or `null`                                                                    |
| `residenceType`                      | `owned` `rented` `hostel` `paying_guest` `company_quarters` `relative_owned` or `null`    |
| `addressType`                        | `present` `permanent` `previous` or `null`                                                |
| `respondent`                         | `{ name: 1–200, relation: 1–100 }` (trimmed, blank rejected) or `null`                    |
| `isSignatureCaptured`                | boolean                                                                                   |
| `currentLatitude` / `currentLongitude` | numbers, or both `null` (not one of each)                                               |
| `distanceToCaseMeters`               | finite number ≥ 0, or `null` when the case location is unknown                            |
| `forceProceed`                       | boolean: `true` if the FE bypassed the geo-fence                                          |

**`verified_clear` requires** `residenceType`, `addressType`, `respondent` (all non-null), and
`isSignatureCaptured: true`.

`200`: the component summary (same shape as a 1.9 item).

```json
{
  "success": true,
  "data": {
    "id": "case-bulk-0476-comp-1",
    "checkId": "case-bulk-0476-comp-1",
    "caseRef": "FS-2026-10476",
    "clientName": "Cognizant",
    "candidateName": "Ritika Shetty",
    "verificationType": "Address",
    "address": "H.No. 54-15/9, Near Durgam Cheruvu, Ayyappa Society, Madhapur, Hyderabad, Telangana 500081",
    "updatedAt": "2026-10-05 09:55:15"
  }
}
```

Errors (captured). A `verified_clear` body with the rules broken:

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    { "path": "body.currentLongitude", "message": "currentLongitude must be a number when currentLatitude is set" },
    { "path": "body.residenceType", "message": "residenceType is required for verified_clear" },
    { "path": "body.addressType", "message": "addressType is required for verified_clear" },
    { "path": "body.respondent", "message": "respondent is required for verified_clear" },
    { "path": "body.isSignatureCaptured", "message": "isSignatureCaptured must be true for verified_clear" }
  ]
}
```

`400 Unknown verificationStatus` · `404 Case component not found: <id>` (unknown, or assigned to someone else).

### 1.15 `POST /security/mock-location` — report a faked GPS location

**Sandbox.** Bearer. Idempotent on `clientEventId`.

```bash
curl -s -X POST "$BASE/security/mock-location" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "clientEventId": "7f1c2b9e-5d1a-4c1e-9a77-1e2f3a4b5c6d",
    "detectionStage": "photo_capture",
    "detectedAt": "2026-10-05T10:21:33.000Z",
    "caseId": "case-bulk-0476-comp-1",
    "fix": {
      "latitude": 17.493212,
      "longitude": 78.332611,
      "accuracyMeters": 5,
      "capturedAt": "2026-10-05T10:21:32.000Z",
      "source": "fresh"
    },
    "device": {
      "deviceId": "e2eda104bcacf53b",
      "deviceName": "Galaxy S25",
      "model": "SM-S931B",
      "brand": "samsung",
      "manufacturer": "samsung",
      "deviceType": "Handset",
      "systemName": "Android",
      "osVersion": "16",
      "appVersion": "1.0",
      "appBuildNumber": "1",
      "installerPackageName": "com.android.vending",
      "isEmulator": false,
      "timeZone": "Asia/Kolkata"
    }
  }'
```

| Field            | Rules                                                                              |
| ---------------- | ---------------------------------------------------------------------------------- |
| `clientEventId`  | **required**, string 1–100 (device-generated; dedupes retries)                     |
| `detectionStage` | **required**, `post_login` \| `app_resume` \| `manual_recheck` \| `photo_capture`  |
| `detectedAt`     | **required**, string 1–40 (device clock)                                           |
| `fix`            | optional; lat −90..90, lng −180..180, `accuracyMeters` 0..1 000 000, `source` `fresh` \| `lastKnown` |
| `caseId`         | optional component id (≤100)                                                       |
| `device`         | optional; every key optional                                                       |

`201` first delivery / `200` retry with the same `clientEventId` (`isDuplicate: true`)

```json
{
  "success": true,
  "data": {
    "eventId": "ff396126-b010-4c7c-af50-a3bb4514ad30",
    "isDuplicate": false,
    "reportedAt": "2026-10-05 09:55:15",
    "totalEventCount": 1,
    "firstDetectedAt": "2026-10-05T10:21:33.000Z"
  }
}
```

---

## 2. App APIs (field executive web app)

Used by the field executive React app at `/app` and the static portal at `/fe`. **Cookie only:** login
sets `fs_fe_session`, and there is no Bearer transport. No device binding. With curl, save the cookie
with `-c` and send it with `-b`.

### 2.1 `POST /fe-web/auth/login`

**Live.** No auth. Rate limited: 10 failed attempts per IP per 15 min → `429`.

```bash
curl -s -X POST "$BASE/fe-web/auth/login" \
  -H 'Content-Type: application/json' \
  -c fe.cookies \
  -d '{ "username": "fe003", "password": "Password123!" }'
```

Response header:

```text
Set-Cookie: fs_fe_session=<jwt>; Path=/; Max-Age=28800; HttpOnly; SameSite=Strict
```

`200`: the token is deliberately **not** in the body.

```json
{
  "success": true,
  "data": {
    "expiresInSeconds": 28800,
    "fieldExecutive": { "id": "fe-003", "name": "Ashok Gupta", "email": "ashok.gupta3@fullscan.example", "role": "Field Agent" }
  }
}
```

Errors: `401 Invalid username or password` ·
`429 Too many sign-in attempts. Please try again in a few minutes.`

### 2.2 `POST /fe-web/auth/logout`

**Live.**

```bash
curl -s -X POST "$BASE/fe-web/auth/logout" -b fe.cookies -c fe.cookies
```

`200` → `{ "success": true, "data": { "signedOut": true } }`. Afterwards:
`401 Missing field executive web session`.

### 2.3 `GET /fe-web/auth/me`

**Live.**

```bash
curl -s "$BASE/fe-web/auth/me" -b fe.cookies
```

`200`

```json
{
  "success": true,
  "data": { "id": "fe-003", "name": "Ashok Gupta", "email": "ashok.gupta3@fullscan.example", "role": "Field Agent" }
}
```

### 2.4 `GET /fe-web/cases` — my Pending / Beyond TAT / Completed cases

**Live.** Always three groups in this order, even when empty. New cases are not listed; they are claimed
in the mobile app.

```bash
curl -s "$BASE/fe-web/cases" -b fe.cookies
```

`200` (first case of each group shown)

```json
{
  "success": true,
  "data": {
    "caseGroups": [
      {
        "bucket": "pending",
        "caseCount": 2,
        "cases": [
          {
            "componentId": "case-bulk-0054-comp-1",
            "caseId": "case-bulk-0054",
            "caseRef": "FS-2026-10054",
            "clientName": "Acme Corp",
            "candidateName": "Geeta Kumar",
            "verificationType": "Employment",
            "addressType": "present",
            "address": "H.No. 82-33/1, Near Beeramguda X Roads, Ramachandrapuram, Beeramguda, Hyderabad, Telangana 502032",
            "componentStatus": "new_component",
            "componentStatusLabel": "New Component",
            "tatDueAt": "2026-09-03 00:00:00",
            "updatedAt": "2026-08-31 17:19:14"
          }
        ]
      },
      {
        "bucket": "beyond_tat",
        "caseCount": 3,
        "cases": [
          {
            "componentId": "case-bulk-0258-comp-1",
            "caseId": "case-bulk-0258",
            "caseRef": "FS-2026-10258",
            "clientName": "MNO Industries",
            "candidateName": "Karan Iyer",
            "verificationType": "Address",
            "addressType": "present",
            "address": "H.No. 16-37/7, Near Forum Sujana Mall, Moosapet, Kukatpally, Hyderabad, Telangana 500072",
            "componentStatus": "new_component",
            "componentStatusLabel": "New Component",
            "tatDueAt": "2026-08-16 00:00:00",
            "updatedAt": "2026-08-31 17:19:14"
          }
        ]
      },
      { "bucket": "completed", "caseCount": 0, "cases": [] }
    ]
  }
}
```

### 2.5 `GET /fe-web/cases/:componentId` — one of my components

**Live.**

```bash
curl -s "$BASE/fe-web/cases/case-bulk-0054-comp-1" -b fe.cookies
```

`200`

```json
{
  "success": true,
  "data": {
    "componentId": "case-bulk-0054-comp-1",
    "caseId": "case-bulk-0054",
    "caseRef": "FS-2026-10054",
    "bucket": "pending",
    "clientName": "Acme Corp",
    "candidateName": "Geeta Kumar",
    "fatherOrSpouseName": "Ritika Kumar",
    "employerName": "Federal Bank",
    "verificationType": "Employment",
    "addressType": "present",
    "residenceType": "rented",
    "address": "H.No. 82-33/1, Near Beeramguda X Roads, Ramachandrapuram, Beeramguda, Hyderabad, Telangana 502032",
    "location": "Beeramguda, Hyderabad, Telangana",
    "componentStatus": "new_component",
    "componentStatusLabel": "New Component",
    "clientInstructions": "Standard address verification.",
    "tatDueAt": "2026-09-03 00:00:00",
    "updatedAt": "2026-08-31 17:19:14",
    "canUploadEvidence": true,
    "siblingComponents": []
  }
}
```

`siblingComponents[]`: `{ componentId, verificationType, addressType, componentStatusLabel, isAssignedToYou }`.
`404 Case not found` for someone else's component or a New one (captured with `case-0123-comp-1`).

### 2.6 `GET /fe-web/cases/:componentId/evidence` — evidence for my component

**Live** (empty). The item shape below is from the **sandbox**, after the mobile upload in 1.13. The list
holds both mobile captures and web uploads, newest first.

```bash
curl -s "$BASE/fe-web/cases/case-bulk-0476-comp-1/evidence" -b fe.cookies
```

`200`

```json
{
  "success": true,
  "data": {
    "componentId": "case-bulk-0476-comp-1",
    "evidence": [
      {
        "id": "9dd83afd-bbca-42c8-ba2c-165b3e225f4d",
        "componentId": "case-bulk-0476-comp-1",
        "source": "mobile_capture",
        "fileName": "house_photo_1-1791179817325.jpg",
        "mimeType": "image/jpeg",
        "sizeBytes": 776,
        "sha256": "487d764d7fc4880e4b806def25efde2ea4231b387e5ac96d07dcb338e1c1d655",
        "documentTypeCode": "house_photo_1",
        "latitude": 17.493212,
        "longitude": 78.332611,
        "accuracyMeters": 4.8,
        "isMockLocation": false,
        "capturedAt": "2026-10-05 04:51:33",
        "uploadedAt": "2026-10-05 09:55:15"
      }
    ]
  }
}
```

Live, with nothing uploaded yet: `{ "componentId": "case-bulk-0054-comp-1", "evidence": [] }`.

### 2.7 `POST /fe-web/cases/:componentId/evidence` — upload images (multipart)

**Sandbox.** `multipart/form-data`. Files go in the field **`files`**: up to 10 files, 10 MB each,
JPEG / PNG / WebP (checked against the real bytes). No other form fields.

```bash
curl -s -X POST "$BASE/fe-web/cases/case-bulk-0054-comp-1/evidence" \
  -b fe.cookies \
  -F "files=@./front-door.jpg" \
  -F "files=@./nameplate.png"
```

`201`: the component's **full** evidence list. Web uploads have all the capture fields `null`.

```json
{
  "success": true,
  "data": {
    "componentId": "case-bulk-0054-comp-1",
    "evidence": [
      {
        "id": "bd1c514c-06cc-40d1-8eb6-f61c1e3b5d89",
        "componentId": "case-bulk-0054-comp-1",
        "source": "web_upload",
        "fileName": "nameplate.png",
        "mimeType": "image/png",
        "sizeBytes": 74,
        "sha256": "42623db93d22e304b9658076add42312a31940e983eea26b662874bed7c24f4c",
        "documentTypeCode": null,
        "latitude": null,
        "longitude": null,
        "accuracyMeters": null,
        "isMockLocation": null,
        "capturedAt": null,
        "uploadedAt": "2026-10-05 09:55:32"
      },
      {
        "id": "1b69086c-3ce8-451d-9174-3946670a62cf",
        "componentId": "case-bulk-0054-comp-1",
        "source": "web_upload",
        "fileName": "front-door.jpg",
        "mimeType": "image/jpeg",
        "sizeBytes": 776,
        "sha256": "487d764d7fc4880e4b806def25efde2ea4231b387e5ac96d07dcb338e1c1d655",
        "documentTypeCode": null,
        "latitude": null,
        "longitude": null,
        "accuracyMeters": null,
        "isMockLocation": null,
        "capturedAt": null,
        "uploadedAt": "2026-10-05 09:55:32"
      }
    ]
  }
}
```

Errors (captured)

| Status | `error`                                                  |
| ------ | -------------------------------------------------------- |
| 400    | `Files must be sent in the "files" field`                |
| 400    | `Upload at most 10 files at a time`                      |
| 400    | `Select at least one file to upload`                     |
| 409    | `Evidence can no longer be added to a completed case`    |
| 413    | `Each file must be 10 MB or smaller`                     |
| 415    | `Upload evidence as multipart/form-data`                 |
| 415    | `notes.txt is not a JPEG, PNG or WebP image`             |
| 404    | `Case not found`                                         |

### 2.8 `GET /fe-web/profile` — my profile + bound phone

**Live.**

```bash
curl -s "$BASE/fe-web/profile" -b fe.cookies
```

`200`

```json
{
  "success": true,
  "data": {
    "fieldExecutive": { "id": "fe-003", "name": "Ashok Gupta", "email": "ashok.gupta3@fullscan.example", "role": "Field Agent" },
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

`mobileDevice` is `null` until the FE signs in to the mobile app.

### 2.9 `GET /fe-web/device-change` — eligibility + request and device history

**Live.**

```bash
curl -s "$BASE/fe-web/device-change" -b fe.cookies
```

`200`

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
        "id": "device-binding-legacy-fe-003",
        "device": {
          "deviceId": "e2eda104bcacf53b",
          "deviceName": "Galaxy S25",
          "brand": "samsung",
          "model": "SM-S931B",
          "systemName": "Android",
          "osVersion": "16",
          "appVersion": "1.0"
        },
        "boundAt": null,
        "lastLoginAt": "2026-10-05 09:54:09",
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

`blockedReason` ∈ `no_device` \| `pending_request` \| `limit_reached` \| `null`.

### 2.10 `POST /fe-web/device-change/requests` — request a device change

**Sandbox.** `reason` is optional (≤500). No other keys; send `{}` for no reason.

```bash
curl -s -X POST "$BASE/fe-web/device-change/requests" \
  -b fe.cookies \
  -H 'Content-Type: application/json' \
  -d '{ "reason": "Phone screen broken" }'
```

`201`: the refreshed overview (shape of 2.9).

```json
{
  "success": true,
  "data": {
    "eligibility": {
      "policy": { "maxRequests": 2, "windowDays": 30 },
      "requestsInWindow": 1,
      "canRequest": false,
      "blockedReason": "pending_request",
      "nextRequestAllowedAt": null
    },
    "requests": [
      {
        "id": "device-change-744efbfd-2584-4dcd-9618-16775bbf2dd0",
        "status": "pending",
        "reason": "Phone screen broken",
        "requestedAt": "2026-10-05 09:55:32",
        "deviceAtRequest": {
          "deviceId": "e2eda104bcacf53b",
          "deviceName": "Galaxy S25",
          "brand": "samsung",
          "model": "SM-S931B",
          "systemName": "Android",
          "osVersion": "16",
          "appVersion": "1.0"
        },
        "decidedAt": null,
        "decisionNote": null,
        "newDevice": null
      }
    ],
    "deviceHistory": ["…same shape as 2.9…"]
  }
}
```

Errors (captured)

| Status | `error`                                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 409    | `You already have a device change request waiting for admin approval.`                                                                     |
| 409    | `Your account is not linked to a phone yet, so there is no device to change. Sign in to the FullScan app on the phone you want to use.`   |
| 429    | `You can request a device change at most 2 times every 30 days. You can request again after <date> UTC.`                                 |

---

## 3. Admin APIs

Used by the admin portal (`/admin`, `/admin-app`). Login returns a token **and** sets the
`fs_admin_session` cookie; either works.

| Role          | Can use                                                                         |
| ------------- | ------------------------------------------------------------------------------- |
| `admin`       | auth, cases, field executives, device-change requests                           |
| `super_admin` | everything, plus **mobile-app-settings** and **admin-users**                    |

A non-super admin on a super-admin route gets `403 Your admin role does not have access to this feature`
(captured with `admin002`).

### 3.1 `POST /admin/auth/login`

**Live.** No auth. Rate limited: 10 failures per IP per 15 min → `429`. `username` accepts the username
or the email.

```bash
curl -s -X POST "$BASE/admin/auth/login" \
  -H 'Content-Type: application/json' \
  -c admin.cookies \
  -d '{ "username": "admin001", "password": "Admin@123!" }'

ADMIN_TOKEN=$(curl -s -X POST "$BASE/admin/auth/login" -H 'Content-Type: application/json' \
  -d '{ "username": "admin001", "password": "Admin@123!" }' | jq -r .data.token)
```

`200`

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZG1pblVzZXJJZCI6ImFkbWluLTAwMSIs…",
    "expiresInSeconds": 28800,
    "adminUser": {
      "id": "admin-001",
      "username": "admin001",
      "name": "Ravi Menon",
      "email": "ravi.menon@fullscan.test",
      "role": "super_admin",
      "lastLoginAt": "2026-10-05 09:48:30"
    }
  }
}
```

Errors: `401 Invalid username or password` ·
`403 This admin account has been deactivated. Contact a super admin.` (captured with `admin004`) ·
`429 Too many sign-in attempts. Please try again in a few minutes.`

### 3.2 `POST /admin/auth/logout`

**Live.** Clears the cookie. A Bearer token stays valid until it expires.

```bash
curl -s -X POST "$BASE/admin/auth/logout" -b admin.cookies
```

`200` → `{ "success": true, "data": { "signedOut": true } }`

### 3.3 `GET /admin/auth/me`

**Live.**

```bash
curl -s "$BASE/admin/auth/me" -H "Authorization: Bearer $ADMIN_TOKEN"
```

`200`

```json
{
  "success": true,
  "data": {
    "id": "admin-001",
    "username": "admin001",
    "name": "Ravi Menon",
    "email": "ravi.menon@fullscan.test",
    "role": "super_admin",
    "lastLoginAt": "2026-10-05 09:54:35"
  }
}
```

### 3.4 `GET /admin/mobile-app-settings` — super admin only

**Live.** Returns all 19 settings with the metadata the form is built from (2 shown).

```bash
curl -s "$BASE/admin/mobile-app-settings" -H "Authorization: Bearer $ADMIN_TOKEN"
```

`200`

```json
{
  "success": true,
  "data": [
    {
      "key": "geo_fence_radius_meters",
      "value": 2000,
      "valueType": "number",
      "label": "Geo-fence radius (metres)",
      "description": "How far from the assignment address a capture is still accepted.",
      "category": "evidence",
      "options": null,
      "minValue": 10,
      "maxValue": 2000,
      "updatedAt": "2026-09-12 10:27:55",
      "updatedBy": "admin-001"
    },
    {
      "key": "default_language",
      "value": "en",
      "valueType": "enum",
      "label": "Default language",
      "description": "Language a freshly installed app starts in, before the user picks one.",
      "category": "general",
      "options": ["en", "hi", "te"],
      "minValue": null,
      "maxValue": null,
      "updatedAt": "2026-09-03 14:17:05",
      "updatedBy": null
    }
  ]
}
```

`valueType` ∈ `boolean` `number` `string` `enum`; `category` ∈ `general` `security` `evidence` `sync`.

### 3.5 `PUT /admin/mobile-app-settings` — batch update, super admin only

**Sandbox.** 1–100 changes; `value` is boolean, number or string (≤500).

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

`200`: the **full** updated list (all 19). The changed rows:

```json
[
  {
    "key": "force_update_enabled",
    "value": true,
    "valueType": "boolean",
    "label": "Force update",
    "description": "Block the app entirely until the user installs the minimum supported version.",
    "category": "general",
    "options": null,
    "minValue": null,
    "maxValue": null,
    "updatedAt": "2026-10-05 09:55:54",
    "updatedBy": "admin-001"
  },
  {
    "key": "session_timeout_minutes",
    "value": 45,
    "valueType": "number",
    "label": "Session timeout (minutes)",
    "description": "Idle time before the mobile session expires and re-authentication is required.",
    "category": "security",
    "options": null,
    "minValue": 5,
    "maxValue": 10080,
    "updatedAt": "2026-10-05 09:55:54",
    "updatedBy": "admin-001"
  }
]
```

Errors (`400`, captured): `"Default language" must be one of: en, hi, te` · `Unknown setting: dark_mode`.
Also `Duplicate setting in request: <key>`, `"<label>" must be true or false`, `must be a number`,
`must be at least N`, `must be at most N`, `must be text`.

### 3.6 `GET /admin/cases` — component list with tab counts

**Live.**

```bash
curl -s "$BASE/admin/cases?fieldExecutiveId=fe-003&limit=2" -H "Authorization: Bearer $ADMIN_TOKEN"
```

| Query              | Rules                                                      |
| ------------------ | ---------------------------------------------------------- |
| `bucket`           | `new` \| `pending` \| `beyond_tat` \| `completed`          |
| `search`           | ≤200                                                       |
| `fieldExecutiveId` | ≤100                                                       |
| `limit`            | int 1–200, default 25                                      |
| `offset`           | int ≥ 0, default 0                                         |

`200` (first item shown)

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "case-bulk-0003-comp-1",
        "caseId": "case-bulk-0003",
        "caseRef": "FS-2026-10003",
        "clientName": "TCS",
        "candidateName": "Madhavi Iyer",
        "bucket": "beyond_tat",
        "verificationType": "Employment",
        "addressType": "present",
        "address": "H.No. 31-22/4, Road No. 1, KPHB Phase 6, KPHB Colony, Hyderabad, Telangana 500085",
        "componentStatus": "new_component",
        "actionStatus": null,
        "profileStatus": "wip",
        "assignedFieldExecutiveId": "fe-003",
        "assignedFieldExecutiveName": "Ashok Gupta",
        "assignedToName": "",
        "tatDueAt": "2026-08-23 00:00:00",
        "updatedAt": "2026-08-31 17:19:14"
      }
    ],
    "total": 10,
    "categories": [
      { "bucket": "new", "count": 5 },
      { "bucket": "pending", "count": 2 },
      { "bucket": "beyond_tat", "count": 3 },
      { "bucket": "completed", "count": 0 }
    ],
    "limit": 2,
    "offset": 0
  }
}
```

`?limit=999` → `400 Validation failed` → `query.limit`: `Number must be less than or equal to 200`.

### 3.7 `GET /admin/cases/form-options` — vocabularies for the case editor

**Live.** Status lists are the same as `/master-data` (truncated here).

```bash
curl -s "$BASE/admin/cases/form-options" -H "Authorization: Bearer $ADMIN_TOKEN"
```

`200`

```json
{
  "success": true,
  "data": {
    "buckets": ["new", "pending", "beyond_tat", "completed"],
    "addressTypes": ["present", "permanent", "previous"],
    "residenceTypes": ["owned", "rented", "hostel", "paying_guest", "company_quarters", "relative_owned"],
    "componentStatuses": [{ "code": "new_component", "label": "New Component" }, "…"],
    "actionStatuses": [{ "code": "uploaded", "label": "Uploaded" }, "…"],
    "profileStatuses": [{ "code": "bgv_profile_created", "label": "BGV Profile Created" }, "…"]
  }
}
```

### 3.8 `GET /admin/cases/:caseId` — one case with all components

**Live.** `:caseId` is a **case** id (e.g. `case-bulk-0054`), not a component id.

```bash
curl -s "$BASE/admin/cases/case-bulk-0054" -H "Authorization: Bearer $ADMIN_TOKEN"
```

`200`

```json
{
  "success": true,
  "data": {
    "id": "case-bulk-0054",
    "caseRef": "FS-2026-10054",
    "clientName": "Acme Corp",
    "candidateName": "Geeta Kumar",
    "fatherOrSpouseName": "Ritika Kumar",
    "employerName": "Federal Bank",
    "primaryContactNumber": "",
    "secondaryContactNumber": "",
    "profileStatus": "wip",
    "createdAt": "2026-08-31 17:19:14",
    "updatedAt": "2026-08-31 17:19:14",
    "components": [
      {
        "id": "case-bulk-0054-comp-1",
        "bucket": "pending",
        "componentStatus": "new_component",
        "actionStatus": null,
        "verificationType": "Employment",
        "addressType": "present",
        "residenceType": "rented",
        "address": "H.No. 82-33/1, Near Beeramguda X Roads, Ramachandrapuram, Beeramguda, Hyderabad, Telangana 502032",
        "location": "Beeramguda, Hyderabad, Telangana",
        "remarks": "",
        "additionalVerificationInstructions": "",
        "additionalVerificationRemarks": "",
        "assignedFieldExecutiveId": "fe-003",
        "assignedFieldExecutiveName": "Ashok Gupta",
        "assignedToName": "",
        "tatDueAt": "2026-09-03 00:00:00",
        "targetLatitude": 17.506,
        "targetLongitude": 78.292,
        "maskedPrimaryPhone": "+91-8XXXX-01054",
        "maskedSecondaryPhone": "+91-7XXXX-01054",
        "clientInstructions": "Standard address verification.",
        "fieldExecutiveNotes": "Building has no lift — flat is on the upper floor.",
        "selectedVerificationStatus": null,
        "createdAt": "2026-08-31 17:19:14",
        "updatedAt": "2026-08-31 17:19:14"
      }
    ]
  }
}
```

`404` → `{ "success": false, "error": "Case not found: nope" }`

### 3.9 `GET /admin/cases/:caseId/evidence` — all evidence on the case

**Live** (case-0134, photos taken by fe004 in the mobile app). Covers mobile captures and web uploads
across every component of the case, newest first, with who uploaded each.

```bash
curl -s "$BASE/admin/cases/case-0134/evidence" -H "Authorization: Bearer $ADMIN_TOKEN"
```

`200`

```json
{
  "success": true,
  "data": {
    "caseId": "case-0134",
    "evidence": [
      {
        "id": "84985ed5-47d8-4991-a78b-d347d408695c",
        "componentId": "case-0134-comp-1",
        "source": "mobile_capture",
        "fileName": "house_photo_1-1791179817325.jpg",
        "mimeType": "image/jpeg",
        "sizeBytes": 120452,
        "sha256": "cd2a2ce5971893575f48fb543d5e9e5ccc84304592b809d17bdf78c492b7e162",
        "documentTypeCode": "house_photo_1",
        "latitude": 37.421998333333335,
        "longitude": -122.084,
        "accuracyMeters": 5,
        "isMockLocation": false,
        "capturedAt": "2026-10-05 05:56:57",
        "uploadedAt": "2026-10-05 05:58:40",
        "uploadedBy": { "id": "fe-004", "name": "Deepak Iyer", "username": "fe004" }
      },
      {
        "id": "5fa65b38-5dbb-4477-8a83-cbc7896cd096",
        "componentId": "case-0134-comp-1",
        "source": "mobile_capture",
        "fileName": "house_photo_1-1791178856142.jpg",
        "mimeType": "image/jpeg",
        "sizeBytes": 120535,
        "sha256": "08027c6ba08c199f9abb9896e6ebac79a6c5152bfaad2c6a214a9f87d336fcfa",
        "documentTypeCode": "house_photo_1",
        "latitude": 37.421998333333335,
        "longitude": -122.084,
        "accuracyMeters": 5,
        "isMockLocation": false,
        "capturedAt": "2026-10-05 05:40:56",
        "uploadedAt": "2026-10-05 05:48:44",
        "uploadedBy": { "id": "fe-004", "name": "Deepak Iyer", "username": "fe004" }
      }
    ]
  }
}
```

### 3.10 `POST /admin/cases` — create a case with its components

**Sandbox.**

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
        "verificationType": "Address",
        "addressType": "present",
        "residenceType": "rented",
        "address": "Flat 302, Sai Residency, Kondapur, Hyderabad, Telangana 500084",
        "location": "Kondapur, Hyderabad, Telangana",
        "remarks": "",
        "additionalVerificationInstructions": "",
        "additionalVerificationRemarks": "",
        "assignedFieldExecutiveId": null,
        "assignedToName": "",
        "tatDueAt": "2026-10-12 18:00:00",
        "targetLatitude": 17.4699,
        "targetLongitude": 78.3578,
        "maskedPrimaryPhone": "+91-9XXXX-43210",
        "maskedSecondaryPhone": "",
        "clientInstructions": "Call before visiting.",
        "fieldExecutiveNotes": ""
      }
    ]
  }'
```

| Case field                                  | Rules                                    |
| ------------------------------------------- | ---------------------------------------- |
| `caseRef`                                   | **required** 1–100, unique               |
| `clientName`, `candidateName`               | **required** 1–200                       |
| `profileStatus`                             | **required**, a `profileStatuses` code   |
| `fatherOrSpouseName`, `employerName`        | optional ≤200                            |
| `primaryContactNumber`, `secondaryContactNumber` | optional ≤50                        |
| `components[]`                              | 1–20                                     |

| Component field                             | Rules                                                              |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `bucket`                                    | **required** `new` \| `pending` \| `beyond_tat` \| `completed`     |
| `componentStatus`                           | **required**, a `componentStatuses` code                           |
| `verificationType`                          | **required** 1–100                                                 |
| `address`                                   | **required** 1–1000                                                |
| `actionStatus`                              | an `actionStatuses` code, or `null`                                |
| `addressType`, `residenceType`              | enum, `""` or `null`                                               |
| `assignedFieldExecutiveId`                  | an existing FE id, or `null`                                       |
| `targetLatitude` / `targetLongitude`        | −90..90 / −180..180                                                |
| text fields                                 | optional: `location` ≤200, `remarks`/instructions/notes ≤2000, phones ≤50, `tatDueAt` ≤50 |

`201`: the created case (same shape as 3.8; ids are generated UUIDs).

```json
{
  "success": true,
  "data": {
    "id": "512c0a36-b5aa-4e09-a10d-c59308856e7a",
    "caseRef": "FS-2026-09001",
    "clientName": "Acme Corp",
    "candidateName": "Neha Gupta",
    "fatherOrSpouseName": "Rakesh Gupta",
    "employerName": "Globex Pvt Ltd",
    "primaryContactNumber": "9876543210",
    "secondaryContactNumber": "",
    "profileStatus": "bgv_profile_created",
    "createdAt": "2026-10-05 09:55:54",
    "updatedAt": "2026-10-05 09:55:54",
    "components": [
      {
        "id": "3cabf4bd-7d10-4fa2-957b-c1ba5c6a6299",
        "bucket": "new",
        "componentStatus": "new_component",
        "actionStatus": null,
        "verificationType": "Address",
        "addressType": "present",
        "residenceType": "rented",
        "address": "Flat 302, Sai Residency, Kondapur, Hyderabad, Telangana 500084",
        "location": "Kondapur, Hyderabad, Telangana",
        "remarks": "",
        "additionalVerificationInstructions": "",
        "additionalVerificationRemarks": "",
        "assignedFieldExecutiveId": null,
        "assignedFieldExecutiveName": null,
        "assignedToName": "",
        "tatDueAt": "2026-10-12 18:00:00",
        "targetLatitude": 17.4699,
        "targetLongitude": 78.3578,
        "maskedPrimaryPhone": "+91-9XXXX-43210",
        "maskedSecondaryPhone": "",
        "clientInstructions": "Call before visiting.",
        "fieldExecutiveNotes": "",
        "selectedVerificationStatus": null,
        "createdAt": "2026-10-05 09:55:54",
        "updatedAt": "2026-10-05 09:55:54"
      }
    ]
  }
}
```

Errors (captured): `409 A case already exists with reference FS-2026-09001` ·
`400 Unknown profile status: nope`. Also `400 Unknown field executive: <id>`.

### 3.11 `PUT /admin/cases/:caseId` — update a case, upsert its components

**Sandbox.** Same body as 3.10, but a component carrying `id` updates that component, and one without
`id` is added. Components not listed are left untouched. `components` may be empty (0–20).

```bash
curl -s -X PUT "$BASE/admin/cases/512c0a36-b5aa-4e09-a10d-c59308856e7a" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "caseRef": "FS-2026-09001",
    "clientName": "Acme Corp",
    "candidateName": "Neha Gupta",
    "profileStatus": "bgv_profile_created",
    "components": [
      {
        "id": "3cabf4bd-7d10-4fa2-957b-c1ba5c6a6299",
        "bucket": "pending",
        "componentStatus": "component_accepted",
        "actionStatus": "accepted",
        "verificationType": "Address",
        "address": "Flat 302, Sai Residency, Kondapur, Hyderabad, Telangana 500084",
        "assignedFieldExecutiveId": "fe-003"
      }
    ]
  }'
```

`200`: the full case (shape of 3.8). The updated component now reads:

```json
{
  "id": "3cabf4bd-7d10-4fa2-957b-c1ba5c6a6299",
  "bucket": "pending",
  "componentStatus": "component_accepted",
  "actionStatus": "accepted",
  "assignedFieldExecutiveId": "fe-003",
  "assignedFieldExecutiveName": "Ashok Gupta",
  "updatedAt": "2026-10-05 09:55:54"
}
```

Errors (captured):
`404 Component case-0123-comp-1 does not belong to case 512c0a36-b5aa-4e09-a10d-c59308856e7a`.
Also `404 Case not found: <id>`, `409 A case already exists with reference <caseRef>`, `400 Unknown …`.

### 3.12 `GET /admin/field-executives` — roster

**Live.** `search` is optional (≤200).

```bash
curl -s "$BASE/admin/field-executives?search=fe003" -H "Authorization: Bearer $ADMIN_TOKEN"
```

`200`

```json
{
  "success": true,
  "data": [
    {
      "id": "fe-003",
      "name": "Ashok Gupta",
      "email": "ashok.gupta3@fullscan.example",
      "role": "Field Agent",
      "username": "fe003",
      "isDeviceBound": true,
      "assignedComponentCount": 5,
      "mockLocationEventCount": 7,
      "lastMockLocationDetectedAt": "2026-09-12T18:00:14.040Z"
    }
  ]
}
```

### 3.13 `GET /admin/field-executives/:fieldExecutiveId/history` — case-wise history

**Live** (fe003: 7 mock-location detections, none tied to a case). First case of each group and first
detection shown.

```bash
curl -s "$BASE/admin/field-executives/fe-003/history" -H "Authorization: Bearer $ADMIN_TOKEN"
```

`200`

```json
{
  "success": true,
  "data": {
    "fieldExecutive": {
      "id": "fe-003",
      "name": "Ashok Gupta",
      "email": "ashok.gupta3@fullscan.example",
      "role": "Field Agent",
      "username": "fe003",
      "isDeviceBound": true,
      "assignedComponentCount": 5,
      "mockLocationEventCount": 7,
      "lastMockLocationDetectedAt": "2026-09-12T18:00:14.040Z"
    },
    "summary": {
      "assignedComponentCount": 5,
      "mockLocationEventCount": 7,
      "firstDetectedAt": "2026-09-12T13:08:24.214Z",
      "lastDetectedAt": "2026-09-12T18:00:14.040Z",
      "distinctDeviceCount": 1
    },
    "caseGroups": [
      {
        "bucket": "pending",
        "caseCount": 2,
        "mockLocationEventCount": 0,
        "cases": [
          {
            "componentId": "case-bulk-0054-comp-1",
            "caseId": "case-bulk-0054",
            "caseRef": "FS-2026-10054",
            "clientName": "Acme Corp",
            "candidateName": "Geeta Kumar",
            "verificationType": "Employment",
            "addressType": "present",
            "address": "H.No. 82-33/1, Near Beeramguda X Roads, Ramachandrapuram, Beeramguda, Hyderabad, Telangana 502032",
            "bucket": "pending",
            "componentStatus": "new_component",
            "actionStatus": null,
            "tatDueAt": "2026-09-03 00:00:00",
            "updatedAt": "2026-08-31 17:19:14",
            "mockLocationEvents": []
          }
        ]
      },
      { "bucket": "beyond_tat", "caseCount": 3, "mockLocationEventCount": 0, "cases": ["…"] },
      { "bucket": "completed", "caseCount": 0, "mockLocationEventCount": 0, "cases": [] }
    ],
    "unlinkedMockLocationEvents": [
      {
        "id": "250b5da8-c0ff-4088-be43-74d7abbaedb4",
        "detectionStage": "post_login",
        "detectedAt": "2026-09-12T18:00:14.040Z",
        "reportedAt": "2026-09-12 18:00:14",
        "latitude": 17.49475136,
        "longitude": 78.346717,
        "accuracyMeters": 14,
        "fixCapturedAt": "2026-09-12T18:00:14.022Z",
        "fixSource": "fresh",
        "device": {
          "deviceId": "e2eda104bcacf53b",
          "deviceName": "Galaxy S25",
          "model": "SM-S931B",
          "brand": "samsung",
          "manufacturer": "samsung",
          "deviceType": "Handset",
          "osName": "Android",
          "osVersion": "16",
          "appVersion": "1.0",
          "appBuildNumber": "1",
          "installerPackageName": "unknown",
          "isEmulator": false,
          "timeZone": "Asia/Kolkata"
        }
      }
    ],
    "deviceHistory": [
      {
        "id": "device-binding-legacy-fe-003",
        "device": {
          "deviceId": "e2eda104bcacf53b",
          "deviceName": "Galaxy S25",
          "brand": "samsung",
          "model": "SM-S931B",
          "systemName": "Android",
          "osVersion": "16",
          "appVersion": "1.0"
        },
        "boundAt": null,
        "lastLoginAt": "2026-10-05 09:54:09",
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

Detections tied to a case appear in that case's `mockLocationEvents[]` (same shape as the unlinked ones).
`deviceChangeRequests[]` items are shaped like 3.14. Errors: `404 Field executive not found: <id>`.

### 3.14 `GET /admin/device-change-requests` — list with per-status counts

**Live.** `status` (`pending` \| `approved` \| `rejected`) and `fieldExecutiveId` are optional. No other
query keys.

```bash
curl -s "$BASE/admin/device-change-requests" -H "Authorization: Bearer $ADMIN_TOKEN"
curl -s "$BASE/admin/device-change-requests?status=pending&fieldExecutiveId=fe-003" -H "Authorization: Bearer $ADMIN_TOKEN"
```

`200`

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "device-change-ce50bdc0-cfcc-495b-9d42-7e80494113da",
        "status": "approved",
        "reason": "lost",
        "requestedAt": "2026-09-13 19:28:28",
        "deviceAtRequest": {
          "deviceId": "D2336EBD-096F-4ADA-A68E-BF14AF360ACC",
          "deviceName": "iPhone 17 Pro",
          "brand": "Apple",
          "model": "iPhone 17 Pro",
          "systemName": "iOS",
          "osVersion": "26.1",
          "appVersion": "1.0"
        },
        "decidedAt": "2026-09-13 19:28:59",
        "decisionNote": null,
        "newDevice": {
          "deviceId": "7471E027-C69E-41B5-89BC-EAC5E04E9617",
          "deviceName": "iPhone 17",
          "brand": "Apple",
          "model": "iPhone 17",
          "systemName": "iOS",
          "osVersion": "26.1",
          "appVersion": "1.0",
          "boundAt": "2026-09-13 19:35:39",
          "lastLoginAt": "2026-09-13 19:35:39"
        },
        "fieldExecutive": { "id": "fe-001", "name": "Amit Verma", "username": "fe001" },
        "decidedBy": { "id": "admin-001", "name": "Ravi Menon" }
      }
    ],
    "counts": { "pending": 0, "approved": 1, "rejected": 0, "all": 1 }
  }
}
```

### 3.15 `POST /admin/device-change-requests/:requestId/approve`

**Sandbox.** Releases the FE's device binding so they can sign in on a new phone. The body is optional:
`note` ≤500, shown to the FE.

```bash
curl -s -X POST "$BASE/admin/device-change-requests/device-change-744efbfd-2584-4dcd-9618-16775bbf2dd0/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{ "note": "Approved - sign in on the new phone" }'
```

`200`. `newDevice` stays `null` until the FE signs in on the new phone.

```json
{
  "success": true,
  "data": {
    "id": "device-change-744efbfd-2584-4dcd-9618-16775bbf2dd0",
    "status": "approved",
    "reason": "Phone screen broken",
    "requestedAt": "2026-10-05 09:55:32",
    "deviceAtRequest": {
      "deviceId": "e2eda104bcacf53b",
      "deviceName": "Galaxy S25",
      "brand": "samsung",
      "model": "SM-S931B",
      "systemName": "Android",
      "osVersion": "16",
      "appVersion": "1.0"
    },
    "decidedAt": "2026-10-05 09:55:54",
    "decisionNote": "Approved - sign in on the new phone",
    "newDevice": null,
    "fieldExecutive": { "id": "fe-003", "name": "Ashok Gupta", "username": "fe003" },
    "decidedBy": { "id": "admin-001", "name": "Ravi Menon" }
  }
}
```

Errors: `409 This device change request has already been approved.` (captured) ·
`404 Device change request not found`.

### 3.16 `POST /admin/device-change-requests/:requestId/reject`

**Sandbox.** The binding is unchanged. Same body and response shape as 3.15.

```bash
curl -s -X POST "$BASE/admin/device-change-requests/device-change-aae1b482-1c95-4014-9cec-d67922fb2a6c/reject" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{ "note": "Please contact your supervisor" }'
```

`200`

```json
{
  "success": true,
  "data": {
    "id": "device-change-aae1b482-1c95-4014-9cec-d67922fb2a6c",
    "status": "rejected",
    "reason": "Switching to company phone",
    "requestedAt": "2026-10-05 09:55:32",
    "deviceAtRequest": {
      "deviceId": "D91CAB20-5457-46E4-8EAA-344E469B9A4E",
      "deviceName": "iPhone 17",
      "brand": "Apple",
      "model": "iPhone 17",
      "systemName": "iOS",
      "osVersion": "26.1",
      "appVersion": "1.0"
    },
    "decidedAt": "2026-10-05 09:55:54",
    "decisionNote": "Please contact your supervisor",
    "newDevice": null,
    "fieldExecutive": { "id": "fe-002", "name": "Shalini Bose", "username": "fe002" },
    "decidedBy": { "id": "admin-001", "name": "Ravi Menon" }
  }
}
```

### 3.17 `GET /admin/admin-users` — super admin only

**Live.**

```bash
curl -s "$BASE/admin/admin-users" -H "Authorization: Bearer $ADMIN_TOKEN"
```

`200` (2 of 5 shown)

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
      "lastLoginAt": "2026-10-05 09:54:35",
      "isActive": true,
      "createdAt": "2026-09-03 14:17:05",
      "createdBy": null
    },
    {
      "id": "admin-004",
      "username": "admin004",
      "name": "Deactivated Operator",
      "email": "inactive.admin@fullscan.test",
      "role": "admin",
      "lastLoginAt": null,
      "isActive": false,
      "createdAt": "2026-09-03 14:17:05",
      "createdBy": null
    }
  ]
}
```

### 3.18 `POST /admin/admin-users` — add an admin, super admin only

**Sandbox.** `name` 2–100, `email` valid ≤254, `role` `admin` (default) \| `super_admin`. No other keys.
The new admin's username is their email.

```bash
curl -s -X POST "$BASE/admin/admin-users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{ "name": "Kavya Rao", "email": "kavya.rao@fullscan.test", "role": "admin" }'
```

`201`: `temporaryPassword` is returned **only once**; only its hash is stored.

```json
{
  "success": true,
  "data": {
    "adminUser": {
      "id": "admin-0ec09d13-9fbc-419d-8fcd-3c23006891bf",
      "username": "kavya.rao@fullscan.test",
      "name": "Kavya Rao",
      "email": "kavya.rao@fullscan.test",
      "role": "admin",
      "lastLoginAt": null,
      "isActive": true,
      "createdAt": "2026-10-05 09:55:54",
      "createdBy": "admin-001"
    },
    "temporaryPassword": "#3UgmDuNwCcHT7dV"
  }
}
```

Errors: `409 An admin with this email already exists` (captured).

### 3.19 `PATCH /admin/admin-users/:adminUserId` — change role / (de)activate, super admin only

**Sandbox.** At least one of `role` / `isActive`. No other keys.

```bash
curl -s -X PATCH "$BASE/admin/admin-users/admin-0ec09d13-9fbc-419d-8fcd-3c23006891bf" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{ "role": "super_admin", "isActive": false }'
```

`200`

```json
{
  "success": true,
  "data": {
    "id": "admin-0ec09d13-9fbc-419d-8fcd-3c23006891bf",
    "username": "kavya.rao@fullscan.test",
    "name": "Kavya Rao",
    "email": "kavya.rao@fullscan.test",
    "role": "super_admin",
    "lastLoginAt": null,
    "isActive": false,
    "createdAt": "2026-10-05 09:55:54",
    "createdBy": "admin-001"
  }
}
```

Errors (captured):
`409 You cannot change your own role, deactivate or delete your own account. Ask another super admin.` ·
`{}` → `400 Validation failed` → `body`: `Provide a role, an isActive flag, or both`.
Also `404 Admin user not found`.

### 3.20 `DELETE /admin/admin-users/:adminUserId` — super admin only

**Sandbox.** Refused for your own account, and for an account with audit history (deactivate it instead).

```bash
curl -s -X DELETE "$BASE/admin/admin-users/admin-0ec09d13-9fbc-419d-8fcd-3c23006891bf" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

`200`

```json
{ "success": true, "data": { "deleted": true, "id": "admin-0ec09d13-9fbc-419d-8fcd-3c23006891bf" } }
```

Errors: `404 Admin user not found` · `409` (own account) ·
`409 <name> … so deleting the account would erase that audit history. Deactivate it instead.`

---

## Browser pages (not JSON)

These serve HTML and redirect to their login page without a session.

| Path         | What                                    | Cookie             |
| ------------ | --------------------------------------- | ------------------ |
| `/app`       | Field executive React app (`web-fe/`)   | `fs_fe_session`    |
| `/fe`        | Field executive static portal           | `fs_fe_session`    |
| `/admin-app` | Admin React app (`web-admin/`)          | `fs_admin_session` |
| `/admin`     | Admin static portal                     | `fs_admin_session` |
