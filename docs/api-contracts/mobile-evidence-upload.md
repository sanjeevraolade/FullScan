# Mobile evidence upload — camera photos from the app to the server

Today the app captures geotagged, watermarked photos (Case Details → Photo Evidence → camera), keeps
them on the device, and never sends them: `POST /cases/:caseId/verification-outcome` carries the form
only. The server stores evidence only from the FE web portal (`source = 'web_upload'`).

After this change the app uploads every captured photo, one request per photo, **before** it submits the
verification outcome. The server stores them in `case_evidence` with `source = 'mobile_capture'` and the
capture metadata, and the existing web and admin evidence lists show them alongside web uploads.

## `POST /api/v1/cases/:caseId/evidence`

- **Auth:** field-executive JWT (`authenticate`), the same as every other `/api/v1/cases` route. An FE
  web cookie or admin cookie on its own → `401`.
- **`:caseId`** is a **component** id, as on every mobile `/cases/:caseId` route.
- **Content type:** `multipart/form-data`. Anything else → `415`.

### Request parts

| Part               | Kind | Rule                                                                                          |
| ------------------ | ---- | --------------------------------------------------------------------------------------------- |
| `file`             | file | Exactly one. JPEG only, checked by magic bytes (the client's `Content-Type` is ignored). ≤ 10 MB |
| `documentTypeCode` | text | Required. A `code` of the `photo_type` master-data category (e.g. `house_photo_1`)              |
| `latitude`         | text | Required. Decimal number, −90 … 90                                                              |
| `longitude`        | text | Required. Decimal number, −180 … 180                                                            |
| `accuracyMeters`   | text | Required. Decimal number ≥ 0                                                                    |
| `capturedAt`       | text | Required. ISO 8601 datetime with offset or `Z`, e.g. `2026-10-04T09:15:02.123Z`                 |
| `isMockLocation`   | text | Required. `"true"` or `"false"`                                                                 |

No other parts are accepted (unknown text fields → `400`).

- The file's name is a display name only. The app sends `<documentTypeCode>-<capturedAt epoch ms>.jpg`;
  the server keeps a sanitized copy (no path segments, control characters stripped, ≤ 255 chars).
- `capturedAt` is the device clock and is stored as given (converted to the server's stored timestamp
  format). It is not checked against server time — device clocks drift. `uploadedAt` is the server's.
- `isMockLocation: "true"` is **accepted and recorded**, not rejected. The app refuses to capture under a
  mocked location, so a `true` here means a modified client or a bug — the record keeps it visible to
  the back office. The server logs a warning (no coordinates in the log).

### Rules

- The component must be assigned to the signed-in field executive. Unknown id, someone else's
  component → the same `404 Case not found`, so the route can't be used to probe ids.
- The component must be in the **`pending`** or **`beyond_tat`** bucket. `new` (not accepted yet) or
  `completed` → `409`.
- **Idempotent by content.** The server hashes the bytes (SHA-256). If a `mobile_capture` record with the
  same `sha256` already exists for this component, nothing is written and the existing record is
  returned with **`200`** instead of `201`. Every watermarked capture has unique bytes, so this is what
  makes a retry after a lost response safe. First write wins — metadata on the replay is ignored.
  Enforced by a partial unique index on `{ component_id, sha256 }` where `source = 'mobile_capture'`, so
  two concurrent retries can't both insert (the loser returns the winner's record with `200`).
- All-or-nothing per request: the file is written to disk only after validation, and removed again if
  inserting the row fails.
- Evidence is immutable: there is no update or delete endpoint, on any scope.

### 201 Created (new) / 200 OK (already uploaded)

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

`capturedAt` / `uploadedAt` use the server's usual `YYYY-MM-DD HH:MM:SS` UTC format. The storage path
is never returned.

### Errors

Envelope: `{ "success": false, "error": "<message>" }`; Zod failures add `details: [{ path, message }]`.

| Status | When                                                                                       |
| ------ | ------------------------------------------------------------------------------------------ |
| `400`  | Missing/invalid text part, unknown `documentTypeCode`, unknown extra part, no file, more than one file, file not in the `file` part |
| `401`  | Missing/invalid mobile JWT                                                                 |
| `404`  | `Case not found` — unknown component, or not assigned to this field executive              |
| `409`  | Component is `new` (accept it first) or `completed` (closed to new evidence)               |
| `413`  | File larger than 10 MB                                                                     |
| `415`  | Not `multipart/form-data`, or the file is not a JPEG                                       |

## Storage — `case_evidence`

- `source` allows `'web_upload' | 'mobile_capture'`.
- New fields, **required when `source = 'mobile_capture'`**, absent (or `null`) on web uploads:
  `document_type_code`, `latitude`, `longitude`, `accuracy_meters`, `is_mock_location`, `captured_at`.
- Files go under the same `UPLOAD_DIR`, `evidence/<componentId>/<id>.jpg`.
- Existing web rows are untouched (no data migration needed beyond the validator/index change).

## Existing evidence lists now include mobile captures

`GET /api/v1/fe-web/cases/:componentId/evidence` and `GET /api/v1/admin/cases/:caseId/evidence` return
mobile captures alongside web uploads, newest first by `uploadedAt`. Each item gains:

| Field              | Type                                  | Web upload | Mobile capture |
| ------------------ | ------------------------------------- | ---------- | -------------- |
| `source`           | `'web_upload' \| 'mobile_capture'`    | `web_upload` | `mobile_capture` |
| `documentTypeCode` | `string \| null`                      | `null`     | set            |
| `latitude`         | `number \| null`                      | `null`     | set            |
| `longitude`        | `number \| null`                      | `null`     | set            |
| `accuracyMeters`   | `number \| null`                      | `null`     | set            |
| `isMockLocation`   | `boolean \| null`                     | `null`     | set            |
| `capturedAt`       | `string \| null`                      | `null`     | set            |

The web front ends (`web-fe/`, `web-admin/`) validate these responses with Zod (`source:
z.literal('web_upload')` today) and **must** be updated in the same change, or their evidence lists
break the moment the first mobile capture exists.

## App behaviour

1. **When:** on Submit in Case Details, after the existing checks and before
   `POST /cases/:caseId/verification-outcome`. Photos are not uploaded at capture time — the executive
   can still delete them until they submit, and server evidence can't be deleted.
2. **How:** one request per photo, sequentially, in capture order. A photo already recorded as
   uploaded (see 3) is skipped.
3. **Upload receipts are persisted** (MMKV, per case, keyed by the photo's local file path → evidence
   `id`), so a retry — even after an app restart — only uploads what is left. Both `201` and `200` count
   as uploaded. Receipts for a case are cleared when its outcome submission succeeds.
4. **Any failed upload stops the submit:** the outcome is not sent, the executive sees an error and can
   retry. `409` maps to a "case is closed to new evidence" message; every other failure (network,
   timeout, missing local file, 4xx/5xx) maps to a generic "photos could not be uploaded, try again".
5. The outcome request and payload are unchanged.
6. Logging: counts, document type codes, HTTP status and evidence ids only — never file paths,
   coordinates or bytes.

## Out of scope (follow-ups)

- Background/offline upload queue — uploads happen only during Submit, which already needs a network.
- Requiring a minimum number of photos before the outcome can be submitted.
- Downloading evidence bytes (mobile, web or admin).
- Photos are saved by the camera with `saveToTemporaryFileAsync`, i.e. in the OS temp/cache directory,
  which the OS may purge before the executive submits. Moving them to persistent app storage needs a
  file-system native module and is a separate change.
