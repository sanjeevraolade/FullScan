# Master Data Sync — Skip `/master-data` When Nothing Changed

Before this change, every login downloaded the full master-data payload (dropdown options and mobile
app settings), even when nothing had changed since the last login. Now the server keeps one
"master data updated at" value and returns it from `/auth/login`. The app keeps the last payload on the
device and calls `GET /master-data` only when that value is different from the one stored with
the payload. On most logins, login is now a single request.

API contract: [docs/api-contracts/master-data-sync.md](../api-contracts/master-data-sync.md).

## Login sequence

| Step | Before                                               | After                                                                       |
| ---- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| 1    | `POST /api/v1/auth/login` → token + `fieldExecutive` | `POST /api/v1/auth/login` → token + `fieldExecutive` + `masterDataUpdatedAt` |
| 2    | `GET /api/v1/master-data`, every login               | Only if `masterDataUpdatedAt` differs from the cached copy's `updatedAt`    |

The store writes happen in the same order as before: reference data first, then the session, because
setting the session starts location validation.

## How the version works

- **What it is.** One document in the `app_metadata` collection, `_id: "master_data"`, with an ISO
  8601 `updated_at` that includes milliseconds (`2026-10-04T09:15:02.481Z`). Milliseconds, so two
  admin saves in the same second still produce different values.
- **When it changes.** Every successful `PUT /api/v1/admin/mobile-app-settings` changes it, in the
  same transaction as the settings write. A rejected save doesn't. Migration
  `002_init_master_data_version` creates it. From now on, **any migration that changes
  `dropdown_options` or `mobile_app_settings` rows, or the `/master-data` payload shape, must call
  `bumpMasterDataVersion(db, session)`**. Otherwise devices that already have a copy never see the
  change. The rule is written on `MIGRATIONS` in `src/db/migrations/index.ts`.
- **Where it's returned.** `masterDataUpdatedAt` on the login 200, and `updatedAt` at the top level of
  the `/master-data` payload. On `/master-data`, the server reads the version *before* the data, so a
  change that lands during the read can only cost one extra fetch next time. It can never hide the
  change from the app.
- **How the app compares.** Equal or not equal, never older or newer. If the two values differ in
  either direction, the app fetches, so a server clock correction or database restore can't leave a
  device stuck on old data. `null` (an older server, or a missing document) always means "fetch".

`mobileAppSettings.updatedAt` is unchanged and isn't the same thing: it covers settings only and uses
the `YYYY-MM-DD HH:MM:SS` format.

## App behaviour

| Situation                                                        | What happens                                               |
| ---------------------------------------------------------------- | ---------------------------------------------------------- |
| Cached copy exists and its `updatedAt` equals `masterDataUpdatedAt` | Uses the cached copy. No `/master-data` request          |
| Versions differ, no cached copy, server value is `null`, or cached entry is corrupt or the wrong shape | Fetches `/master-data` and saves the response |
| Fetch fails                                                      | Login fails as before, with the same error. **No fallback to the stale cached copy**, because stale geo-fence settings must not decide access. The cached entry is left as it was |
| Saving to the device fails after a successful fetch              | Login still succeeds. The next login fetches again       |
| Logout                                                           | Clears the in-memory store. **Keeps** the copy on the device, since master data isn't per-user |

The payload is saved in MMKV under `master-data:v1`. **Bump `v1` whenever the app's `ReferenceData`
shape changes**, so an upgraded build never reads a payload saved by an older build.

## Compatibility

Old app with new server: the new fields are ignored. New app with old server: `masterDataUpdatedAt`
is missing, so the app fetches on every login, as it did before. No forced upgrade, and either side
can be deployed first.

## Server changes (FullScanServer)

| File                                                   | Change                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| `src/db/app-metadata.dao.ts` (new)                     | `findMasterDataUpdatedAt()` (read-only), `bumpMasterDataUpdatedAt()` (upsert, joins the current transaction) |
| `src/types/app-metadata.types.ts` (new)                | `MASTER_DATA_METADATA_ID`, `AppMetadataDocument`                         |
| `src/db/migrations/master-data-version.ts` (new)       | `bumpMasterDataVersion(db, session)` for migrations                      |
| `src/db/migrations/002_init_master_data_version.ts` (new) | Creates the first version                                             |
| `src/db/migrations/index.ts`                           | Registers `002`. Comment gives the master-data rule                      |
| `src/db/schema.ts`                                     | Adds the `app_metadata` collection and validator. `LEGACY_TABLE_NAMES` split out so the SQLite tooling in `scripts/` doesn't look for an `app_metadata` table. `applySchema()` skips `createIndexes` when a collection has no indexes |
| `src/db/timestamp.ts`                                  | `nowIsoTimestamp()`                                                      |
| `src/db/mobile-app-setting.dao.ts`                     | Bumps the version inside the settings-write transaction                  |
| `src/services/reference-data.service.ts`, `src/types/reference-data.types.ts` | Reads the version first and adds top-level `updatedAt` |
| `src/services/auth.service.ts`, `src/types/auth.types.ts` | Login returns `masterDataUpdatedAt`, read only after every check passes |
| `scripts/sqlite-legacy/sqlite-source.ts`, `scripts/generate-mongo-seed.ts`, `scripts/migrate-sqlite-to-mongo.ts` | Use `LEGACY_TABLE_NAMES` |
| `README.md`, `docs/ADMIN_PORTAL.md`, `docs/sqlite-migration-mongodb.md` | Response shapes and a "Master data version" section |

## App changes (FullScanApp)

| File                                                       | Change                                                                  |
| ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/domain/reference-data/reference-data.entity.ts`       | `ReferenceData.updatedAt: string \| null`                               |
| `src/repositories/authentication-repository.ts`            | `login()` resolves `LoginResult { fieldExecutive, masterDataUpdatedAt }` |
| `src/repositories/reference-data-repository.ts`            | Explicit DTO mapping. `fetchReferenceData()` fetches and saves. New `loadReferenceData(serverUpdatedAt)` chooses between the cache and the network |
| `src/features/authentication/hooks/use-login-form.ts`, `use-biometric-login.ts` | Call `loadReferenceData(masterDataUpdatedAt)`         |
| `src/navigation/app-drawer-content.tsx`                    | Comment explaining why logout keeps the copy on the device              |
| `src/store/reference-data/*`, `docs/features-added/code-execution-flow.md` | Doc comments and the login step table                     |

## Tests

- **Server.** New `tests/master-data-version.test.ts` (20 tests) covers:
  - the version's ISO-with-milliseconds format, and that login and `/master-data` agree
  - a successful settings save, including one that changes nothing, bumps the version; a rejected
    save (`400`, `401`, `403`) doesn't
  - a failed transaction rolls back the bump too (shown to fail if the bump is moved outside the
    transaction)
  - a missing document → `null` on both endpoints
  - migration `002` on a fresh database

  `tests/auth.test.ts` also checks that the login 200 has exactly these keys, and that error
  responses carry no version. Typecheck is clean, and the full suite passes (25 files, 337 tests).
- **App.**
  - `reference-data-repository.test.ts` (25 tests) covers:
    - cache hit with no request
    - a fetch for every miss reason, including a server value *older* than the cached one, and a
      corrupt or wrong-shape entry
    - a failed fetch leaves the cache untouched
    - no payload contents are logged
  - `login-screen.test.tsx` checks that both login paths pass the version through, still store
    reference data before the session, and make no `/master-data` request on a cache hit.
  - `root-navigator.test.tsx` checks that the cached copy survives logout.
  - Typecheck is clean, and the full suite passes (34 suites, 388 tests).
- **Lint.** `npm run lint` in `FullScanApp/` can't run: `@typescript-eslint/eslint-plugin` isn't
  installed. This was already the case before this change.
