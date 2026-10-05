# Verification outcome — validation and full persistence

`POST /api/v1/cases/:caseId/verification-outcome` records the field executive's outcome and moves the
component to Completed. Today the server has two problems with it:

1. **It stores only part of the outcome.** Only `verificationStatus` and `respondent` are saved. The
   UTV/Insufficient reasons and remarks, residence type, address type and signature flag are dropped. So
   are the submit-time location (`currentLatitude`, `currentLongitude`, `distanceToCaseMeters`) and
   `forceProceed`. The app's Force Proceed consent dialog tells the executive the case will be scrutinized,
   but the server never records that the geo-fence was bypassed.
2. **It does not enforce the outcome rules.** A Verified Clear outcome with no residence or respondent
   details is accepted, and any string is accepted as a status.

After this change the server validates the outcome with the same rules the app applies before Submit,
and stores every field the app sends.

## `POST /api/v1/cases/:caseId/verification-outcome`

- **Auth:** field-executive JWT (`authenticate`). Unchanged.
- **`:caseId`** is a **component** id, as on every mobile `/cases/:caseId` route.
- **Ownership:** the component must be assigned to the calling field executive
  (`assigned_field_executive_id` = the JWT's executive). Otherwise the server answers `404`, the same as
  for an unknown id. A case from the New pool is assigned when it is accepted, so it can only be
  submitted by the executive who accepted it.
- **Content type:** `application/json`. The global JSON body limit applies. Unchanged.

### Request body

This is the body the app already sends. Every key is required, and `null` is allowed only where marked.

```json
{
  "verificationStatus": "verified_clear",
  "utvReason": null,
  "utvRemarks": null,
  "insufficientReason": null,
  "insufficientRemarks": null,
  "residenceType": "owned",
  "addressType": "present",
  "respondent": { "name": "Anita Sharma", "relation": "Mother" },
  "isSignatureCaptured": true,
  "currentLatitude": 17.4461,
  "currentLongitude": 78.3821,
  "distanceToCaseMeters": 98.4,
  "forceProceed": false
}
```

| Field                                 | Type and rule                                                                                                                                                     |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verificationStatus`                  | string, 1–100 chars. Must be a `verification_type_status` code in `dropdown_options`. Otherwise `400 Unknown verificationStatus`.                                 |
| `utvReason`, `insufficientReason`     | string ≤ 200 chars, or `null`. Unchanged.                                                                                                                         |
| `utvRemarks`, `insufficientRemarks`   | string ≤ 2000 chars, or `null`. Unchanged.                                                                                                                        |
| `residenceType`                       | `owned` · `rented` · `hostel` · `paying_guest` · `company_quarters` · `relative_owned`, or `null`. Unchanged.                                                     |
| `addressType`                         | `present` · `permanent` · `previous`, or `null`. Unchanged.                                                                                                       |
| `respondent`                          | `{ name: 1–200 chars, relation: 1–100 chars }`, or `null`. **New:** both values are trimmed first, so whitespace-only is rejected; the trimmed values are stored. |
| `isSignatureCaptured`                 | boolean. Unchanged.                                                                                                                                               |
| `currentLatitude`, `currentLongitude` | **New, required.** Number (−90…90 and −180…180), or `null`. Either both are `null` or both are numbers.                                                           |
| `distanceToCaseMeters`                | **New, required.** Number ≥ 0, or `null` when the case location could never be determined.                                                                        |
| `forceProceed`                        | **New, required.** Boolean. The server never defaults it, because a silent `false` would hide a geo-fence bypass.                                                 |

Other keys are ignored, as today.

### Outcome rules

These rules mirror the app's `FullScanApp/src/domain/case/verification-outcome-validation.ts`. When the
rules change, update both sides and this section together.

- **`verified_clear`:** `residenceType` and `addressType` must be non-null, `respondent` must be non-null,
  and `isSignatureCaptured` must be `true`.
- **Any other status:** nothing beyond the type rules above. Whatever the app sent is stored as sent. The
  app sends `null` for sections it is not showing.
- **At least one photo (app only, for now):** the app refuses to submit any outcome until at least one
  photo has been captured. It uploads those photos before it sends the outcome. **The server does not
  check this yet.** Enforcing it would mean counting the component's `case_evidence` records before
  accepting the outcome.

### Responses

- **200:** `{ "success": true, "data": <case summary DTO> }`. Unchanged; see
  [cases-by-tab.md](cases-by-tab.md).
- **400 — shape or outcome-rule failure.** The `validate` middleware renders it in the existing format.
  Each failing field is listed, using the same `path` style as other schema failures:

  ```json
  {
    "success": false,
    "error": "Validation failed",
    "details": [
      {
        "path": "body.residenceType",
        "message": "residenceType is required for verified_clear"
      },
      {
        "path": "body.isSignatureCaptured",
        "message": "isSignatureCaptured must be true for verified_clear"
      }
    ]
  }
  ```

  Implementation details:

  - **Rules run after type checks.** The outcome rules and the latitude/longitude pairing are checked
    only once every field has the right type. A body with a type error lists only the type errors.
  - **Latitude/longitude pairing:** the error is reported on whichever of the two is `null`.
  - **Blank respondent:** a whitespace-only value is reported at `body.respondent.name` or
    `body.respondent.relation`, with the message `respondent name must not be blank` (or `relation`).
  - **Finite numbers only:** `distanceToCaseMeters` must be finite, so `1e999` is rejected.

- **400 — unknown status:** `{ "success": false, "error": "Unknown verificationStatus" }`. This is checked
  in the service against `dropdown_options`, after the component lookup. The match is case-sensitive.
- **Check order:** 401 → 400 validation → 404 → 400 unknown status.
- **401:** missing or invalid mobile JWT. Unchanged.
- **404:** `Case component not found: <id>`. Returned when the component doesn't exist **or** isn't
  assigned to the caller. Both cases get the same status and body, so the route can't be used to find out
  which ids exist. Nothing is written.

## Storage — `case_components`

The outcome is stored on the component, next to the existing outcome fields. **The back-office fields
`address_type` and `residence_type` are not touched.** They describe the assignment as the back office
created it, and the sibling-component list shows them. What the executive observed goes into new fields.

| Request field                               | Stored as                                                   |
| ------------------------------------------- | ----------------------------------------------------------- |
| `verificationStatus`                        | `selected_verification_status` (existing)                   |
| `respondent`                                | `respondent_name`, `respondent_relation` (existing)         |
| `utvReason`, `utvRemarks`                   | `utv_reason`, `utv_remarks` (new)                           |
| `insufficientReason`, `insufficientRemarks` | `insufficient_reason`, `insufficient_remarks` (new)         |
| `residenceType`                             | `observed_residence_type` (new)                             |
| `addressType`                               | `observed_address_type` (new)                               |
| `isSignatureCaptured`                       | `is_signature_captured` (new)                               |
| `currentLatitude`, `currentLongitude`       | `submitted_latitude`, `submitted_longitude` (new)           |
| `distanceToCaseMeters`                      | `submitted_distance_meters` (new)                           |
| `forceProceed`                              | `is_force_proceed` (new)                                    |
| —                                           | `outcome_submitted_at` (new): server time of the submission |

- All new fields are nullable. Components that have no outcome yet hold `null`, or don't have the field
  at all; reads treat a missing field as `null`. Components created by the admin path start with these
  fields set to `null`, like `selected_verification_status` today.
- `observed_residence_type` and `observed_address_type` get the same enum checks in `schema.ts` as
  `residence_type` and `address_type`.
- These are field-executive outcome fields. Admin paths never update or delete them, the same as the
  existing outcome fields.
- `bucket` → `completed` and `updated_at` are set as today.

## Out of scope (unchanged by this contract)

- **Read side.** `GET /cases/:caseId`, the admin case APIs and the portals don't return the new fields
  yet. Showing the observed values on a completed case needs a follow-up contract.
- **Bucket checks.** An outcome is accepted for the caller's component in any bucket, and a second
  submission overwrites the first. A completed-case rule needs its own decision, because a lost `200`
  response is currently retried safely by overwriting, and a `409` would break that retry.

## App

The app needs no change for this contract. It already sends exactly this body, and it blocks an
incomplete outcome before upload. A `400` here therefore means the app and server rules have drifted.
The app maps it to the generic "Unable to submit the verification report" message.
