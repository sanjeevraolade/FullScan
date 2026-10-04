# Cases list — per-tab loading, counts and pagination

Today the app loads every bucket in a single `GET /cases` call and builds the tab counts on the device.
After this change the app makes two kinds of call:

1. `GET /cases/counts` returns the four tab counts.
2. `GET /cases?type=<tab>` returns one tab, one page at a time. A tab is only requested when it is
   opened. Pages are fetched as the field executive scrolls.

The app caches what it has loaded, and only pull-to-refresh asks the server again.

## Case summary DTO (new shape)

This shape is returned by the list endpoint and by the accept and verification-outcome responses.

```json
{
  "id": "case-0123-comp-1",
  "checkId": "case-0123-comp-1",
  "caseRef": "FS-2026-00123",
  "clientName": "ABC Pvt Ltd",
  "candidateName": "Rahul Sharma",
  "verificationType": "Address",
  "address": "H.No. 11-2/2, Near Chanda Nagar Railway Station, …",
  "updatedAt": "2026-10-04 09:15:02"
}
```

- **`checkId` added.** It holds the same value as `id`, the component ("check") id. Nothing new is stored
  and no migration is needed.
- **`caseId` removed.** The mobile routes no longer send the parent case's id.
- **`bucket` removed.** An item belongs to the tab it was requested with (`type`).
- All other fields, and the `updatedAt` format, are unchanged.

## Case detail DTO — `GET /api/v1/cases/:caseId`

- `checkId` is added (same value as `id`) and `caseId` is removed.
- **`bucket` stays.** Case Details can be opened from any tab, and the app's read-only and Accept rules
  depend on `bucket`. `siblingComponents[].bucket` also stays.
- Everything else is unchanged.

## `GET /api/v1/cases/counts`

- **Auth:** field-executive JWT, the same as every other `/api/v1/cases` route.
- **Request:** no params, query or body. Unknown query params → `400` (strict schema).
- **200:**

  ```json
  { "success": true, "data": { "new": 7, "pending": 10, "beyond_tat": 7, "completed": 7 } }
  ```

  All four keys are always present, and each value is an integer ≥ 0.
- **`pending` / `beyond_tat` / `completed`:** the number of components assigned to the current field
  executive in that bucket. These are the same rows the list returns for that `type`.
- **`new`:** the New tab stays a random draw (see below), so its count is random as well:
  `min(random integer 3–10, number of components in the 'new' bucket)`. This value is independent of any
  list call. The app reconciles the two (see "Tab badge" under App).
- **Route order:** register this route **before** `GET /:caseId` in `case.routes.ts`. Otherwise
  `counts` is matched as a case id.
- **Errors:** `401` as on the other routes.

## `GET /api/v1/cases?type=<type>[&cursor=<cursor>]`

- **Auth:** unchanged.
- **Query:**
  - `type`: `new | pending | beyond_tat | completed`. Any other value → `400`. If `type` is absent, the
    server uses the legacy behaviour described below.
  - `cursor`: optional. An opaque string taken from a previous response's `nextCursor` for the
    **same** `type`. If absent, the server returns the first page.
  - Any other query param → `400` (strict schema).
- **Page size** is server configuration, not a client parameter. It comes from the env var
  `CASES_PAGE_SIZE` and defaults to `100`. Valid values are integers 1–500. If the value is anything
  else, the server logs a warning and uses `100`. Add the variable to `.env.example`.
- **200:**

  ```json
  {
    "success": true,
    "data": {
      "type": "pending",
      "items": [ { "id": "…", "checkId": "…", "caseRef": "…", "…": "…" } ],
      "nextCursor": "eyJ0IjoicGVuZGluZyIsInUiOiIyMDI2LTEwLTA0IDA5OjE1OjAyIiwibyI6NDU2fQ",
      "pageSize": 100
    }
  }
  ```

  - `nextCursor` is `string | null`. `null` means there are no more items, and it is the **only**
    signal for that. A full page does not imply that another page exists. The server fetches
    `pageSize + 1` rows to decide, so it never returns a cursor whose next page is empty. The app still
    accepts an empty page.
  - `pageSize` is informational. It is the size the server used.
- **`pending` / `beyond_tat` / `completed`:**
  - Rows are the components assigned to the current field executive in that bucket.
  - Order: newest `updated_at` first, with ties broken by `insert_order` ascending. This is today's
    `COMPONENTS_NEWEST_FIRST`.
  - **Keyset pagination, not offset.** The cursor encodes `type` and the last item's `updated_at` and
    `insert_order`. The next page holds the rows strictly after that item in the sort order.
    - **Why not offset:** accepting a New case or submitting an outcome moves an item out of a tab
      while the field executive is scrolling. With offsets, the next page would then skip an item.
    - **Items entering a tab:** an item that moves into a tab gets `updated_at = now`. That puts it on
      the first page, so an in-progress scroll never sees it. It appears on the next refresh.
- **`new`:** the existing random draw is unchanged. Every call samples 3–10 components from the whole
  `'new'` pool (`findRandomNewComponents`). The result is always a single page, so `nextCursor` is
  always `null` for `new`. A `cursor` sent with `type=new` → `400`.
- **Errors:**
  - `400` from the `validate` middleware for a bad `type` or unknown params:
    `{ "success": false, "error": "Validation failed", "details": [ … ] }`.
  - `400` for a malformed cursor, a cursor issued for a different `type`, or any cursor with
    `type=new`: `{ "success": false, "error": "Invalid cursor" }`.
  - `400` `Validation failed` for a `cursor` without a `type`. A cursor always belongs to a tab.
  - `401` unchanged.

### Legacy: `GET /api/v1/cases` with no `type`

- This keeps today's response exactly: a flat array of every bucket, each item still carrying `caseId`
  and `bucket`. App builds already installed in the field depend on it.
- It now goes through the strict query schema, so any unknown query param → `400`. Installed builds
  send none.
- It is **deprecated**. Remove it once no supported build calls it. The new app never calls it.

## `PATCH /api/v1/cases/:caseId/accept` and `POST /api/v1/cases/:caseId/verification-outcome`

- Requests, rules and errors are unchanged. Accept can still claim any `'new'` component.
- `200` `data` is the **new** case summary shape: no `caseId`, no `bucket`, and `checkId` added.

## Server — out of scope

- The FE web portal (`/api/v1/fe-web/cases`) and the admin case APIs don't change.
- No data change and no migration. If indexes are created through the schema/migration mechanism,
  add a compound index `{ assigned_field_executive_id: 1, bucket: 1, updated_at: -1, insert_order: 1 }`
  for the per-tab list and count queries, using that mechanism (a new migration if indexes are only
  created by migrations).

## App — consumption

### Models and repository

- **Domain `Case`:** `{ id, checkId, caseRef, clientName, candidateName, verificationType, address,
  updatedAt: Date }`. `caseId` and `bucket` are removed.
- **Domain `CaseDetail`:** `checkId` is added and `caseId` is removed. `bucket` and the siblings'
  `bucket` stay.
- **Repository:**
  - `fetchCaseCounts(): Promise<Record<CaseBucket, number>>` maps `beyond_tat` to `beyondTat`. A
    missing or non-numeric key maps to `0` and logs a warning.
  - `fetchCasesPage(bucket, cursor | null): Promise<{ items: Case[]; nextCursor: string | null }>` maps
    the domain bucket to the `type` value.
  - The all-buckets `fetchCases()` is removed.
- Route params named `caseId` already carry the component id. They stay as they are.

### Behaviour

- **Initial load:** New is selected by default. On mount, request the counts and New's first page in
  parallel.
- **Lazy tabs:** a tab's first page is requested the first time that tab is selected, and never
  earlier. Selecting a tab that is already cached shows the cache without a network call.
- **Cache:**
  - Contents: per tab, `{ items, nextCursor }`, plus the counts.
  - Memory only, for the session. It is cleared on logout and is not written to disk, because list items
    carry candidate names and addresses (PII).
  - It must survive the case-list screen unmounting and remounting (for example, going to Case Details
    and back), so it can't live only in component state.
  - Follow the state-management rules on where business data may live.
- **Infinite scroll:**
  - When the list nears its end and the tab has a `nextCursor`, load the next page and append it,
    de-duplicating by `id`.
  - Only one request per tab can be in flight at a time.
  - Show a footer spinner while a page loads.
  - If a next-page request fails, keep the loaded items and show an inline footer retry. Don't replace
    the list with the error state.
- **Refresh:**
  - Triggers: pull-to-refresh on the list (including the empty state) and the Retry button.
  - Effect: re-fetch the counts and the current tab's first page, replacing that tab's cache. Discard
    every other tab's cache so each one re-fetches the next time it is opened.
  - For New, refresh is what produces a fresh random draw.
- **Loading and errors:**
  - Loading a tab's first page shows a spinner **in the list area**, and the tabs stay visible.
  - If that load fails, the list area shows an error with Retry. Switching tabs still works.
  - If the counts request fails, nothing is blocked. The badges fall back as described below, and the
    next refresh retries the counts.
- **Tab badge:**
  - If a tab is fully loaded (cached with `nextCursor === null`), its badge shows the number of loaded
    items.
  - Otherwise the badge shows the value from `/cases/counts`. If there is no count yet, the tab shows
    the label with no number.
  - This keeps New's badge equal to its list despite the random draw, and keeps badges right after the
    local updates described below.
- **Accept succeeds** (from the list or from Case Details):
  - Remove the item from New's cache.
  - Discard Pending's cache. The accepted item is at the top of Pending's first page.
  - Adjust the counts: `new −1`, `pending +1`.
- **Verification outcome submitted:**
  - Remove the item from the cache of its tab (`CaseDetail.bucket`).
  - Discard Completed's cache.
  - Adjust the counts: that tab `−1`, `completed +1`.
- **Search** is unchanged and local. It filters the current tab's **loaded** items by case ref,
  candidate and client. Results are limited to pages already loaded. It's fine for the end-of-list
  trigger to keep loading next pages while a search is active.
- **Strings:** every new user-visible string (load-more failure, footer retry) goes into localization.
  None are hardcoded.

## Compatibility

- **Old app, new server:** the list uses the legacy no-`type` path and works. After an accept, the
  accepted card has no `bucket`, so it drops out of every tab until the next pull-to-refresh.
- **New app, old server:** not supported. `/cases/counts` is matched by `/:caseId` and fails.
- **New app, new server:** works.

Deploy the server before releasing the app.
