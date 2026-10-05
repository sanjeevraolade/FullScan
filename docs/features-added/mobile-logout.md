# Mobile Logout — Revoke the Session on the Server

Before this change, Logout in the app only deleted the token from the device. The server never heard
about it, so the 12h mobile token kept working until it expired — a copy taken off the device could
still be used. Now Logout also calls `POST /api/v1/auth/logout`, which revokes the token on the server.

API contract: [docs/api-contracts/mobile-logout.md](../api-contracts/mobile-logout.md).

## Logout sequence

| Step | Before                                  | After                                                                  |
| ---- | --------------------------------------- | ---------------------------------------------------------------------- |
| 1    | Delete the stored token                 | Read the stored token, then delete it                                  |
| 2    | —                                       | `POST /api/v1/auth/logout` with that token, best-effort                |
| 3    | Clear in-memory state, go to Login      | Unchanged — the user never waits on step 2                             |

## How revocation works

- **One live mobile session per account.** Accounts are bound to one phone, so revocation is a
  per-account counter, not a list of revoked tokens.
- **The counter.** `field_executives.mobile_session_version`, an integer. Mobile tokens carry the same
  value as the `sessionVersion` claim. Absent on either side reads as `0`, so existing accounts and
  tokens need no migration.
- **Checked on every mobile request.** The `authenticate` middleware now loads the account and refuses
  the token (`401 Invalid or expired authentication token`) when the account no longer exists or the
  versions differ.
- **Login moves it on.** Each successful login increments the counter atomically and signs the new
  value, so it revokes every earlier mobile token for the account. A refused login changes nothing.
- **Logout moves it on — conditionally.** Only if it still equals the presented token's version. A
  logout that reaches the server after a newer login leaves that newer session signed in.
- **Device binding is untouched.** Logout doesn't clear `device_id`, `device_details` or device
  history. The next login on the bound phone works as normal; moving to another phone still needs a
  device change request.
- **Other scopes are unaffected.** FE web-portal and admin tokens carry no version and aren't checked.

## App behaviour

| Situation                                        | What happens                                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| Online                                           | Token deleted, then revoked on the server (`200`)                            |
| Offline, timeout, or server error                | Token deleted; the failure is logged (status only) and ignored. The old token stays valid on the server until it expires or the account's next login |
| Token already revoked or expired (`401`)         | Same as above — nothing left to undo                                         |
| No token stored                                  | Storage cleared, no request                                                  |
| Re-login while the logout request is in flight   | The new token survives: the old one was deleted *before* the request was sent |

`logout()` never rejects, so the drawer still fires and forgets it. The token goes in an explicit
`Authorization` header because storage no longer holds it, and the `api-client` interceptor now keeps
a header the caller set instead of replacing it with whatever storage holds.

## Compatibility

- **Deploying the server** doesn't sign anyone out: tokens issued before it have no `sessionVersion`
  and accounts have no counter, and both read as `0`. They keep working until the user logs out or
  logs in again.
- **Old app, new server:** the old app never calls `/auth/logout`, so its logout stays local-only, but
  its next login still revokes the previous token.
- **New app, old server:** `/auth/logout` answers `404`, which `logout()` ignores. Logout behaves as
  it did before.

Either side can be deployed first.

## Server changes (FullScanServer)

| File                                   | Change                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| `src/routes/auth.routes.ts`            | `POST /logout` behind `authenticate`                                            |
| `src/controllers/auth.controller.ts`   | `logout` → `{ success: true, data: { signedOut: true } }`, logs `fieldExecutiveId` |
| `src/services/auth.service.ts`         | Login increments the version and signs it. New `verifyMobileToken()` and `logout()` |
| `src/middleware/authenticate.ts`       | Now async: calls `verifyMobileToken()` and sets `req.mobileSessionVersion`. A database error is a `500` |
| `src/db/field-executive.dao.ts`        | `incrementMobileSessionVersion()` (atomic, returns the new value) and `incrementMobileSessionVersionIfCurrent()` |
| `src/db/schema.ts`                     | `mobile_session_version`, when present, must be an int/long ≥ 0 (`$inc` fails on `null`). Still optional |
| `src/types/auth.types.ts`, `field-executive.types.ts`, `express.d.ts` | `sessionVersion` claim, `MobileSession`, the row field, `req.mobileSessionVersion` |
| `README.md`, `docs/api-curl-reference.md` | Endpoint row, session paragraph, new §1.15, token lifetime column            |

## App changes (FullScanApp)

| File                                               | Change                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| `src/repositories/authentication-repository.ts`    | `logout()`: read token → clear storage → best-effort `POST /auth/logout`; never rejects. Storage failures are logged and logout carries on |
| `src/infrastructure/networking/api-client.ts`      | A caller-supplied `Authorization` header is kept, and logged as authenticated |
| `src/navigation/app-drawer-content.tsx`            | Comment only — behaviour unchanged                                   |

## Tests

- **Server.** New `tests/mobile-logout.test.ts` (35 tests) covers:
  - logout `200`, then the same token gets `401` on `/me` and `/cases/counts`
  - no token, a bad string, a wrong secret, an expired token, a malformed claim → `401`
  - logging out twice; logging in again after logout
  - a second login revokes the first, and concurrent logins get distinct versions
  - a late logout with an older token doesn't revoke a newer login
  - device binding and history unchanged, and re-login on the same phone works
  - a legacy token without the claim; deleted and nonexistent accounts
  - FE web and admin tokens are still refused by the mobile API, and their own logouts still work
  - refused logins leave the version alone; the log line holds no token; the new validator rule

  No existing test needed changing. Typecheck is clean, and the full suite passes (29 files, 566
  tests).
- **App.**
  - `authentication-repository.test.ts`: the request carries the captured bearer token; the token is
    cleared before the request is sent (the order is asserted, and the clear is awaited); a token
    saved by a re-login survives a logout request that later times out; resolves on offline, timeout,
    `401`, `500` and non-axios errors; no request without a token or when the Keychain read fails;
    the token, error message and response body are never logged.
  - `api-client.test.ts` (3 new): a caller-supplied header wins over storage and isn't logged as
    unauthenticated; the stored token is still attached when the caller sets other headers.
  - `root-navigator.test.tsx` (1 new): the user reaches Login even if `logout()` never settles.
  - Typecheck is clean, and the full suite passes (42 suites, 617 tests).
- **Lint.** Neither project's `npm run lint` runs, for reasons that predate this change:
  `FullScanApp/.eslintrc.js` references plugins that aren't installed, and `FullScanServer` has no
  `eslint.config.*` file.

## Known limits

- **An offline logout doesn't reach the server.** The token is gone from the device, but stays valid
  on the server until it expires or the account's next login.
- **The app has no global `401` handling.** A token revoked elsewhere (for example by a login that the
  app didn't make) surfaces as a failed request, not as a return to Login.
- **A device change approval doesn't revoke the old phone's token by itself.** The account's next
  mobile login, on any phone, does.
- **Request logging includes tokens.** `pino-http` (`src/app.ts`, `src/utils/logger.ts`) logs full
  request headers — `Authorization: Bearer …` and the portals' session cookies — and response
  `Set-Cookie`. A pino `redact` setting for those paths is the fix. Not part of this change.
