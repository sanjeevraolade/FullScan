# Field Executive Web App (React) — Implementation Notes

A React single-page app for field executives, served by FullScanServer at **`/app`**. It runs next to
the static `/fe` portal ([`field-executive-web-login.md`](field-executive-web-login.md)) and uses
the same web API and cookie session. It adds a dashboard, a filterable assignment list, assignment
detail and evidence upload.

## 1. Decisions that differ from the original brief

| Brief                                    | Built                                   | Why                                                                                                   |
| ---------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| JWT in `localStorage`                    | httpOnly `fs_fe_session` cookie         | The FE web API is cookie-only by design, so XSS cannot steal a session (login doc §3.4)               |
| Token refresh on 401                     | Re-check the session once, then sign out | There is no refresh token. A 401 triggers one shared `GET /auth/me`, and the request is retried if the session is valid again (e.g. a sign-in in another tab) |
| Email/password login                     | Username/password                       | FE accounts sign in by username (`fe001`), the same as the mobile app                                 |
| `/auth/login`, `/assignments`, `/evidence/upload` | `/api/v1/fe-web/auth/*`, `/cases`, `/cases/:componentId/evidence` | The existing web API. An "assignment" is one case component |
| `/ui-config`                             | Not used                                | That is a mobile endpoint, and the web app is screen-based                                            |
| Evidence upload                          | Built, as a **web exception**           | See §4                                                                                                |

## 2. Layout

```
web-fe/
  vite.config.ts      base '/app/', dev proxy /api -> FULLSCAN_API_ORIGIN (default http://localhost:3000)
  src/
    api/              client.ts (fetch wrapper, envelope + Zod response checks, 401 recovery, XHR upload
                      with progress), schemas.ts, auth-api.ts, assignments-api.ts, evidence-api.ts
    types/            api, auth, assignment, evidence
    stores/           auth-store, assignment-store (fetch, filter, select), evidence-store (per componentId)
    components/       protected-route, app-layout, assignment-list, assignment-filter-bar,
                      assignment-detail, evidence-upload, alert, spinner, status-badge
    pages/            login, dashboard, assignments, assignment-detail, not-found
    utils/            format, validation (Zod), assignment-filters, safe-next-path, use-document-title
    App.tsx, main.tsx
```

Routes (basename `/app`): `/login`, `/` (dashboard), `/assignments` (`?bucket=pending|beyond_tat|completed`),
`/assignments/:componentId`.

## 3. Server additions

| File                                        | What                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/routes/fe-web-app.routes.ts`           | Serves `web-fe/dist` at `/app`. `/app/login` is open (a signed-in FE is sent to `/app`), `/app/assets` is served with immutable caching, and every other path is guarded and gets the `no-store` shell. `503` if the app is not built. `FE_WEB_APP_DIR` overrides the build directory |
| `src/middleware/authenticate-fe-web.ts`     | `createFeWebPageGuard(loginPath)`. `authenticateFeWebPage` is now built from it; behaviour unchanged |
| `GET /api/v1/fe-web/cases/:componentId`     | Read-only detail of one of the FE's **own** components in Pending, Beyond TAT or Completed. Another FE's component, an unclaimed New component and an unknown id all get the same `404`. No phones, GPS targets, respondent or detection data. Sibling components carry `isAssignedToYou` |
| `GET  /api/v1/fe-web/cases/:componentId/evidence` | That component's web evidence, newest first                                      |
| `POST /api/v1/fe-web/cases/:componentId/evidence` | Multipart upload, see §4                                                          |
| `src/db/migrations/022_create_case_evidence.sql` | `case_evidence` table (metadata only; append-only)                               |

## 4. Evidence upload (web exception to camera-only)

The mobile rule is camera-only evidence with GPS, timestamp and watermark. A browser cannot enforce that,
so web uploads are **kept separate** instead:

- Each row has `source = 'web_upload'` (the only value the CHECK constraint allows today), so it can never
  pass as a camera capture. The UI says so above the upload area.
- **Accepted:** field `files`, 1–10 files, ≤10 MB each, and only JPEG/PNG/WebP. The type is decided by
  the file's **magic bytes**. The browser's `Content-Type` and the file extension are ignored.
- **Only open work:** Pending or Beyond TAT. Completed returns `409`, and anything not the FE's own returns `404`.
- **All-or-nothing:** every file is validated before any is written. The files are then written, and all
  rows are inserted in one transaction. If the insert fails, the written files are deleted.
- **Storage:** `UPLOAD_DIR/evidence/<componentId>/<uuid>.<ext>`. The path is generated by the server and is
  never exposed. The uploaded name is kept for display only (path segments and control characters
  stripped, ≤255 characters). A SHA-256 of the stored bytes is recorded.
- **Errors:** `400` (no files, too many, wrong field), `413` (file too large), `415` (not a
  JPEG/PNG/WebP, or not multipart), `401`/`404`/`409` as above.
- **CSRF:** the cookie is `SameSite=Strict`, as for the other cookie-authenticated routes.
- **Not built:** viewing or downloading stored images, deleting evidence, watermarking.

The client checks type, size and count with Zod before uploading, uploads through XMLHttpRequest for
progress, supports cancel, and keeps upload state keyed by `componentId`, so an upload stays tied to its
assignment even if the FE navigates away.

## 5. Client behaviour worth knowing

- **Session:** `main.tsx` calls `/auth/me` once on load. If the server can't be reached, the app shows a
  retry screen instead of the login page. Signing in, signing out, or losing the session resets every
  user-specific store, so no data carries over between executives in one tab.
- **Redirect after login:** `?next=` is accepted only when it is a path under `/app`. Absolute URLs,
  `//host`, backslashes, encoded slashes and control characters are refused (`utils/safe-next-path.ts`).
- **Response validation:** every response is checked against a Zod schema tied to its TypeScript
  interface. A contract break shows as one clear error.
- **Stale requests:** list, detail and evidence fetches abort the previous request, so a slow old response
  can't overwrite a newer one.
- **Timestamps:** TAT due is shown as a wall-clock time (not re-zoned). `updatedAt` and `uploadedAt`
  are treated as UTC, matching the Admin Portal.
- **CSP:** the build has no inline script or style, so the strict portal CSP applies unchanged. Upload
  progress uses a native `<progress>` element rather than inline widths.
- **Accessibility:** skip link, labelled landmarks, `aria-invalid` and described-by on form errors,
  `role="alert"` for errors and `status` for other messages, `aria-pressed` filter buttons, ≥44px touch
  targets, reduced-motion spinner, light and dark themes.

## 6. Running

```bash
npm run dev            # API on :3000
npm run dev:web        # http://localhost:5173/app (proxies /api)
# or, served by Express:
npm run build:web && npm run dev   # http://localhost:3000/app
```

Sign in with `fe001` … `fe051` / `Password123!`.

## 7. Testing

- Server: `tests/fe-web-app.test.ts` (8), `tests/fe-web-case-detail.test.ts` (7), `tests/fe-web-evidence.test.ts` (8).
- Client (`npm run test:web`): API client (envelope, schema, network errors, 401 recovery and shared probe),
  safe `next`, login and evidence validation, assignment filters. 42 tests.
- Browser check (headless Chrome against a throwaway server and database): anonymous deep link →
  login with `next`; empty and wrong-password errors; sign-in returns to
  `/app/assignments?bucket=beyond_tat` (7 shown); dashboard 10 / 7 / 7; search; detail; two PNGs
  uploaded and listed; no horizontal overflow at 400px; sign-out; pages guarded again; no CSP violations.
