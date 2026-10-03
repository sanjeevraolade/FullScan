# Enhance Login — Fewer Calls at Login Time

Login used to make three requests one after another: `POST /auth/login`, `GET /me` and
`GET /reference-data`. Now it makes two. `/auth/login` returns the token **and** the field
executive's profile, so the `/me` call is gone. Reference data also moved to a new URL,
`GET /master-data`.

API contract: [docs/api-contracts/enhance-login.md](../api-contracts/enhance-login.md).

## Login sequence

| Step | Before                              | After                                                |
| ---- | ----------------------------------- | ---------------------------------------------------- |
| 1    | `POST /api/v1/auth/login` → token   | `POST /api/v1/auth/login` → token + `fieldExecutive` |
| 2    | `GET /api/v1/me` → profile          | —                                                    |
| 3    | `GET /api/v1/reference-data`        | `GET /api/v1/master-data`                            |

The store writes happen in the same order as before. Reference data (`mobileAppSettings`) goes into
the store first and the session second, because setting the session starts location validation. See
[code-execution-flow.md](../../FullScanApp/docs/features-added/code-execution-flow.md) §1.

## API contract

### `POST /api/v1/auth/login`

The request is unchanged: `username`, `password`, `deviceId`, `deviceDetails`.

```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "fieldExecutive": { "id": "fe-001", "name": "…", "email": "…", "role": "…" }
  }
}
```

`fieldExecutive` has exactly the same shape as the `GET /api/v1/me` response. On the server, both
are built by `toFieldExecutive()` in `src/services/field-executive.service.ts`, so the two can't drift
apart. It never includes the password hash or the device binding. Error responses are unchanged
(`400` validation, `401` bad credentials with no token or profile, `403` device binding).

### `GET /api/v1/master-data` (was `/api/v1/reference-data`)

Only the path changed. The payload is the same: dropdown/option data plus `mobileAppSettings`.
**The old path was removed, not aliased.** A build of the app from before this change gets a 404
from it, and because that build fetches reference data inside its login step, **it can't log in at
all**. It shows the generic network error on both password and biometric login. Ship the server and the
updated app together, or force the upgrade.

### `GET /api/v1/me`

The endpoint is unchanged and still served, but the app no longer calls it.

## App changes (FullScanApp)

| File                                                      | Change                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/repositories/authentication-repository.ts`           | `login()` now returns `Promise<FieldExecutive>`, mapped from the login response before the token is saved |
| `src/features/authentication/hooks/use-login-form.ts`     | Uses the profile from `login()`; only calls `fetchReferenceData()` afterwards |
| `src/features/authentication/hooks/use-biometric-login.ts`| Same as above for biometric login; `restoreSession(fieldExecutive)` now takes the profile |
| `src/repositories/reference-data-repository.ts`           | Calls `/master-data` instead of `/reference-data`                        |
| `src/repositories/field-executive-repository.ts`          | **Deleted.** Its only callers were the two login paths                   |
| `docs/features-added/code-execution-flow.md`              | Login step table updated                                                 |

Internal names didn't change: the `ReferenceData` types, `useReferenceDataStore`,
`fetchReferenceData` and the `reference-data` folders/files. Only the URL was renamed.

## Server changes (FullScanServer)

| File                                         | Change                                                       |
| -------------------------------------------- | ------------------------------------------------------------ |
| `src/services/auth.service.ts`               | Builds `fieldExecutive` with `toFieldExecutive(row)`         |
| `src/controllers/auth.controller.ts`, `src/routes/auth.routes.ts` | Comments now say login returns the profile too |
| `src/app.ts`                                 | Route mounted at `/api/v1/master-data`                       |
| `src/routes/reference-data.routes.ts`, `src/controllers/reference-data.controller.ts` | Comments updated to the new path |
| `README.md`, `docs/ADMIN_PORTAL.md`, `docs/device-change-requests.md` | Current-endpoint references use `/master-data`; historical and changelog entries left as they were |

## Tests

- **App.**
  - `authentication-repository.test.ts` checks that `login()` returns the profile, saves the token
    first, and never logs name, email, token or credentials.
  - New `reference-data-repository.test.ts` checks the `/master-data` URL.
  - `login-screen.test.tsx` and `root-navigator.test.tsx` now set the profile through the `login`
    mock instead of a `/me` mock. They also check that reference data is stored before the session
    on both the password and biometric paths.
  - Typecheck is clean. The auth, login and navigation suites pass (4 suites, 42 tests), and so does
    the full suite (34 suites, 359 tests).
- **Server.**
  - New `tests/auth.test.ts` (6 tests) checks that login returns the same profile `GET /me` serves,
    with no password hash or device binding, and that a wrong password or unknown user gets a 401
    with no token or profile.
  - `tests/reference-data-settings.test.ts` now targets `/api/v1/master-data` and checks that
    `/api/v1/reference-data` returns 404.
  - Typecheck is clean, and the full suite passes (24 files, 315 tests).
  - The suite has existing timing flakiness: an occasional `ECONNRESET` or timeout in a file this
    change doesn't touch. Unchanged `HEAD` shows the same thing.

## Possible next step

Login still makes two requests. To get it down to one, the master-data payload could be added to the
`/auth/login` response.
