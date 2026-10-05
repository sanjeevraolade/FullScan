# Enhance login — fewer calls at login time

Login goes from three sequential requests (`/auth/login`, `/me`, `/reference-data`) to two:
`/auth/login` returns the token **and** the profile, and reference data moves to `/master-data`.

> **Extended by [master-data-sync.md](master-data-sync.md):** the login 200 also carries
> `masterDataUpdatedAt`, `/master-data` carries a top-level `updatedAt`, and the app skips
> `/master-data` when the two match its cached copy.
>
> **Extended by [mobile-logout.md](mobile-logout.md):** the login token carries a `sessionVersion`
> claim, each successful login revokes every earlier mobile token for the account, and
> `POST /api/v1/auth/logout` revokes the current one.

## `POST /api/v1/auth/login`

- **Auth:** none.
- **Request:** unchanged — `{ username, password, deviceId, deviceDetails }` (`loginSchema`).
- **200:**

  ```json
  {
    "success": true,
    "data": {
      "token": "<jwt>",
      "fieldExecutive": { "id": "fe-001", "name": "…", "email": "…", "role": "…" }
    }
  }
  ```

  `fieldExecutive` is exactly the `GET /api/v1/me` `data` shape — both built by `toFieldExecutive()` in
  `FullScanServer/src/services/field-executive.service.ts`. Never includes `password_hash`, `device_id`
  or `device_details`.
- **Errors (unchanged):** `400` validation / missing device ID, `401` invalid username or password
  (no `token`, no `fieldExecutive` in the body), `403` device bound to another user / account bound to
  another device.

## `GET /api/v1/master-data` (replaces `GET /api/v1/reference-data`)

- **Auth:** unchanged from `/reference-data` (no `authenticate` middleware today).
- **200:** unchanged payload — `{ success: true, data: ReferenceData }` (dropdown/option lists plus
  `mobileAppSettings`).
- **`GET /api/v1/reference-data` is removed, not aliased** → `404`. App builds that predate this change
  lose reference data and `mobileAppSettings` at login.

## `GET /api/v1/me`

Unchanged and still served. The app no longer calls it at login.

## App consumption

- `login()` in `authentication-repository.ts` returns `Promise<FieldExecutive>` from
  `data.fieldExecutive`.
- After `login()` resolves, both login paths (password and biometric) call only `fetchReferenceData()`,
  then write `setReferenceData(...)` **before** `setFieldExecutive(...)` — setting the session starts
  location validation, which reads `mobileAppSettings`.
- `field-executive-repository.ts` is deleted (its only callers were the two login paths).
- Internal names stay as they are: `ReferenceData`, `useReferenceDataStore`, `fetchReferenceData`,
  `reference-data` folders/files. Only the URL changes.
