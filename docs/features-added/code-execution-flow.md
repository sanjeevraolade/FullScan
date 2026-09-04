# Code Execution Flow: Login → Location Validated → Case Details Submitted

Traces what actually runs, in order, from the moment the field executive taps **Login** through to a
submitted verification outcome — with the location and geo-fence machinery in place.

Picks up exactly where [execution-flow.md](execution-flow.md) stops (that one covers native launch →
Login screen rendered). For the design rationale behind each piece, see
[location-geo-fence-validation.md](location-geo-fence-validation.md); this document is only about
sequence and control flow.

Line references are accurate as of 2026-09-04.

---

## Overview

```text
 tap Login
    │
 1. useLoginForm.submitLogin      POST /auth/login, then profile + reference data in parallel
    │                             setReferenceData()  ← configuration first
    │                             setFieldExecutive() ← session second
    ▼
 2. ApplicationShell re-renders   Zustand subscription flips isAuthenticated → true
    │                             ├─ useLocationReadinessMonitor(true)
    │                             └─ <LocationGuard isEnforced>
    ▼
 3. useLocationStore.evaluate()   support → permission → fix → mock → freshness
    │                             publishes exactly one status
    ▼
 4. LocationGuard                 anything but `ready` ⇒ overlay + persistent bottom banner
    │                             `ready` ⇒ app usable
    ▼
 5. open Case Details             useCaseDetails → useCaseGeoFence.measure()
    │                             config → case location → device fix → distance → verdict
    ▼
 6. outside the fence             Recalculate ×locationRetryCount → Force Proceed → consent
    ▼
 7. submit                        currentLatitude/Longitude, distanceToCaseMeters, forceProceed
```

Two structural points that explain most of the ordering below:

- **The trigger is a store write, not a navigation event.** Location validation begins because
  `fieldExecutive` became non-null, not because the router moved to `Main`. Both the password and
  biometric login paths therefore behave identically without either of them knowing about location.
- **Only `ready` permits normal use.** Every other readiness state blocks the whole app behind one
  guard, so no screen has to defend itself individually.

---

## 1. Login succeeds

`submitLogin` — [use-login-form.ts:107](../../src/features/authentication/hooks/use-login-form.ts#L107)

React Hook Form's `handleSubmit` runs field validation first; the callback below only fires when the
form is valid (the failure branch just logs which fields blocked it).

| Line  | Call                                                                | Effect                                        |
| ----- | ------------------------------------------------------------------- | --------------------------------------------- |
| `119` | `await login({ username, password })`                               | Token persisted to Keychain by the repository |
| `120` | `Promise.all([fetchCurrentFieldExecutive(), fetchReferenceData()])` | Profile + `mobileAppSettings`, in parallel    |
| `130` | `useReferenceDataStore.getState().setReferenceData(...)`            | **Configuration first**                       |
| `131` | `useSessionStore.getState().setFieldExecutive(...)`                 | **Session second**                            |
| `134` | `evaluateBiometricEnrollmentEligibility(...)`                       | May hand navigation to the enrollment dialog  |
| `147` | `navigation.replace(ROUTE_NAMES.MAIN)`                              | Login removed from the stack                  |

**Why 130 before 131.** Writing the session is what starts location validation (§2), and that
validation reads `mobileAppSettings` (§3, line 108). If these two lines were swapped, the first
evaluation would race the configuration and could read
`DEFAULT_MOBILE_APP_SETTINGS` instead of the server's values. This is the
`Login Success → Load mobileAppSettings → Validate Location → App Ready` sequence, enforced by
statement order.

On failure, `resolveLoginErrorKey` at [:148](../../src/features/authentication/hooks/use-login-form.ts#L148)
maps the error to a localization key; neither store is written, so nothing in §2 onwards runs.

**Biometric login** takes the same shape: `restoreSession()` in
[use-biometric-login.ts](../../src/features/authentication/hooks/use-biometric-login.ts) fetches the
same two payloads and applies the same configuration-before-session ordering.

---

## 2. The session flips a subscription

`ApplicationShell` — [ApplicationShell.tsx:32](../../src/app/ApplicationShell.tsx#L32)

```tsx
const isAuthenticated = useSessionStore((state) => state.fieldExecutive !== null); // :33
useLocationReadinessMonitor(isAuthenticated);                                      // :34
...
<LocationGuard isEnforced={isAuthenticated}>                                       // :42
  <RootNavigator />
</LocationGuard>
```

Step 1's line 131 re-renders this component with `isAuthenticated: true`, which simultaneously starts
validation (`:34`) and arms the blocking UI (`:42`). Before login both are inert, so the Login screen
never sees a permission prompt or a banner.

`useLocationReadinessMonitor` — [use-location-readiness.ts:61](../../src/store/location/use-location-readiness.ts#L61)

```text
useEffect(…, [evaluate, isActive, reset])
 ├─ !isActive → reset() and return          // the logout path: clears status, location, error
 └─ isActive
     ├─ void evaluate()                      // :75  first evaluation
     └─ AppState.addEventListener('change')  // :77  re-evaluate on every 'active' transition
         └─ cleanup: subscription.remove()   // :87
```

That `AppState` listener is the entire mechanism for noticing a permission changed in Settings, a
location-services toggle, or a mock-GPS app switched on while the app was backgrounded. Nothing polls.

---

## 3. The readiness state machine

`evaluate()` — [location.store.ts:58](../../src/store/location/location.store.ts#L58)

Before any check, it takes a sequence number and routes every write through one helper:

```text
:59  latestEvaluationId += 1
:60  const evaluationId = latestEvaluationId
:61  const isStale = () => evaluationId !== latestEvaluationId
:63  const publish = (status, location, errorReason) => {
:68    if (isStale()) return            // a newer evaluation already won
:75    set({ status, location, errorReason, isEvaluating: false, lastEvaluatedAt: new Date() })
     }
```

An app-resume re-check and a manual banner retry can overlap; without this the slower one would
overwrite the newer result. Then, short-circuiting at the first failure:

| Line  | Check                                              | Outcome               |
| ----- | -------------------------------------------------- | --------------------- |
| `82`  | `LocationService.isSupported()` is false           | `unsupported`         |
| `87`  | `checkPermission()` → `unavailable`                | `unsupported`         |
| `92`  | → `blocked` (permanently denied)                   | `permission_denied`   |
| `97`  | → `denied` (still askable)                         | `permission_required` |
| `103` | — sets an interim status while the fix is acquired | `obtaining_location`  |
| `106` | `getCurrentLocation()` with `maximumAge: 0`        | throws → catch below  |
| `109` | `isMockLocation` (always blocks, never configurable) | `mock_detected`     |
| `115` | `location.source !== 'fresh'`                      | `error`               |
| `123` | all checks passed                                  | **`ready`**           |

Two lines carry most of the weight:

- **`:109`** a mocked fix always blocks the app and is always reported to
  `POST /security/mock-location`; no setting can switch either off.
- **`:115`** a `lastKnown` fix is refused outright. A cached position is not where the executive is
  standing, so it can never make the app ready; the user retries instead.

The catch block at [:124-142](../../src/store/location/location.store.ts#L124-L142) maps
`LocationUnavailableError.reason` onto a status: `service_disabled` → `service_disabled`,
`permission_denied` → `permission_required`, everything else → `error` with the reason retained for the
banner copy.

Sibling actions on the same store: `requestPermission()` at
[:145](../../src/store/location/location.store.ts#L145) (prompts, then re-runs `evaluate()` on success),
`openSettings()` at [:170](../../src/store/location/location.store.ts#L170) (system location settings for
`service_disabled`/`mock_detected`/`unsupported`, the app's own page otherwise), and `reset()` at
[:182](../../src/store/location/location.store.ts#L182).

---

## 4. Blocking until `ready`

`LocationGuard` — [location-guard.tsx:39](../../src/shared/components/location-guard.tsx#L39)

```ts
const isBlocking = isEnforced && !isReady && status !== 'unknown';
```

`status !== 'unknown'` is why nothing flashes during the very first evaluation. When blocking:

| Lines   | Element                                               | Purpose                                             |
| ------- | ----------------------------------------------------- | --------------------------------------------------- |
| `50-56` | content wrapper with `accessibilityElementsHidden`    | A screen-reader user cannot reach a covered control |
| `57-68` | absolute, transparent `Box`                           | Swallows every touch; content stays readable        |
| `69-74` | `<LocationPermissionBanner /> <MockLocationBanner />` | Rendered above the overlay, so their buttons work   |

Each banner decides for itself whether to appear: `LocationPermissionBanner` returns `null` for
`ready`, `unknown` and `mock_detected` (that last one belongs to its sibling), and picks its copy and
actions from the status — prompt when the permission is askable, Settings when it is blocked, Retry
when a granted permission simply produced no fix. `MockLocationBanner` renders only for
`mock_detected`. Both are drop-in on any screen; the shell just happens to be where they are mounted.

Retry → `evaluate()`. Grant → `requestPermission()`. Either can move the status to `ready`, at which
point `isBlocking` becomes false and the overlay and banner unmount.

---

## 5. Opening Case Details

`useCaseDetails(caseId)` fetches the case, then wires the geo-fence hook at
[use-case-details.ts:182](../../src/features/cases/hooks/use-case-details.ts#L182):

```ts
const geoFence = useCaseGeoFence({
  caseId,
  address: caseDetail?.address ?? '',
  targetCoordinates: caseDetail?.coordinates ?? null, // already null unless usable
  isEnabled: caseDetail !== null, // nothing runs against placeholder data
});
```

`coordinates` is `null` unless the payload carried a usable pair — `case-repository.ts`'s
`mapCaseCoordinates` already rejected `0,0`, half-populated and out-of-range values, so the hook never
has to second-guess it.

The driving effect — [use-case-geo-fence.ts:315](../../src/features/cases/hooks/use-case-geo-fence.ts#L315):

```ts
useEffect(() => {
  void measure();
}, [caseId, isEnabled, locationRetryCount, locationStatus, measure, radiusMeters]);
```

It depends on `locationStatus`, not on the fix itself, so a re-measure happens when location _becomes
usable_ — not on every GPS update.

### `measure()` — [:224](../../src/features/cases/hooks/use-case-geo-fence.ts#L224)

```text
measurementIdRef += 1                                   // :225 discard superseded runs
│
├─ !isEnabled                          → 'idle'          // :229
│
├─ getGeoFenceConfiguration() === null → 'configuration_unavailable'   // :239
│     read LIVE, never from the closure
│
├─ resolveCaseCoordinates()                              // :254
│    ├─ case has usable coordinates    → return it, no lookup          // :170
│    ├─ already resolved this mount    → reuse the ref                 // :178
│    ├─ blank address                  → 'invalid_address'             // :185
│    └─ GeocodingService.resolveAddressCoordinates()                   // :199
│         → null ⇒ 'case_location_unresolved'   (never a guessed point)
│
├─ locationStatus !== 'ready'          → 'awaiting_location'           // :266
│
├─ DistanceService.measureDistance()                     // :278  → 'measuring'
│
└─ evaluateGeoFence()                  → 'inside' | 'outside'          // :286, :301
```

**`:239` reads the configuration live.** This is not cosmetic: a measurement queued behind a retry that
re-fetched the configuration would otherwise judge against the `null` its closure captured, and its
stale result could overwrite the correct one.

**`:254` before `:266` — case location before device fix.** The two are independent: finding where the
_case_ is never depends on where the _device_ is. A case carrying coordinates returns immediately; a
case carrying only an address has its lookup overlap GPS acquisition rather than queue behind it.

Inside `GeocodingService.resolveAddressCoordinates` —
[geocoding.service.ts:81](../../src/infrastructure/geocoding/geocoding.service.ts#L81) — the order is
itself deliberate:

| Line  | Step                                | Failure                                    |
| ----- | ----------------------------------- | ------------------------------------------ |
| `86`  | blank address                       | `invalid_address`                          |
| `91`  | provider registry lookup            | `not_configured` (unknown provider id)     |
| `102` | **cache read**                      | — this is the offline path                 |
| `107` | `provider.isConfigured()`           | `not_configured` (no API key)              |
| `114` | `ConnectivityService.isConnected()` | `offline`                                  |
| `124` | `provider.geocodeAddress()`         | `not_found` / `provider_error` / `timeout` |

Cache before key check and before connectivity is what makes an already-resolved address work offline
and unbilled.

And inside `DistanceService.measureDistance` —
[distance.service.ts:39](../../src/infrastructure/distance/distance.service.ts#L39):

```text
:43  const localResult = await LocalDistanceService.calculateDistance(...)   // ALWAYS first
:47  no directionsConfiguration        → return localResult
:53  provider not configured           → return localResult
:62  try route distance                → return routeResult
:70  catch (anything at all)           → return localResult
```

The local Haversine result exists before any network call is attempted, so no routing outcome — error,
timeout, quota, billing, offline — can prevent a verdict.

### What the screen reads

[case-details-screen.tsx:124](../../src/features/cases/screens/case-details-screen.tsx#L124):

```ts
const isCaseContentVisible = geoFence.isCaseContentUnlocked; // inside || bypassConsent !== null
```

One boolean gates everything: all sections below Case Location at
[:303](../../src/features/cases/screens/case-details-screen.tsx#L303) and Submit at
[:397](../../src/features/cases/screens/case-details-screen.tsx#L397). Accepting a **new** case stays
outside the gate — that happens before the executive travels to the address.

`CaseLocationSection` renders one branch per status:
[`:203`](../../src/features/cases/components/case-location-section.tsx#L203) the spinner while busy,
[`:237`](../../src/features/cases/components/case-location-section.tsx#L237) the configuration error plus
Retry, [`:273`](../../src/features/cases/components/case-location-section.tsx#L273) the red blocked
state with Recalculate, and the green match otherwise. Its border colour comes from the same status at
[`:138`](../../src/features/cases/components/case-location-section.tsx#L138).

---

## 6. Retry, then Force Proceed

`recalculate()` — [:332](../../src/features/cases/hooks/use-case-geo-fence.ts#L332)

```text
attemptCount += 1                                       // :337
├─ configuration missing → await reloadReferenceData()  // :339  recovery path
├─ await evaluateLocationReadiness()                    // :349  a NEW GPS fix
└─ await measure()                                      // :350
```

Taking a new fix first is the point: the executive has usually walked closer since the last attempt.
The resolved case address is _not_ re-fetched — the ref at `:178` short-circuits it — so a Recalculate
costs GPS, never a geocode.

`canForceProceed` — [:369](../../src/features/cases/hooks/use-case-geo-fence.ts#L369)

```ts
isBlockedByGeoFence && locationRetryCount !== null && attemptCount >= locationRetryCount;
```

`isBlockedByGeoFence` (`:361`) is `outside | case_location_unresolved | error` — deliberately **not**
`mock_detected`, `permission_denied` or `configuration_unavailable`. A device or configuration problem
must be fixed, never consented away.

`confirmForceProceed()` — [:372](../../src/features/cases/hooks/use-case-geo-fence.ts#L372) — re-checks
eligibility (a defence against a stale UI), then writes the consent to the MMKV-persisted
`useGeoFenceBypassStore`. That write flips `isCaseContentUnlocked`, which re-renders the screen with
every section visible. Cancelling the dialog simply never calls this, so nothing changes.

Because the consent is persisted, leaving and returning to Case Details keeps the case unlocked; the
retry budget, held in component state, resets — making a second bypass harder, not easier.

---

## 7. Submission

`submit()` — [use-case-details.ts:224](../../src/features/cases/hooks/use-case-details.ts#L224)

```ts
const currentLocation = useLocationStore.getState().location;  // :232 read at the moment of the tap
submitVerificationOutcome(caseId, {
  ...form fields...
  currentLatitude: currentLocation?.latitude ?? null,          // :250
  currentLongitude: currentLocation?.longitude ?? null,        // :251
  distanceToCaseMeters: geoFence.distanceMeters,               // :252
  forceProceed: geoFence.bypassConsent !== null,               // :253
});
```

The position is read non-reactively **at submit time**, not taken from the earlier measurement, so it
describes where the executive is standing when they submit. Because normal app usage is only permitted
while location is `ready`, that fix is always fresh and non-mocked — the `?? null` fallbacks are
defensive, not an expected path.

`distanceToCaseMeters` is sent as measured; the back office compares it against the configured radius
itself rather than trusting an app-side verdict. `forceProceed` is what marks the case for scrutiny.

---

## Where each concern lives

| Question                              | Owner                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------ |
| Does this device have/allow location? | `LocationService` (`src/infrastructure/location`)                        |
| Is the app allowed to work right now? | `useLocationStore` + `LocationGuard`                                     |
| Where is this case?                   | `useCaseGeoFence.resolveCaseCoordinates` → `GeocodingService`            |
| How far away is it?                   | `DistanceService` → `LocalDistanceService` / `DirectionsDistanceService` |
| Is that close enough?                 | `evaluateGeoFence` (`src/domain/geo-fence`)                              |
| What is the threshold / retry budget? | `mobileAppSettings` via `useGeoFenceConfiguration`                       |
| Did the user knowingly bypass?        | `useGeoFenceBypassStore`                                                 |
| What does the screen show?            | `CaseLocationSection` + `isCaseContentUnlocked`                          |

No screen calls a platform API, no component computes a distance, and no business rule imports a
provider — which is why swapping the geocoding vendor or adding a distance strategy touches one file.
