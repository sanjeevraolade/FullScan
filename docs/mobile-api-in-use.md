# Mobile APIs in use

The 10 server endpoints the React Native app (`FullScanApp`) calls today, with the request it sends and
the response it gets back. Endpoints are listed in the order the app uses them.

Sample responses are from the dev server on 2026-10-05, for field executive `fe003`. They come from
[FullScanServer/docs/api-curl-reference.md](../FullScanServer/docs/api-curl-reference.md), section 1.
Request rules come from the Zod schemas in `FullScanServer/src/routes/schemas/`.

**Mobile endpoints the app doesn't call:** `GET /me` (login returns the profile instead),
`GET /ui-config`, `GET /ui-config/:screenId`, `PUT /ui-config/:screenId`. The app also doesn't use the
old all-tabs `GET /cases` call without `type`.

| #   | Endpoint                                   | Auth   | App caller                                                 |
| --- | ------------------------------------------ | ------ | ---------------------------------------------------------- |
| 1   | `POST /auth/login`                         | none   | `authentication-repository.ts` → `login()`                 |
| 2   | `GET /master-data`                         | none   | `reference-data-repository.ts` → `fetchReferenceData()`    |
| 3   | `GET /cases/counts`                        | Bearer | `case-repository.ts` → `fetchCaseCounts()`                 |
| 4   | `GET /cases?type=…&cursor=…`               | Bearer | `case-repository.ts` → `fetchCasesPage()`                  |
| 5   | `PATCH /cases/:caseId/accept`              | Bearer | `case-repository.ts` → `acceptCase()`                      |
| 6   | `GET /cases/:caseId`                       | Bearer | `case-repository.ts` → `fetchCaseDetail()`                 |
| 7   | `POST /cases/:caseId/evidence`             | Bearer | `case-evidence-repository.ts` → `uploadCaseEvidence()`     |
| 8   | `POST /cases/:caseId/verification-outcome` | Bearer | `case-repository.ts` → `submitVerificationOutcome()`       |
| 9   | `POST /security/mock-location`             | Bearer | `security-repository.ts` → `reportMockLocationDetection()` |
| 10  | `POST /auth/logout`                        | Bearer | `authentication-repository.ts` → `logout()`                |

All repository files are in `FullScanApp/src/repositories/`.

---

## Common rules

**Base URL** (`FullScanApp/src/infrastructure/networking/api-client.ts`):

| Platform         | Base URL                       |
| ---------------- | ------------------------------ |
| Android emulator | `http://10.0.2.2:3000/api/v1`  |
| Everything else  | `http://localhost:3000/api/v1` |

**Auth.** Bearer endpoints need `Authorization: Bearer <token>`, using the token from login. A token lasts
12 hours. Only one session per account is live: each login revokes every earlier mobile token for that
account, and logout revokes the current one.

| Status | `error`                                   | When                           |
| ------ | ----------------------------------------- | ------------------------------ |
| 401    | `Missing authentication token`            | no `Authorization` header      |
| 401    | `Invalid or expired authentication token` | bad, expired, or revoked token |

**Envelope.** On success: `{ "success": true, "data": … }`. On error: `{ "success": false, "error": "…" }`.

**Validation failure** (Zod) always returns `400`:

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [{ "path": "query.cursor", "message": "cursor requires type" }]
}
```

**Body errors** (every route):

| Status | `error`                     | When                                                          |
| ------ | --------------------------- | ------------------------------------------------------------- |
| 400    | `Malformed JSON body`       | the body isn't valid JSON                                     |
| 413    | `Request body is too large` | a JSON body over 100 KB (the photo upload allows up to 14 MB) |

**Timestamps.** Times the server stores come back as `YYYY-MM-DD HH:MM:SS` in UTC (for example,
`"2026-10-05 09:55:15"`). Times the client sent, plus `masterDataUpdatedAt`, come back in ISO 8601 (for
example, `"2026-10-04T05:46:18.670Z"`). Clients must parse both formats.

**`:caseId` is a component id.** In every mobile `/cases/:caseId` route, the id is a case component id
(for example, `case-bulk-0476-comp-1`), not the parent case id.

---

## 1. `POST /auth/login`: sign in and bind the device

**When:** password login (`use-login-form.ts`). Biometric login (`use-biometric-login.ts`) calls it too,
with the stored username and password. No auth.

### Login request

```json
{
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
}
```

| Field           | Rules                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `username`      | string, 1–100 characters                                                                                                                   |
| `password`      | string, 1–200 characters                                                                                                                   |
| `deviceId`      | string, 1–500 characters. The first login binds it to the account; every later login must match it                                         |
| `deviceDetails` | all 7 keys required. `deviceName`, `model`, `brand`, `osVersion`, `appVersion` and `systemName` up to 255 characters; `uniqueId` up to 500 |

### Login response `200`

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

The token's payload is `{ fieldExecutiveId, sessionVersion }`. When `masterDataUpdatedAt` matches the
`updatedAt` of the cached master data, the app uses the cache and doesn't call `GET /master-data`
(`loadReferenceData()`).

### Login errors

| Status | `error`                                                                                                                                               |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400    | `Device ID is required`                                                                                                                               |
| 401    | `Invalid username or password`                                                                                                                        |
| 403    | `This account is already logged in from Galaxy S25. Request a device change from the FullScan web portal, or contact admin to change device binding.` |
| 403    | `This device is already bound to <name>. Please contact admin to change device binding.`                                                              |

---

## 2. `GET /master-data`: dropdowns and mobile app settings

**When:** right after login, unless the cached copy is current. Case Details also calls it, always over
the network, to retry when reference data failed to load (`use-reference-data-loader.ts`). No auth.

### Master-data request

No body, no query parameters.

### Master-data response `200`

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
      {
        "code": "neighbours_not_supporting",
        "label": "Neighbours/Family Not Supporting"
      }
    ],
    "insuffOptions": [
      {
        "code": "candidate_not_responding",
        "label": "Candidate Not Responding"
      },
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
      {
        "code": "additional_verification_requested",
        "label": "Additional Verification Request Raised"
      },
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
      {
        "code": "interim_report_generated",
        "label": "Interim Report Generated"
      },
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

---

## 3. `GET /cases/counts`: the four tab counts

**When:** loading the case list (`use-case-list.ts`). Bearer.

### Counts request

No body. The server rejects any query parameter (`400 Validation failed`).

### Counts response `200`

```json
{
  "success": true,
  "data": { "new": 8, "pending": 2, "beyond_tat": 3, "completed": 0 }
}
```

All four keys are always present. `new` is a random number from 3 to 10, capped by the size of the shared
pool, rather than the pool's actual size.

---

## 4. `GET /cases?type=<tab>[&cursor=…]`: one page of one tab

**When:** opening a case-list tab, and loading its next page (`use-case-list.ts`). Bearer.

### Case list request

No body. Query parameters:

| Query    | Rules                                                                                                                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`   | `new` \| `pending` \| `beyond_tat` \| `completed`. The app always sends it                                                                                                                                              |
| `cursor` | opaque. Pass the previous page's `nextCursor` exactly as received. Requires `type`, must belong to that tab, and isn't allowed with `new`. The app leaves it out for the first page, because the query schema is strict |

```http
GET /cases?type=pending
GET /cases?type=pending&cursor=<nextCursor>
```

### Case list response `200` (`type=pending`)

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

There are no more pages only when `nextCursor` is `null`. `type=new` returns 3–10 random components from
the shared pool, always with `nextCursor: null`. An empty tab returns `"items": []`.

### Case list errors

| Status | Response                                                                                  |
| ------ | ----------------------------------------------------------------------------------------- |
| 400    | `{ "error": "Invalid cursor" }`: the cursor is malformed, or belongs to another tab       |
| 400    | `Validation failed`, with `{ "path": "query.cursor", "message": "cursor requires type" }` |

---

## 5. `PATCH /cases/:caseId/accept`: claim a New component (New → Pending)

**When:** the field executive taps Accept on the case list or in Case Details. Bearer.

### Accept request

No body. `:caseId` is a component id.

```http
PATCH /cases/case-bulk-0476-comp-1/accept
```

### Accept response `200`

The component summary, in the same shape as a section 4 list item:

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

### Accept errors

| Status | `error`                                        |
| ------ | ---------------------------------------------- |
| 404    | `Case component not found: <id>`               |
| 409    | `Case component <id> is not in the New bucket` |

---

## 6. `GET /cases/:caseId`: full Case Details

**When:** opening Case Details (`use-case-details.ts`). Bearer.

### Case Details request

No body. `:caseId` is a component id.

```http
GET /cases/case-bulk-0054-comp-1
```

### Case Details response `200`

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

Shapes of the fields that are `null` or empty above, once they're set:

| Field                                                | Shape                                                             |
| ---------------------------------------------------- | ----------------------------------------------------------------- |
| `respondent`                                         | `{ "name": "Suresh Gupta", "relation": "Father" }`                |
| `selectedVerificationStatus`                         | a `verificationTypeStatuses` code, for example `"verified_clear"` |
| `costRequested`                                      | `{ "currency": "INR", "amount": 500 }`                            |
| `siblingComponents[]`                                | `{ id, verificationType, addressType, componentStatus, bucket }`  |
| `componentStatus` / `actionStatus` / `profileStatus` | codes from the matching `/master-data` list                       |

### Case Details errors

| Status | `error`                          |
| ------ | -------------------------------- |
| 404    | `Case component not found: <id>` |

---

## 7. `POST /cases/:caseId/evidence`: upload one camera photo

**When:** after a photo is captured in Case Details (`case-evidence-uploader.ts`). The app sends one
request per photo, with an explicit `Content-Type: application/json` header and a longer upload timeout.
Bearer.

### Evidence request

`:caseId` is a component id. The body can be up to 14 MB, and the decoded photo up to 10 MB. **JPEG only.**

```json
{
  "documentTypeCode": "house_photo_1",
  "latitude": 17.493212,
  "longitude": 78.332611,
  "accuracyMeters": 4.8,
  "capturedAt": "2026-10-05T10:21:33+05:30",
  "isMockLocation": false,
  "fileName": "house_photo_1-1791179817325.jpg",
  "contentBase64": "/9j/4AAQSkZJRgABAQ…"
}
```

| Field              | Rules                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `documentTypeCode` | string, 1–100 characters. Must be a `photoTypes` code from `/master-data`                |
| `latitude`         | number, −90 to 90                                                                        |
| `longitude`        | number, −180 to 180                                                                      |
| `accuracyMeters`   | number ≥ 0                                                                               |
| `capturedAt`       | ISO 8601 with an offset or `Z`. Stored as UTC (`10:21:33+05:30` is stored as `04:51:33`) |
| `isMockLocation`   | boolean                                                                                  |
| `fileName`         | string, 1–255 characters (for display only)                                              |
| `contentBase64`    | strict standard base64, non-empty. No `data:` prefix and no whitespace                   |

The body is strict: any other key fails validation.

### Evidence response `201` or `200`

`201` means the photo is new. `200` means the same bytes were already uploaded for this component, and
returns the existing record.

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

### Evidence errors

| Status | `error`                                                                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400    | `Validation failed`, with `body.capturedAt`: `capturedAt must be an ISO 8601 datetime with an offset or Z`                                                                      |
| 400    | `Validation failed`, with `body.contentBase64`: `contentBase64 must be standard base64 (A-Z a-z 0-9 + /, = padding, length a multiple of 4) with no data: prefix or whitespace` |
| 400    | `Unknown documentTypeCode`                                                                                                                                                      |
| 404    | `Case not found`: the id is unknown, or the component isn't assigned to you (this includes New components)                                                                      |
| 409    | `Evidence can no longer be added to a completed case`                                                                                                                           |
| 409    | `Accept the case before adding evidence`                                                                                                                                        |
| 413    | `The photo must be 10 MB or smaller`                                                                                                                                            |
| 415    | `Send the photo as application/json`                                                                                                                                            |
| 415    | `The photo must be a JPEG image`                                                                                                                                                |

---

## 8. `POST /cases/:caseId/verification-outcome`: submit the outcome (→ Completed)

**When:** the field executive submits the outcome form in Case Details (`use-case-details.ts`). Bearer.

### Outcome request

`:caseId` is a component id assigned to you. **Every key is required**; use `null` where a field doesn't
apply. Submitting again overwrites the earlier outcome.

```json
{
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
}
```

| Field                                  | Rules                                                                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `verificationStatus`                   | a `verificationTypeStatuses` code: `verified_clear` \| `utv` \| `insufficient`                                              |
| `utvReason` / `insufficientReason`     | string up to 200 characters, or `null`. Codes come from `utvOptions` / `insuffOptions`                                      |
| `utvRemarks` / `insufficientRemarks`   | string up to 2000 characters, or `null`                                                                                     |
| `residenceType`                        | `owned` \| `rented` \| `hostel` \| `paying_guest` \| `company_quarters` \| `relative_owned` \| `null`                       |
| `addressType`                          | `present` \| `permanent` \| `previous` \| `null`                                                                            |
| `respondent`                           | `{ name, relation }` or `null`. Both values are trimmed and can't be blank; `name` is 1–200 characters and `relation` 1–100 |
| `isSignatureCaptured`                  | boolean                                                                                                                     |
| `currentLatitude` / `currentLongitude` | both numbers, or both `null`; one of each fails validation                                                                  |
| `distanceToCaseMeters`                 | finite number ≥ 0, or `null` when the case location is unknown                                                              |
| `forceProceed`                         | boolean. `true` if the field executive bypassed the geo-fence                                                               |

**`verified_clear` also requires** non-null `residenceType`, `addressType` and `respondent`, and
`isSignatureCaptured: true`. The app checks the same rules before it sends the request
(`FullScanApp/src/domain/case/verification-outcome-validation.ts`).

### Outcome response `200`

The component summary, in the same shape as a section 4 list item:

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

### Outcome errors

A `verified_clear` body that breaks the rules returns `400`, with one entry per failing field:

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "path": "body.currentLongitude",
      "message": "currentLongitude must be a number when currentLatitude is set"
    },
    {
      "path": "body.residenceType",
      "message": "residenceType is required for verified_clear"
    },
    {
      "path": "body.addressType",
      "message": "addressType is required for verified_clear"
    },
    {
      "path": "body.respondent",
      "message": "respondent is required for verified_clear"
    },
    {
      "path": "body.isSignatureCaptured",
      "message": "isSignatureCaptured must be true for verified_clear"
    }
  ]
}
```

| Status | `error`                                                                          |
| ------ | -------------------------------------------------------------------------------- |
| 400    | `Unknown verificationStatus`                                                     |
| 404    | `Case component not found: <id>`: the id is unknown, or assigned to someone else |

---

## 9. `POST /security/mock-location`: report a faked GPS location

**When:** the location check finds a mock location after login, on app resume, on a manual recheck, or
at photo capture (`mock-location-reporter.ts`). Retries with the same `clientEventId` are safe: the
server records the event only once. Bearer.

### Mock-location request

The app always sends `device` with all 13 keys. It sends `fix` only when it has a location fix, and
`caseId` only when the detection happened inside a case.

```json
{
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
}
```

| Field            | Rules                                                                                                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clientEventId`  | **required**. String, 1–100 characters, generated on the device; it de-duplicates retries                                                                                          |
| `detectionStage` | **required**. `post_login` \| `app_resume` \| `manual_recheck` \| `photo_capture`                                                                                                  |
| `detectedAt`     | **required**. String, 1–40 characters, from the device clock                                                                                                                       |
| `fix`            | optional. Every key is optional: `latitude` −90 to 90, `longitude` −180 to 180, `accuracyMeters` 0 to 1 000 000, `capturedAt` up to 40 characters, `source` `fresh` \| `lastKnown` |
| `caseId`         | optional. Component id, up to 100 characters                                                                                                                                       |
| `device`         | optional. Every key is optional                                                                                                                                                    |

### Mock-location response `201` or `200`

`201` means the first delivery. `200` means a retry with the same `clientEventId`, and has
`isDuplicate: true`.

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

## 10. `POST /auth/logout`: revoke this mobile session

**When:** Logout in the drawer (`app-drawer-content.tsx`). The app reads the stored token, deletes it,
then sends this request with the token it read. If there's no stored token, it sends nothing. The call
is best-effort: network errors, timeouts and `401`s are logged and ignored, and the user stays logged
out on the device. Bearer.

### Logout request

No body.

```http
POST /auth/logout
Authorization: Bearer <token>
```

### Logout response `200`

```json
{ "success": true, "data": { "signedOut": true } }
```

Logout doesn't change the device binding, so the next login on the same phone works. Any later call with
the same token returns `401`:

```json
{ "success": false, "error": "Invalid or expired authentication token" }
```
