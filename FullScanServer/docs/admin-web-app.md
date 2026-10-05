# Admin Web App (React) — Implementation Notes

A React single-page app for admins, served by FullScanServer at **`/admin-app`**. It runs alongside
the static Admin Portal at `/admin` ([`ADMIN_PORTAL.md`](ADMIN_PORTAL.md)) and uses the same
`/api/v1/admin/*` API and `fs_admin_session` cookie. It is built the same way as the field executive
app ([`field-executive-web-app.md`](field-executive-web-app.md)): Vite, React 18, TypeScript strict,
Tailwind, Zustand, React Router 7 and Zod.

## 1. Pages (parity with `/admin`)

| Route (under `/admin-app`)                   | Page                    | Roles        |
| -------------------------------------------- | ----------------------- | ------------ |
| `/login`                                     | Sign in with username **or** email | —  |
| `/cases` (`/` redirects here)                | Cases: category filters with counts, 300 ms debounced search, field executive filter, 25 per page. Opens the parent case | both |
| `/cases/:caseId`                             | Case editor, plus that case's **web evidence** (see §3) | both |
| `/cases/new`                                 | Add New Case: the editor in create mode; the form resets after each save | both |
| `/field-executive-history?executive=<id>`    | Roster search, summary tiles, linked phones, device change requests, one table per category with expandable mock-location detections, detections not tied to a case | both |
| `/device-change-requests?status=<status>`    | Pending / Approved / Rejected / All; approve with a confirmation dialog, reject with an optional note (≤500) | both |
| `/mobile-app-settings`                       | Form built from each setting's metadata; sends only changed settings; tracks unsaved changes; discard | super admin |
| `/admin-users`                               | Add an admin (temporary password shown once, with copy), promote/demote, deactivate/reactivate, delete; confirmation dialogs; no actions on your own row | super admin |

The menu (`src/utils/navigation.ts`) has the same sections, order and role rules as `public/admin/assets/js/menu.js`.
Pages a role can't use are hidden, and opening one directly shows "Not available for your role". The server still
enforces roles with `requireAdminRole`.

## 2. Server changes

| File | What |
| ---- | ---- |
| `src/routes/spa-app.routes.ts` | **New shared factory** `createSpaAppRoutes()`: open `/login` (a signed-in user is sent into the app), immutable `/assets`, 404 for missing assets, guarded page catch-all, `no-store` shell, portal CSP, and a 503 when the app isn't built |
| `src/routes/fe-web-app.routes.ts` | Now a thin call to the factory; behaviour and tests unchanged |
| `src/routes/admin-app.routes.ts` | Mounts `web-admin/dist` at `/admin-app` (`ADMIN_APP_DIR` overrides it) |
| `src/middleware/authenticate-admin.ts` | `createAdminPageGuard(loginPath)`. `authenticateAdminPage` is built from it; `/admin` is unchanged |
| `GET /api/v1/admin/cases/:caseId/evidence` | Evidence for every component of a case — web uploads and mobile app captures (with document type, coordinates, accuracy, mock-location flag and capture time; null on web uploads) — newest first, with the uploader's id, name and username. Both roles. 404 for an unknown case. The storage path is never exposed |
| `src/app.ts` | Mounts `/admin-app` |

## 3. Evidence in the admin app

Each existing component in the case editor has a **Web evidence** list: file name, a "Web upload" badge,
size, who uploaded it and when. It is read-only; files can't be viewed, downloaded or deleted from either
app yet. The badge is there because these files came from a browser, not the mobile camera, so they carry
no GPS or watermark.

## 4. Behaviour worth knowing

- **Existing `/admin` editor bug (not fixed there):** the static portal never sends
  `additionalVerificationInstructions` or `additionalVerificationRemarks`, and the server writes a missing
  optional field as `''`. **Saving a case in `/admin` wipes both fields.** The React editor shows, edits
  and sends both fields, so saving keeps them (checked against a real case in the browser test).
- **Unsaved changes:** the editor and settings page show a sticky "Unsaved changes" bar. Leaving the
  editor with unsaved edits asks first: an in-app dialog for in-app navigation (`useBlocker`), and the
  browser's prompt for reloads and closing the tab. Changes that only affect formatting (e.g. `17.4699`
  vs `17.46990`) don't count.
- **Validation:** the editor checks the same limits as the server schema, plus the TAT format
  (`YYYY-MM-DD HH:MM[:SS]`, which all existing data follows). It lists every problem and focuses the first.
  A duplicate case reference (409) is shown on the field.
- **Role changes mid-session:** roles are read from the live account on every request. On a 403 the app
  re-reads `/auth/me`, so a demoted admin's menu updates. A deactivated admin gets a 401 and is signed out.
- **Session handling** is the same as the FE app: cookie only (the token in the login body is ignored),
  one shared `/auth/me` check on a 401 before signing out, reference data and the case list cleared on
  sign-in and sign-out, and safe `?next=` redirects that only follow paths under `/admin-app`.
- **Reference data** (form options plus the full field executive roster) is loaded once per session and
  shared by Cases, the editor and FE History. The case list keeps its filter and page when you come back
  from the editor.
- **Accessibility:** native modal `<dialog>` for confirmations (focus trap, Escape); labelled form fields
  with `aria-invalid` and error text; `aria-pressed` filter buttons; expandable detection rows use
  `aria-expanded` and `aria-controls`; the off-canvas drawer is `inert` while closed and closes on Escape
  or the scrim; skip link; ≥44px targets.
- **Layout:** the drawer is docked at ≥1024px. Tables scroll inside their frame (`relative
  overflow-x-auto`, so screen-reader-only labels don't widen the page), and no page scrolls horizontally
  at 400px.

## 5. Shared code with `web-fe`

`web-admin` started from copies of `web-fe`'s generic modules: the API client core, `alert`, `spinner`,
`format`, `safe-next-path` and `use-document-title`. The copies differ only in base path and API prefix;
the admin client also drops the multipart upload helper and adds a 403 listener. A shared package would
need its own React and type resolution across the two Vite projects. If these start to drift, extract them.

## 6. Running

```bash
npm run dev                # API on :3000
npm run dev:admin-web      # http://localhost:5174/admin-app (proxies /api)
# or served by Express:
npm run build:admin-web && npm run dev   # http://localhost:3000/admin-app
```

Seeded logins: `admin001` / `Admin@123!` (super admin) and `admin002` / `Admin@123!` (admin). Email addresses work too.

## 7. Testing

- **Server:** `tests/admin-app.test.ts` (9: guard, `next`, login bounce, both roles, FE session refused, `/admin`
  untouched, assets, CSP, 503) and `tests/admin-case-evidence.test.ts` (4: auth, empty, uploads with uploader
  for both roles, 404).
- **Client** (`npm run test:admin-web`, 47): API client including the 403 listener, safe `next`, case draft
  round-trip and validation (including the additional-verification fields), settings change detection, and menu role filtering.
- **Browser check** (headless Chrome, throwaway server and database, seeded with a mobile login, a device change
  request and a web upload):
  - **Admin:** a deep link goes to login and back; the menu has 4 items; the settings page is blocked.
  - **Super admin (email sign-in):** 6 menu items. Cases shows 25 rows of 663, Pending 130, and search.
  - **Case editor:** the additional text loads; web evidence is listed; the leave guard dialog appears; save
    succeeds, and the database still has both additional fields.
  - **New case:** empty submit focuses the first error; add then remove a component; create resets the form;
    a duplicate reference is flagged on the field.
  - **Other pages:** FE history shows the linked Galaxy S25; reject with a note, which then shows under Rejected;
    in settings, an empty number is blocked, then discard and a save of 1 setting; add admin shows the password
    once; deactivate via the dialog.
  - **Phone width (400px):** the drawer is inert while closed, opens and closes, and no page overflows.
  - **Console:** only the expected 401 (signed-out check), 409 (intentional duplicate) and favicon 404.
