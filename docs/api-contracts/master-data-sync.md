# Master data sync — skip `/master-data` when nothing changed

The server keeps one "master data updated at" value and changes it whenever master data
(dropdown options or mobile app settings) changes. `/auth/login` returns that value. The app keeps the
last master-data payload on the device and calls `GET /master-data` only when the value from login
differs from the one stored with that payload.

Builds on [enhance-login.md](enhance-login.md).

## The version value

- **Opaque to the app.** The server writes it as an ISO 8601 UTC timestamp with milliseconds
  (`"2026-10-04T09:15:02.481Z"`). The app never parses or orders it, it only checks whether the two
  values are equal. Any difference, newer or older, means "fetch". That still works after a server
  clock correction or a database restore.
- Milliseconds, not the usual stored `YYYY-MM-DD HH:MM:SS` format. With second resolution, two
  admin saves in the same second would leave the value unchanged, and an app that fetched between
  them would keep the stale copy until the next change.
- `null` means the server has no recorded version. The app treats `null` as "unknown" and always
  fetches.

## `POST /api/v1/auth/login`

- **Auth / request:** unchanged.
- **200:** `data` gains `masterDataUpdatedAt`:

  ```json
  {
    "success": true,
    "data": {
      "token": "<jwt>",
      "fieldExecutive": { "id": "fe-001", "name": "…", "email": "…", "role": "…" },
      "masterDataUpdatedAt": "2026-10-04T09:15:02.481Z"
    }
  }
  ```

  Type `string | null`.
- **Errors:** unchanged. `400` / `401` / `403` bodies don't include `masterDataUpdatedAt`.

## `GET /api/v1/master-data`

- **Auth:** unchanged (none).
- **200:** `data` gains a top-level `updatedAt: string | null`, the version this payload belongs to.
  The other fields are unchanged.

  ```json
  {
    "success": true,
    "data": {
      "updatedAt": "2026-10-04T09:15:02.481Z",
      "verificationTypeStatuses": [ … ],
      "…": "…",
      "mobileAppSettings": { "values": { … }, "updatedAt": "2026-10-04 09:15:02" }
    }
  }
  ```

- **Read order:** the server reads the version **before** it reads dropdowns and settings. If a
  change lands during the read, the version can only end up older than the data, which costs one
  harmless extra fetch on the next login. It can never end up newer, which would hide the change
  from the app until the next one.
- `mobileAppSettings.updatedAt` stays as it is. It covers settings only, not dropdowns.

## Server — storage and when the value changes

- One document: collection `app_metadata`, `_id: "master_data"`, field `updated_at` (the ISO string
  above). It's registered in `src/db/schema.ts` like every other collection.
- **`PUT /api/v1/admin/mobile-app-settings`** sets `updated_at` to now **in the same transaction**
  as the settings write. A rejected batch (`400`) doesn't touch it. A successful save that changes
  nothing still bumps it, which is harmless.
- **New migration `002_init_master_data_version`** upserts the document with now. Existing
  databases get a version, and fresh ones get it right after `001`.
- **Rule from now on:** any migration that inserts, updates or deletes `dropdown_options` or
  `mobile_app_settings` rows, and any server change to the master-data payload shape, also bumps
  `updated_at` in that migration. This goes in the comment on `MIGRATIONS` in
  `src/db/migrations/index.ts`.
- If the document is missing at read time, both endpoints return `null`. The read path never writes.

## App — consumption

- `login()` resolves with `{ fieldExecutive, masterDataUpdatedAt }`. A missing field (older server)
  maps to `null`.
- The master-data payload, including its `updatedAt`, is persisted in MMKV through
  `KeyValueStorageService` under key **`master-data:v1`**. `v1` is the app's cache-schema version:
  bump it whenever the app's `ReferenceData` shape changes, so an upgraded build never reads a
  payload shaped for the previous one. The data isn't sensitive (option labels and settings, no
  PII), so MMKV is the right store, not Keychain.
- **Decision on both login paths** (password and biometric), after `login()` resolves:
  - `masterDataUpdatedAt` is non-null **and** a cached payload exists **and**
    `cached.updatedAt === masterDataUpdatedAt` → use the cached payload. No network call.
  - Otherwise → `GET /master-data`, persist the response, and use it.
  - A corrupt or unparseable cache entry counts as a miss.
- **Fetch failure:** login fails exactly as it does today, with the same error mapping. A stale
  cached copy is **not** used as a fallback, because stale geo-fence settings must not decide
  access. The existing cache entry is left untouched.
- Store ordering is unchanged: `setReferenceData(...)` before `setFieldExecutive(...)`.
- **Logout** clears the in-memory store but **keeps** the persisted copy. Master data isn't per-user
  (`/master-data` isn't authenticated), and keeping it is what saves the call on the next login.
- `useReferenceDataLoader.reload()` also persists what it fetches.

## Compatibility

| App \ Server | Old server                                           | New server                     |
| ------------ | ---------------------------------------------------- | ------------------------------ |
| Old app      | —                                                    | Extra fields ignored. Works.   |
| New app      | No `masterDataUpdatedAt` → `null` → always fetches (today's behaviour) | Skips the fetch when unchanged |

No forced upgrade and no deploy ordering needed.
