# Drawer Navigation — Added

Post-login Drawer menu, wired end-to-end from Login through logout.

## Navigation structure

- Root stack (`src/navigation/root-navigator.tsx`) now has three routes: `Login`, `Main`, `CaseDetails`.
- `Main` hosts `AppDrawerNavigator` (`src/navigation/app-drawer-navigator.tsx`), a Drawer navigator whose only
  screen today is `CaseList`.
- `CaseDetails` stays a sibling on the root stack (not a drawer screen), reached from `CaseListScreen` via a
  `CompositeNavigationProp` combining the Drawer's and the root Stack's navigation types.
- A hamburger (`MenuIcon`) button was added to `CaseListNavBar` — calls `navigation.openDrawer()`.
- `src/navigation/routes.ts` gained `ROUTE_NAMES.MAIN` and a new `DrawerParamList` type (`CaseList: undefined`).

## Drawer content — `src/navigation/app-drawer-content.tsx`

Three sections, per spec:

1. **Identity** — avatar, name, email, read from the session store.
2. **Tappable list** — `Case List` (navigates + closes drawer), `Profile` / `Settings` (show a localized
   "coming soon" notice — no screens exist yet for these).
3. **Logout** — pinned to the bottom via a bordered footer `Box`. Clears the session store and calls
   `rootNavigation.replace(ROUTE_NAMES.LOGIN)` (via `navigation.getParent()`), so the back button can't
   return to an authenticated screen after logout. It also fires `logout()` from
   `authentication-repository.ts` without awaiting it: that deletes the stored token and revokes it on
   the server (`POST /auth/logout`), and never rejects — see
   [mobile-logout.md](../../../docs/features-added/mobile-logout.md).

New hand-rolled `LogoutIcon` (`src/shared/components/icons/logout-icon.tsx`) — Gluestack UI ships no
sign-out icon, so it follows the same `createIcon` pattern as the existing `FilterIcon`.

## Session store — `src/store/session/`

New Zustand slice, `useSessionStore`:

```ts
{ fieldExecutive: FieldExecutive | null; setFieldExecutive(); clearSession(); }
```

- Populated once, right after a successful login (`use-login-form.ts`): login → fetch the field executive
  profile → `setFieldExecutive()` → `navigation.replace(ROUTE_NAMES.MAIN)`.
- `useCaseList` now reads `fieldExecutive` from this store instead of fetching it itself — removes a
  duplicate `/me` network call that existed before (login and the case list screen each fetched the profile
  separately).

## Domain / backend change: `FieldExecutive.email`

The drawer's identity section needed an email, which didn't exist on the profile yet.

- **App** (`src/domain/field-executive/field-executive.entity.ts`): added `email: string`.
- **Server** (`FullScanServer`, mock backend):
  - New migration `005_add_field_executive_email.sql` — additive `ALTER TABLE ... ADD COLUMN email`, backfills
    the seed row (`fe-001` → `amit.verma@fullscan.example`).
  - `FieldExecutive` / `FieldExecutiveRow` types and `field-executive.service.ts` updated to carry it through.

## Localization

Added `drawer.items.{caseList,profile,settings,comingSoon}`, `drawer.actions.logout`, and
`caseList.navBar.menuLabel` to `en`, `hi`, and `te` under `src/localization/*/common.json`.

## Test / build config changes (required for the Drawer's dependencies)

`@react-navigation/drawer` pulls in `react-native-drawer-layout` → `react-native-reanimated` →
`react-native-worklets` → `react-native-gesture-handler`, none of which were previously exercised by the app,
so Jest and Babel needed the standard, documented setup for these libraries:

- `jest.config.js`:
  - `transformIgnorePatterns` extended to also transform `react-native-drawer-layout`,
    `react-native-reanimated`, `react-native-worklets`.
  - `moduleNameMapper` added for `react-native-reanimated` → its own `mock.js`, and `react-native-worklets` →
    its own `lib/module/mock`.
  - `setupFiles` added: `react-native-gesture-handler/jestSetup.js`.
- `babel.config.js`: added `react-native-worklets/plugin` (Reanimated 4's Babel plugin — must be last in the
  plugins array).

## Tests

- `login-screen.test.tsx` — mocks `fetchCurrentFieldExecutive` (now called during login).
- `use-case-list.test.ts` — seeds `useSessionStore` instead of mocking a repository fetch.
- `root-navigator.test.tsx` — two new integration tests: opening the drawer shows the field executive's
  name/email; pressing Logout returns to the Login screen.

All 8 suites / 37 tests pass; `tsc --noEmit` is clean.

## Known pre-existing, untouched issue

`src/app/AppSafeArea.tsx` has an uncommitted change already in the working tree
(`backgroundColor: '#50edb9'`, hardcoded outside the Theme Engine) that predates this work and wasn't made
as part of it — left as-is.
