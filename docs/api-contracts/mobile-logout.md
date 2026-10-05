# Mobile logout — server-side session revocation

Today the app's Logout only deletes the token from the device; the 12h mobile JWT stays valid on the
server until it expires. This adds `POST /api/v1/auth/logout`, which revokes it.

Mobile accounts are device-bound (one handset per field executive), so a field executive has at most
one live mobile session. Revocation is a **per-account session version**, not a per-token denylist.

## Session version

- `field_executives.mobile_session_version` — integer, absent on existing documents; **absent reads as `0`**.
- Mobile tokens carry it as the `sessionVersion` claim: `{ fieldExecutiveId, sessionVersion }`.
  A token without the claim (issued before this change) reads as `0`.
- A mobile token is valid only while its `sessionVersion` equals the account's current
  `mobile_session_version`.
- **Login increments** the version (atomically) and signs the new value — every earlier mobile token for
  that account stops working. A login that is refused (401/403/400) changes nothing.
- **Logout increments** the version **only if it still equals the presented token's version** (conditional
  update). A logout that arrives late — after a newer login — therefore never revokes the newer session.
- FE web-portal (`scope: 'fe_web'`) and admin tokens are unaffected — no claim, not checked.

## `authenticate` middleware (all mobile routes)

In addition to today's checks (signature, expiry, `fieldExecutiveId` present, no `scope`):

- Loads the field executive by `fieldExecutiveId`. **Missing account → `401`** (parity with the FE web
  portal's `verifyFeWebToken`).
- Version mismatch → `401`.
- Both use the existing message: `Invalid or expired authentication token`.

## `POST /api/v1/auth/logout`

- **Auth:** mobile bearer token (`authenticate` middleware).
- **Request:** no body.
- **200:**

  ```json
  { "success": true, "data": { "signedOut": true } }
  ```

  Same shape as `/fe-web/auth/logout` and `/admin/auth/logout`.
- **Errors:** `401` — missing, invalid, expired, already revoked, or account deleted (from the middleware).
- **Does not touch device binding.** `device_id`, `device_details` and device history are unchanged —
  moving to another phone still goes through a device change request. The next login on the bound device
  works as normal.

## App consumption

- `logout()` in `authentication-repository.ts`:
  1. Reads the stored token. If there is none, it only clears storage (no request).
  2. **Clears the stored token first**, before any network call. That way a slow or offline logout can't
     wipe a token saved by a login that happens while the request is still in flight.
  3. Sends `POST /auth/logout` best-effort, with the captured token as an explicit
     `Authorization: Bearer <token>` header.
  4. **Never rejects.** Network errors, timeouts and `401` are logged (status only) and swallowed —
     the device is already signed out locally.
- `api-client.ts` request interceptor: if the caller already set an `Authorization` header, it is
  **kept** (not overwritten by the stored token, and not logged as an unauthenticated request).
- Drawer Logout is unchanged in behaviour: fire-and-forget `logout()`, clear in-memory state, replace the
  stack with Login. The user is never blocked on the network.
- An offline logout leaves the old token valid on the server until expiry or the next login. Because
  login increments the version, that next login revokes it.
