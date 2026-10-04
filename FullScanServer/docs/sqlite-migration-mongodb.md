# SQLite → MongoDB Migration — Implementation Notes

FullScanServer used to keep all of its data in one SQLite file (`data/fullscan.sqlite`, via
`better-sqlite3`). It now uses **MongoDB**, through the official `mongodb` Node driver. This document
covers what changed, how to run the server now, how to bring existing SQLite data across, the
design decisions behind the port, and how it was checked.

**The HTTP API did not change.** Every endpoint returns the same JSON as before: same fields,
same values, same timestamp format, same ordering. The mobile app, the FE web app and the admin
app need no changes. The one intentional difference is admin search treating `%` and `_`
literally (see [§8](#8-behaviour-differences)).

Related: [`ADMIN_PORTAL.md`](./ADMIN_PORTAL.md) and [`device-change-requests.md`](./device-change-requests.md).
They describe features that are unchanged, but they name SQL migration files by their old path,
`src/db/migrations/*.sql`. Those files now live in `scripts/sqlite-legacy/migrations/`.

---

## Table of contents

1. [What changed](#1-what-changed)
2. [Running the server](#2-running-the-server)
3. [Moving existing SQLite data across](#3-moving-existing-sqlite-data-across)
4. [Design decisions](#4-design-decisions)
5. [Schema: tables → collections](#5-schema-tables--collections)
6. [Query translation](#6-query-translation)
7. [Migrations and seed data](#7-migrations-and-seed-data)
8. [Behaviour differences](#8-behaviour-differences)
9. [Verification](#9-verification)
10. [Known limits and follow-ups](#10-known-limits-and-follow-ups)
11. [File manifest](#11-file-manifest)

---

## 1. What changed

| | Before (SQLite) | After (MongoDB) |
| --- | --- | --- |
| Driver | `better-sqlite3` (synchronous) | `mongodb` v7 (async) |
| Location | `DB_PATH=./data/fullscan.sqlite` | `MONGODB_URI` + `MONGODB_DB` |
| Schema | `CREATE TABLE` / `CHECK` / indexes in SQL migrations | `src/db/schema.ts`: `$jsonSchema` validators + indexes, applied on every startup |
| Seed data | `INSERT`s inside SQL migrations 002–021 | `src/db/seed/*.json`, generated from those SQL files, loaded by migration `001_seed_initial_data` |
| Migrations | `src/db/migrations/*.sql`, tracked in a `migrations` table | `src/db/migrations/*.ts`, tracked in a `migrations` collection |
| Transactions | `db.transaction(fn)()` | `runInTransaction(async () => …)` — MongoDB transactions, **needs a replica set** |
| DAO functions | return values | return `Promise`s; services, controllers and auth middleware are now `async` |
| Tests | a temp SQLite file per suite | one in-memory MongoDB replica set per run, a fresh seeded database per suite |
| `better-sqlite3` | runtime dependency | dev dependency, used only by the migration tooling |

## 2. Running the server

MongoDB must run as a **replica set**, because the server uses multi-document transactions. A
standalone `mongod` is refused at startup with a message saying so. A replica set can be a single node.

**Local development, no MongoDB install needed:**

```bash
npm run db:dev   # terminal 1: single-node replica set "rs0" on 127.0.0.1:27017, data in ./data/mongo
npm run dev      # terminal 2: the server's defaults already point at it
```

`db:dev` uses `mongodb-memory-server` with a persistent data directory, so data survives a restart.
The first run downloads a MongoDB binary into the package's cache. It is for local
development only.

**Other MongoDB setups:**

- **MongoDB Atlas**: every Atlas cluster is a replica set. Set `MONGODB_URI` to its
  `mongodb+srv://…` connection string.
- **Homebrew / a package install**: start `mongod --replSet rs0`, run `rs.initiate()` once in `mongosh`,
  and use `mongodb://127.0.0.1:27017/?replicaSet=rs0`.

**Environment variables** (`.env`):

| Variable | Default | Notes |
| --- | --- | --- |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/?replicaSet=rs0` | Credentials in the URI are masked in logs |
| `MONGODB_DB` | `fullscan` | Database name |
| `DB_PATH` | — | No longer read by the server; `db:migrate-sqlite` still uses it as its default source |

If your existing `.env` still has `DB_PATH`, it is harmless. Add the two `MONGODB_*` lines if the
defaults don't fit.

**On every startup** `initDb()` does the following:

1. Connects and checks that the server is a replica set.
2. Creates any missing collection and re-applies every validator and index. This is idempotent.
3. Runs any pending migration. On an empty database that is `001_seed_initial_data`, which loads
   the test data.

`npm run migrate` does the same and then exits, so you can run it ahead of a deploy.

**Resetting data**: drop the database (for example, `db.getSiblingDB("fullscan").dropDatabase()`
in `mongosh`). The next start recreates and reseeds it.

## 3. Moving existing SQLite data across

A dev server that has been running for a while has data that isn't in the seed:

- device bindings and their history
- device change requests
- mock-location detections
- admin accounts and settings changes
- accepted and completed cases
- evidence records

To keep that data instead of starting over, copy the SQLite file across once:

```bash
npm run db:dev                                      # or any replica set; set MONGODB_URI/MONGODB_DB
npm run db:migrate-sqlite                           # reads ./data/fullscan.sqlite (or $DB_PATH)
npm run db:migrate-sqlite -- --sqlite path/to/other.sqlite
npm run db:migrate-sqlite -- --drop                 # replace a MongoDB database that already has data
```

What the script (`scripts/migrate-sqlite-to-mongo.ts`) does:

1. **Takes a snapshot** of the SQLite file with SQLite's online backup API. The source file is
   never written to, and a server that still has it open is not disturbed.
2. **Brings the snapshot up to date.** Any of the 22 legacy SQL migrations the file is missing is
   applied to the snapshot first, exactly as the old `initDb()` would have, so every table is in
   its final shape.
3. **Refuses to overwrite.** If the target MongoDB database already holds FullScan data, the
   script stops unless you pass `--drop`. With `--drop`, it drops the FullScan collections and
   the `migrations` collection first.
4. **Applies the schema, then copies every table** in `rowid` order, one document per row. Field
   names and values are copied unchanged.
5. **Records `001_seed_initial_data` as applied**, because the copied data already contains the
   seed and it must not be loaded a second time.
6. **Compares document counts with row counts** for every collection and fails if any differ.

Output from copying this repository's `data/fullscan.sqlite`:

```
Collection                 SQLite rows   MongoDB docs
ui_configs                           4              4
field_executives                    51             51
cases                              607            607
case_components                    662            662
dropdown_options                    39             39
admin_users                          5              5
mobile_app_settings                 19             19
mock_location_events                 8              8
device_change_requests               1              1
field_executive_devices              5              5
case_evidence                        0              0
```

Evidence **files** stay where they are, under `UPLOAD_DIR`. Only their metadata rows move.

## 4. Design decisions

### The driver, not an ODM

The DAO layer already kept all SQL out of the services, and each DAO returns a typed `*Row` that
a service maps to an API shape. Only the DAOs needed rewriting. The `*Row` types and every
mapper stay as they were. An ODM such as Mongoose would have added a second schema definition
next to the row types, for no gain.

### Documents mirror the old rows

- **Same names.** Every collection has the same name as its table, and every field has the same
  snake_case name as its column.
- **Primary key in `_id`.** Each table's primary key value moves to `_id`: `id` for every table
  except `mobile_app_settings`, which uses `setting_key`. The keys stay the same strings (UUIDs,
  `fe-001`, `admin-001`…), so no reference between collections changed.
- **Explicit nulls.** Every column is written on insert, with explicit `null`s and the defaults
  SQLite used to fill in. A read therefore returns `null` rather than a missing field, which
  matters because `JSON.stringify` drops `undefined` and would silently remove keys from API
  responses.

`src/db/documents.ts` holds the shared helpers:

- `fromDocument()` turns `_id` back into `id` when a document is read.
- `EXPOSE_ID` does the same as the last stages of an aggregation pipeline.
- `JOIN_PARENT_CASE`, `leftJoinFields()` and `containsText()` build the join and search stages.

### Timestamps stay text; flags stay 0/1

- **Timestamps.** SQLite's `datetime('now')` wrote UTC text as `YYYY-MM-DD HH:MM:SS`. Every API
  response, both web apps and the mobile app read that exact string, and several services compare
  or sort timestamps as strings. Documents keep the same format, generated by
  `src/db/timestamp.ts` (`nowTimestamp()`, `timestampDaysAgo()`). Switching to BSON dates would
  change every API timestamp, so it belongs in a separate change (see [§10](#10-known-limits-and-follow-ups)).
- **Flags.** The boolean columns `is_active`, `is_emulator` and `gps_is_within_range` stay the
  numbers `0`/`1`, because the services compare them with `=== 1`.

### `insert_order` stands in for `rowid`

When two rows shared a timestamp, SQLite returned them in insertion (`rowid`) order. Some queries
used this explicitly (`ORDER BY requested_at DESC, rowid DESC`). Others relied on it implicitly:
the field executive's case list sorted `ORDER BY updated_at DESC`, and most seeded components
share a single `updated_at`.

MongoDB string `_id`s have no insertion order. So four collections carry a hidden `insert_order`
ObjectId, which increases with each document written, and sort on it wherever SQLite fell back on
`rowid`:

- `case_components`
- `case_evidence`
- `device_change_requests`
- `field_executive_devices`

The seed migration and the copy script assign `insert_order` in `rowid` order. `fromDocument()` and
`EXPOSE_ID` strip it, so it never reaches a `*Row` or a response. Without it, the case lists came
back in a different order than before; with it, the order matches exactly (see [§9](#9-verification)).

### Transactions

`runInTransaction(work)` in `src/db/connection.ts` wraps the driver's `session.withTransaction()`
(read concern `snapshot`, write concern `majority`). It keeps the session in `AsyncLocalStorage`,
and every DAO call adds `...sessionOption()` to its driver options. Each DAO function therefore
works both on its own and as one step inside a transaction, without a `session` parameter, as it
could under `better-sqlite3`. A `runInTransaction` called inside another one joins it.

The same writes are still transactional:

- creating and updating a case with its components
- a device change request's check-and-insert
- approving and rejecting a request
- recording a mobile login's device binding
- a batch of settings changes
- a batch of evidence rows
- each migration, together with its record in `migrations`

Two rules for code inside `work`:

- **Run steps one after another.** A session cannot run operations in parallel, so don't use
  `Promise.all` inside a transaction.
- **Make it safe to rerun from the start.** The driver retries the whole callback on a transient
  error, such as a write conflict with a concurrent request.

`AppError`s thrown inside roll the transaction back and propagate as before.

### Foreign keys → service checks

MongoDB has no foreign keys, and `PRAGMA foreign_keys = ON` used to reject dangling references.
Every write path already checked its references before writing, and those checks now carry the
integrity:

- the case assignee exists: `assertFieldExecutiveExists`
- status codes exist in `dropdown_options`: `assertKnownDropdownCode`
- a component belongs to the case being updated: `ownedComponentIds`
- the reporting field executive exists before a mock-location event is stored
- an admin who is referenced by the audit trail cannot be deleted: `countAdminAuditReferences`

Everything else is written only by the server, with ids it has just read. Hand-edits in `mongosh`
are not protected the way they were in SQLite.

## 5. Schema: tables → collections

All of the following lives in `src/db/schema.ts` (`COLLECTIONS`), and `applySchema()` applies it
on every start.

- **Validators.** Every `NOT NULL` column becomes *required and not null*, and every `CHECK`
  becomes a `$jsonSchema` rule. Validation level is `strict` with action `error`: an invalid write
  fails, as it did in SQLite.
- **Enum lists.** The allowed values come from the existing type constants where one exists
  (`CASE_BUCKETS`, `ADDRESS_TYPES`, `RESIDENCE_TYPES`, `DEVICE_CHANGE_REQUEST_STATUSES`). Where a
  union type exists but no constant, the list is written out and type-checked against the union
  with `satisfies`.

| Collection | `_id` | Validated beyond not-null | Indexes (SQLite equivalent) |
| --- | --- | --- | --- |
| `ui_configs` | `id` | — | `screen_id` unique |
| `field_executives` | `id` | — | `username` unique (partial: strings only — SQLite's UNIQUE ignored NULLs), `device_id` |
| `cases` | `id` | — | `case_ref` unique |
| `case_components` | `id` | `bucket`, `address_type`, `residence_type` enums | `case_id`, `(assigned_field_executive_id, updated_at)`, `bucket` |
| `dropdown_options` | `id` | `category` enum | `(category, code)` unique, `(category, sort_order)` |
| `admin_users` | `id` | — | `username` unique, `email` unique **case-insensitive** (collation `en`/strength 2 = `COLLATE NOCASE`) |
| `mobile_app_settings` | `setting_key` | `value_type` enum | `(category, sort_order)` |
| `mock_location_events` | `id` | — | `client_event_id` unique, `(field_executive_id, detected_at)`, `device_id` |
| `device_change_requests` | `id` | `status` enum | `(field_executive_id, requested_at)`, `(status, requested_at)`, **one pending per executive** (unique, partial `status: 'pending'`) |
| `field_executive_devices` | `id` | `release_reason` enum or null | `(field_executive_id, created_at)`, **one open binding per executive** (unique, partial `released_at` null), `bound_after_request_id` unique when set |
| `case_evidence` | `id` | `source`, `mime_type` enums, `size_bytes ≥ 1` | `(component_id, uploaded_at)`, `storage_path` unique |
| `migrations` | migration name | — | — |

Collections added after the move have no SQLite table behind them. `schema.ts` lists them in
`COLLECTION_NAMES` but not in `LEGACY_TABLE_NAMES`, so the seed generator and the SQLite copy
script never read, seed or copy them; the server's migrations fill them on its next start.

| Collection | `_id` | Validated beyond not-null | Indexes |
| --- | --- | --- | --- |
| `app_metadata` | value name (`master_data`) | `updated_at` is a string | — |

Schema changes, such as a new index or a new allowed value, go in `schema.ts`, not in a migration.
Every startup brings an existing database up to date with that file.

## 6. Query translation

| SQLite | MongoDB |
| --- | --- |
| `JOIN cases c ON c.id = cc.case_id` (the case columns on every component row) | `$lookup` + `$unwind` + `$set` — `JOIN_PARENT_CASE` |
| `LEFT JOIN field_executives fe …` / `admin_users` / `field_executive_devices` | `$lookup` (`$limit: 1`) + `$ifNull(…, null)` — `leftJoinFields()` |
| Correlated `(SELECT COUNT(*) …)`, `MAX(detected_at)` per executive | `$lookup` with a `$count` / `$group` sub-pipeline |
| `NOT EXISTS (SELECT 1 FROM field_executive_devices …)` | `$lookup` + `$match: { followers: { $size: 0 } }` |
| `LIKE '%term%'` | `$regex` on the escaped term, `i` flag — `containsText()` |
| `email = ? COLLATE NOCASE` | the same query with `collation: { locale: 'en', strength: 2 }`, which is what uses the index |
| `ORDER BY role = 'super_admin' DESC, is_active DESC, name COLLATE NOCASE` | `$set` a computed flag, `$sort`, `$unset`, under the case-insensitive collation |
| `ORDER BY RANDOM() LIMIT n` (the New-case feed) | `$sample: { size: n }` |
| `COUNT(DISTINCT device_id)` | `distinct('device_id', …).length` |
| `GROUP BY bucket` / `GROUP BY status` | `$group` + `$project` |
| `requested_at > datetime('now', '-30 days')` | `requested_at: { $gt: timestampDaysAgo(30) }` — text comparison, as before |
| `SET col = COALESCE(@value, col)` | `$set` only the fields that were supplied |
| `result.changes === 1` | `result.matchedCount === 1` |
| `LIMIT ? OFFSET ?` | `$skip` + `$limit`, after `$sort` |
| Column `DEFAULT`s | written explicitly by the DAO on insert |
| `upsert` of a UI config with `version + 1` | one `updateOne(…, { $inc: { version: 1 }, $setOnInsert }, { upsert: true })` |

The admin case list filters on component fields first, so the indexes are used, then joins the
case. The free-text search spans case fields, so it runs after the join. The total count and the
per-tab counts run over the same filtered pipeline, so the tabs and the total always agree with
the list.

### Everything became async

`better-sqlite3` was synchronous, so a DAO call used to return its value. Each call now returns a
promise, and the whole chain above the DAOs became `async`:

- **DAOs**: every function returns a `Promise`.
- **Services**: every service function that reads the database. Independent reads outside a
  transaction run through `Promise.all`, for example the admin case list with its counts, the
  reference-data bundle and the field executive history.
- **Controllers**: every handler. Express 4 doesn't catch rejected promises, so each handler
  keeps its `try` / `next(err)`.
- **Auth middleware**: `authenticateAdmin`, `authenticateFeWeb` and both page-guard factories,
  each with its own `try` / `next(err)`.
- **Route guards**: four route files had `Boolean(token && verifyAdminToken(token))`, and a
  `Promise` is always truthy. Left unconverted, that check would have treated every browser as
  signed in on the `/login` pages. They now `await` the verification, and `hasValidSession` in
  `spa-app.routes.ts` returns `Promise<boolean>`.
- **Startup**: `src/index.ts` awaits `initDb()` before listening. It exits with a fatal log if the
  database can't start, and closes the connection on SIGINT/SIGTERM.

## 7. Migrations and seed data

### Where the old SQL went

The 22 SQL migrations moved from `src/db/migrations/` to **`scripts/sqlite-legacy/migrations/`**,
with `git mv`, so their history is kept. Their two CSV-to-SQL generators moved with them. The
server no longer runs these files. They are kept because:

- they are the source of the seed data: `npm run db:generate-seed` builds a fresh in-memory SQLite
  database from them and writes each table to `src/db/seed/<collection>.json`;
- `db:migrate-sqlite` applies any of them that an old database file is missing before copying it;
- `tests/mobile-app-settings-migration.test.ts` still tests migration 015's clamping logic.

### The seed

`src/db/seed/*.json` holds 7 files and 1,386 rows, about 1.3 MB of pretty-printed JSON:

- ui configs
- field executives
- cases
- case components
- dropdown options
- admin users
- mobile app settings

Timestamps that the SQL build itself stamped (the `datetime('now')` defaults) are stored as the
placeholder `__SEED_NOW__`. The seed migration replaces the placeholder with the time of seeding,
so a new database is dated when it was created, as under SQLite. `npm run build` copies the seed
into `dist/db/seed/`.

Don't edit the JSON by hand. Regenerate it from the SQL instead.

### Adding a migration

Migrations are for **data**. Collections, validators and indexes belong in `schema.ts`. Append a
module to the `MIGRATIONS` array in `src/db/migrations/index.ts`:

```ts
// src/db/migrations/002_backfill_example.ts
import type { ClientSession, Db } from 'mongodb';
import type { Migration } from './index.js';

export const backfillExample: Migration = {
  name: '002_backfill_example',
  async up(db: Db, session: ClientSession): Promise<void> {
    // Every operation passes `session`: the migration and its record commit together.
    await db.collection('mobile_app_settings').updateOne(
      { _id: 'some_setting' },
      { $set: { setting_value: '5' } },
      { session },
    );
  },
};
```

Each migration runs in a transaction together with its record in `migrations`. It is either fully
applied and recorded, or not at all. Never edit a migration that has shipped: a database that has
already applied it won't run it again.

## 8. Behaviour differences

These are the only differences found between the two servers (see [§9](#9-verification)):

| Area | Before | After | Why |
| --- | --- | --- | --- |
| Admin case and field-executive search with `%` or `_` in the term | `LIKE` wildcards: searching `%` matched every case | Matched literally: searching `%` matches only text containing `%` | Nobody searching for `%` means "everything". Every search without those two characters behaves exactly as before. |
| Case-insensitive comparison of admin email/username | `COLLATE NOCASE`: folds ASCII letters only | Collation strength 2: also folds non-ASCII case (`É` = `é`) | That's how MongoDB's case-insensitive collation works, and it is stricter about duplicates |
| A write that breaks a unique index | `SqliteError` → 500 | `MongoServerError` E11000 → 500 | Same outcome. The services still check first, so the index is a backstop. |
| Referential integrity for hand-edits | Enforced by foreign keys | Not enforced | No foreign keys in MongoDB (see [§4](#foreign-keys--service-checks)) |

## 9. Verification

| Check | Result |
| --- | --- |
| Full test suite (`npm run test:run`) | **23 files, 308 tests pass**, the same as on SQLite before the change. The 10 suites that queried the database directly were rewritten against MongoDB, with the same assertions. |
| `tsc --noEmit` on `src/` | Clean |
| **Data copy fidelity**: `data/fullscan.sqlite` copied with `db:migrate-sqlite`, then every row compared with its document | **1,401 rows, 34,403 field values identical**: same field set, `strictEqual` on every value, so types match too |
| **API parity on the copied data**: the original SQLite code (run from a git worktree of `HEAD`) and the new build on the same data, 201 identical requests, JSON deep-compared with only login timestamps and tokens masked | **199 identical.** The other 2 are the two deliberate `%` / `_` search probes ([§8](#8-behaviour-differences)). No ordering differences. |
| **API parity on fresh databases**: the old server building SQLite from its 22 migrations vs. the new server seeding MongoDB from `dist/db/seed` | Identical apart from the same two search probes and the random UUID of a newly created device binding |
| Endpoints covered by the parity runs | Mobile login, `/me`, `/reference-data`, `/ui-config`, `/cases` (assigned) + every detail; admin login, 16 case-list filter / page / search combinations, 40 case details + evidence, form options, 404s, field executive roster and search, 12 executives' history, device change lists and filters, admin users, settings; FE web login, cases, every case detail and evidence list, profile, device change |
| Write paths on the copied data (smoke test) | Mobile login on the bound phone and refusal on another, accept a New case, submit an outcome, save a setting, reject an invalid settings batch as a whole (atomic), mock-location report plus idempotent re-delivery |
| Restarting `npm run db:dev` | Data persists and transactions work after the restart |
| Standalone `mongod` | Refused at startup with the replica-set message |
| Source SQLite file after the copy | Byte-identical (checksum unchanged) |

## 10. Known limits and follow-ups

- **Joins happen at read time.** The admin case list joins the parent case (`$lookup`) for every
  component it filters. At today's scale of 662 components this is instant. If volumes grow into
  the hundreds of thousands, store the case's `case_ref`, `client_name` and `candidate_name` on each
  component (fanning out updates from the case editor), so search and filtering need no join.
- **Timestamps are strings.** Moving to BSON dates would allow TTL indexes and date operators,
  but would change every API timestamp. Do it as a separate, deliberate API change.
- **`db:dev` is not a production database.** It runs a real `mongod` binary, but through a
  test-tool wrapper. For anything shared, use Atlas or a managed replica set.
- **`data/fullscan.sqlite` is left in place.** Nothing reads it any more. Delete it once you've
  copied it across and no longer need it.
- **`npm run lint` still fails**, as before this change: ESLint 9 needs an `eslint.config.js` the
  project doesn't have.

## 11. File manifest

### New

| File | Purpose |
| --- | --- |
| `src/db/schema.ts` | Collection list, validators, indexes, `applySchema()`, `toDocument()` |
| `src/db/documents.ts` | `_id` ↔ `id` mapping, join/search pipeline helpers |
| `src/db/timestamp.ts` | Timestamps in the stored `YYYY-MM-DD HH:MM:SS` format |
| `src/db/migrations/index.ts` | Migration runner and registry |
| `src/db/migrations/001_seed_initial_data.ts` | Seeds an empty database from `src/db/seed/` |
| `src/db/seed/*.json` | Generated seed data (7 collections) |
| `src/db/migrate.ts` | `npm run migrate` (the script existed in `package.json`; the file never did) |
| `scripts/dev-mongo.ts` | `npm run db:dev`: local persistent replica set |
| `scripts/generate-mongo-seed.ts` | `npm run db:generate-seed` |
| `scripts/migrate-sqlite-to-mongo.ts` | `npm run db:migrate-sqlite` |
| `scripts/sqlite-legacy/sqlite-source.ts` | Shared SQLite reader for the two scripts above |
| `tests/helpers/mongo-global-setup.ts`, `tests/helpers/provided-context.d.ts` | One in-memory replica set per test run |
| `docs/sqlite-migration-mongodb.md` | This document |

### Moved (history kept)

| From | To |
| --- | --- |
| `src/db/migrations/001…022_*.sql` | `scripts/sqlite-legacy/migrations/` |
| `scripts/generate-real-case-seed.mjs`, `scripts/generate-ui-test-case-seed.mjs` | `scripts/sqlite-legacy/` |

### Modified

| File(s) | Change |
| --- | --- |
| `src/db/connection.ts` | MongoDB client, replica-set check, `runInTransaction` / `sessionOption`, `getCollection` |
| `src/db/*.dao.ts` (all 11) | Rewritten as MongoDB queries; same exports and `*Row` return types, now async |
| `src/services/*.ts` (all 16) | `async` / `await`; `Promise.all` for independent reads outside transactions |
| `src/controllers/*.ts` (all 16) | Handlers are `async` and await their service |
| `src/middleware/authenticate-admin.ts`, `authenticate-fe-web.ts` | Async token verification, errors passed to `next` |
| `src/routes/spa-app.routes.ts`, `admin-app.routes.ts`, `fe-web-app.routes.ts`, `admin-portal.routes.ts`, `fe-web-portal.routes.ts` | Await session checks on the `/login` pages |
| `src/index.ts` | Awaits `initDb()`, fatal log on failure, graceful shutdown |
| `tests/helpers/test-app.ts`, `vitest.config.ts` | A fresh MongoDB database per suite; async `removeTestDb()` |
| `tests/*.test.ts` (21 of 23) | `afterAll` awaits teardown (20 suites); 10 suites' direct SQL queries rewritten against MongoDB; the migration-015 suite points at the moved SQL |
| `package.json` | `mongodb` added; `mongodb-memory-server` added (dev); `better-sqlite3` moved to dev; `db:*` scripts; build copies the seed |
| `.env.example`, `README.md` | MongoDB configuration and workflow |
