# Session notes — 2026-07-31: Case list landing page + mock server endpoints

Discussion and implementation session with Sanjeev, covering the product spec review, a set of
open architecture/product questions, and the resulting implementation across FullScanApp and
FullScanServer.

## 1. Product spec review

Sanjeev shared "Fullscan Field - Mobile APP.pdf" as the domain/product reference. Understanding
confirmed:

- **Auth & device binding** — login is device-based, not user/password; one active device per
  user at a time.
- **Case workflow** — Backend assigns cases by pin code. Buckets: **New** → Accept →
  **Pending/In Progress** → (if overdue) **Beyond TAT** → **Completed** (new tab to add). Call
  option appears only in Pending/Beyond TAT.
- **Masked calling** — tapping Call must never expose the candidate's real number; failed calls
  auto-retry alternate numbers; every attempt is logged server-side as a case log.
- **Case Details / verification runtime** — `VerificationTypeStatus` (Verified Clear / UTV /
  Insufficient) fetched from the server at login. Selecting a status mandates a GPS distance check
  (target lat/lon vs device lat/lon, mock location rejected). Verified Clear requires a location
  match to proceed to Verified Details → Respondent Details. UTV and Insufficient both represent
  "visit not done," each with their own server-supplied reason list (`utvOptions`,
  `InsuffOptions`). All three paths end in remarks → photo capture → submit.
- **Photos** — camera-only (no gallery), geo-watermarked, photo-type dropdown also server-supplied
  at login.
- **Browser fallback** — a separate web page (out of scope for this RN app) will let temporary
  contractors complete the same workflow from an emailed link.

## 2. Architecture conflict raised, then resolved

The spec's line *"This below Form details Should be dynamic Box 2, 3, based on client"*, plus
server-fetched statuses/options, initially looked like it conflicted with CLAUDE.md's explicit
rule that server-driven UI / a config-driven rendering runtime was tried and deliberately killed.

**Resolution:** Case Details stays fully static, hand-coded layout. The "dynamic" part is only
server-supplied **dropdown/option data** (statuses, UTV/Insufficient reasons, photo types),
fetched in one batch right after login — not layout. Dynamic layout was tried, took too long to
build, and the backend returns the same field set for every client anyway, so static was the
deliberate choice. CLAUDE.md's "no config-driven rendering runtime" rule stands.

## 3. Other decisions

| Topic | Decision |
| --- | --- |
| Call masking | Integrating with **Airtel** — FE sees a different/proxy number; Airtel's backend bridges to the real candidate number via a dedicated number. Not a direct `tel:` link. |
| Device-binding recovery | Reset is **admin-portal-only** — FE reports to admin, no in-app self-recovery flow. |
| Mock-location detection | Use React Native Geolocation's `position.mocked` flag — no separate integrity/root-detection library. |
| Geocoding | App geocodes the assignment address **client-side via a Google API call** — target lat/lon isn't pre-stored on the assignment. |
| Web fallback | A separate web page is planned alongside the app for temporary contractors — out of scope for this repo. |
| Login-time data fetch | All dropdown/option data fetched in **one batch right after login**, not per-screen. |
| Mock backend | **FullScanServer** (sibling project in the same workspace) is the project to build mock endpoints against. |

## 4. Implementation — FullScanServer (mock backend)

Added alongside the existing (stale, server-driven-UI) `ui-config` module, without extending it:

- **Migrations**: `002_create_field_executives.sql`, `003_create_cases.sql` (18 seeded mock
  cases across New/Pending/Beyond TAT/Completed), `004_create_dropdown_options.sql` (statuses,
  UTV/Insufficient reasons, photo types).
- **Endpoints**:
  - `GET /api/v1/me` — current field executive profile (mocked, no real auth yet)
  - `GET /api/v1/reference-data` — bundled dropdown/option data
  - `GET /api/v1/cases` — all cases for the current field executive, across every bucket
  - `PATCH /api/v1/cases/:caseId/accept` — moves a case New → Pending (404/409 handled)
- **Incidental fixes** (both blocked verifying the endpoints, unrelated to the actual task):
  missing `pino-pretty` devDependency (dev server wouldn't start at all).
- All four endpoints verified live via curl, including the accept-case 409/404 paths.

## 5. Implementation — FullScanApp (case list landing page)

New `src/features/cases/` feature:

- `useCaseList` hook — fetch, tab/search filtering, Accept action (screen owns no networking).
- `CaseListScreen` — avatar/name/role header, toggle-able search, tabs (New/Pending/Beyond
  TAT/Completed with live counts), case cards with Accept (New) or Call (Pending/Beyond TAT).
  Call shows a "coming soon" notice rather than a fake call, since real masked calling needs the
  Airtel integration.
- Supporting additions: `src/infrastructure/networking` (axios client), `src/domain/case` and
  `src/domain/field-executive` entities, `case-repository.ts` /
  `field-executive-repository.ts`, a custom `FilterIcon` (no Gluestack equivalent exists),
  en/hi/te localization for the new screen, and a `CaseList` route wired so login navigates there
  on success.
- 6 unit tests added for `useCaseList` (happy path, network error, search filter, tab switch,
  accept flow, refresh).

**Regression caught and fixed**: wiring navigation into `useLoginForm` broke
`login-screen.test.tsx` (rendered without a `NavigationContainer`) — fixed the test, not the
code, by wrapping it in `NavigationContainer`.

**Final verification**: `tsc --noEmit` clean app-wide; 32/35 Jest tests passing (the 3 failures
are pre-existing and unrelated — a commented-out welcome heading in `login-screen.tsx` that was
never touched this session). Lint isn't runnable in either project (missing config/deps,
pre-existing).

**Not done**: real device-based auth; Case Details screen (the dropdown data is ready on the
backend but the app doesn't consume it yet).

## 6. Running it

- **Mock server**: `cd FullScanServer && npm run dev` → `http://localhost:3000`.
- **Mobile app**: Metro was already running for this project; built and launched on the iPhone 16
  Pro (iOS 18.6) simulator via `npx react-native run-ios --udid <booted-simulator-udid>`.
  Screenshot confirmed the login screen renders correctly (logo, themed fields, localized labels,
  footer) — not blank/crashed.
- Full simulator tap-automation (login → case list) wasn't completed in-session: no `idb`
  installed, and the AppleScript/System Events fallback needs an interactive Accessibility
  permission grant that wasn't available non-interactively.
