# Location & Geo-Fence Validation

Implemented 2026-09-04. Adds device-location validation after login and geo-fence gating of the Case
Details screen, both driven entirely by server-side `mobileAppSettings`.

For a step-by-step trace of what runs when — login through to submission — see
[code-execution-flow.md](code-execution-flow.md).

A case is located from its own coordinates when it has them and from its address string when it does
not. **Both inputs are first-class and permanently supported** — see §5. Most records are address-only
today and coordinates are expected to become the norm as digitization progresses; that shift needs no
app change.

---

## 1. Files changed

### Added

| File                                                           | Purpose                                                           |
| -------------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/core/types/geo-coordinates.ts`                            | `GeoCoordinates` — the one coordinate shape used app-wide         |
| `src/core/types/index.ts`                                      | Barrel                                                            |
| `src/core/utils/geo-coordinates.ts`                            | `isValidGeoCoordinates`, `hasUsableGeoCoordinates` (0,0 sentinel) |
| `src/core/utils/geo-distance.ts`                               | `calculateHaversineDistanceMeters`                                |
| `src/core/utils/index.ts`                                      | Barrel                                                            |
| `src/domain/geo-fence/geo-fence.service.ts`                    | `evaluateGeoFence` business rule, `GeoFenceBypassConsent`         |
| `src/domain/geo-fence/index.ts`                                | Barrel                                                            |
| `src/infrastructure/location/location.errors.ts`               | `LocationUnavailableError` + typed `reason`                       |
| `src/infrastructure/geocoding/geocoding.types.ts`              | Geocoding result / failure-reason / provider-config types         |
| `src/infrastructure/geocoding/geocoding.errors.ts`             | `GeocodingFailedError` + typed `reason`                           |
| `src/infrastructure/geocoding/geocoding-provider.interface.ts` | `IGeocodingProvider` — the vendor seam                            |
| `src/infrastructure/geocoding/google-geocoding.provider.ts`    | Google Geocoding implementation                                   |
| `src/infrastructure/geocoding/geocoding.service.ts`            | Provider registry + address cache + offline policy                |
| `src/infrastructure/geocoding/index.ts`                        | Barrel                                                            |
| `src/infrastructure/distance/distance.types.ts`                | `DistanceMethod`, `DistanceResult`, provider config               |
| `src/infrastructure/distance/distance.interface.ts`            | `IDistanceService`, `IDirectionsDistanceService`                  |
| `src/infrastructure/distance/local-distance.service.ts`        | `LocalDistanceService` (Haversine, offline)                       |
| `src/infrastructure/distance/directions-distance.service.ts`   | `DirectionsDistanceService` (route distance)                      |
| `src/infrastructure/distance/distance.service.ts`              | `DistanceService` façade + fallback policy                        |
| `src/infrastructure/distance/index.ts`                         | Barrel                                                            |
| `src/infrastructure/networking/connectivity.service.ts`        | `ConnectivityService` (NetInfo), advisory only                    |
| `src/infrastructure/storage/key-value-storage.interface.ts`    | `IKeyValueStorage`                                                |
| `src/infrastructure/storage/key-value-storage.service.ts`      | MMKV-backed non-sensitive cache                                   |
| `src/store/location/location.store.ts`                         | The location readiness state machine                              |
| `src/store/location/use-location-readiness.ts`                 | Readiness selector hook + app-resume monitor                      |
| `src/store/location/index.ts`                                  | Barrel                                                            |
| `src/store/geo-fence/geo-fence-bypass.store.ts`                | Persisted per-case Force Proceed consent                          |
| `src/store/geo-fence/index.ts`                                 | Barrel                                                            |
| `src/store/reference-data/use-reference-data-loader.ts`        | Re-fetch `mobileAppSettings` after a failure                      |
| `src/shared/components/bottom-blocking-banner.tsx`             | Reusable persistent bottom banner                                 |
| `src/shared/components/location-permission-banner.tsx`         | Reusable permission/service/fix banner                            |
| `src/shared/components/mock-location-banner.tsx`               | Reusable red mock-location banner                                 |
| `src/shared/components/location-guard.tsx`                     | Interaction blocker + banner host                                 |
| `src/shared/components/icons/refresh-icon.tsx`                 | Recalculate icon                                                  |
| `src/shared/components/icons/settings-icon.tsx`                | Open-settings icon                                                |
| `src/features/cases/hooks/use-case-geo-fence.ts`               | Case Details geo-fence orchestration                              |
| `src/features/cases/components/case-force-proceed-dialog.tsx`  | Red consent dialog                                                |
| `__mocks__/react-native-mmkv.js`                               | Jest mock (in-memory MMKV)                                        |
| `__mocks__/@react-native-community/netinfo.js`                 | Jest mock (defaults to online)                                    |

Tests added: `src/core/utils/geo-distance.test.ts`, `src/core/utils/geo-coordinates.test.ts`,
`src/repositories/case-repository.test.ts`,
`src/domain/geo-fence/geo-fence.test.ts`, `src/domain/reference-data/geo-fence-configuration.test.ts`,
`src/infrastructure/location/location.service.test.ts`,
`src/infrastructure/geocoding/geocoding.service.test.ts`,
`src/infrastructure/distance/distance.service.test.ts`, `src/store/location/location.store.test.ts`,
`src/features/cases/hooks/use-case-geo-fence.test.ts`,
`src/features/cases/components/case-location-section.test.tsx`,
`src/features/cases/screens/case-details-screen.test.tsx`,
`src/shared/components/location-permission-banner.test.tsx`.

### Modified

| File                                                       | Change                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/infrastructure/location/location.types.ts`            | Added permission/readiness/failure-reason types, `source` on `DeviceLocation`        |
| `src/infrastructure/location/location.interface.ts`        | Extended `ILocationService` (support, permission, one-shot fix, settings deep links) |
| `src/infrastructure/location/location.service.ts`          | Implemented the above; `requestPermission` now returns a status, not a boolean       |
| `src/infrastructure/location/index.ts`                     | Re-exports                                                                           |
| `src/infrastructure/networking/index.ts`                   | Exports `ConnectivityService`                                                        |
| `src/infrastructure/storage/index.ts`                      | Exports `KeyValueStorageService`                                                     |
| `src/domain/reference-data/mobile-app-settings.ts`         | New provider/geocoding settings + strict `resolveGeoFenceConfiguration`              |
| `src/domain/reference-data/index.ts`                       | Re-exports                                                                           |
| `src/domain/case/case-detail.entity.ts`                    | `forceProceed` flag on `VerificationOutcomeSubmission`                               |
| `src/domain/case/index.ts`                                 | Re-exports (`GpsCheck` removed)                                                      |
| `src/repositories/case-repository.ts`                      | Maps coordinates-or-null; ignores the server's pre-computed distance/verdict         |
| `src/store/reference-data/use-mobile-app-settings.ts`      | `useGeoFenceConfiguration`, `getGeoFenceConfiguration`                               |
| `src/store/reference-data/index.ts`                        | Re-exports                                                                           |
| `src/app/ApplicationShell.tsx`                             | Mounts the readiness monitor + `LocationGuard`, gated on an authenticated session    |
| `src/features/authentication/hooks/use-login-form.ts`      | Sets reference data _before_ the session (config → location → ready ordering)        |
| `src/features/authentication/hooks/use-biometric-login.ts` | Same ordering on biometric session restore                                           |
| `src/features/cases/hooks/use-case-details.ts`             | Composes `useCaseGeoFence`; sends `forceProceed`; residence gate now client-side     |
| `src/features/cases/components/case-location-section.tsx`  | Geo-fence verdict UI: loading, green/red, recalculate, force proceed                 |
| `src/features/cases/screens/case-details-screen.tsx`       | Hides everything below Case Location until unlocked; hosts the consent dialog        |
| `src/features/cases/hooks/use-case-camera.ts`              | Adapted to the status-returning `requestPermission`                                  |
| `src/navigation/app-drawer-content.tsx`                    | Clears the geocoding cache on logout                                                 |
| `src/shared/components/index.ts`                           | Re-exports the new components/icons                                                  |
| `src/localization/{en,hi,te}/common.json`                  | New `location.*` and `caseDetails.geoFence.*` keys (all three languages)             |
| `ios/FullScan/Info.plist`                                  | Location usage description now also covers address confirmation                      |
| `__mocks__/react-native-permissions.js`                    | Added `openSettings`                                                                 |
| `src/features/cases/hooks/use-case-camera.test.ts`         | Updated fixtures for the new permission API and `DeviceLocation.source`              |

---

## 2. Components / services

### `LocationService` (`src/infrastructure/location`)

The only door to platform location. `isSupported()`, `checkPermission()`, `requestPermission()`,
`getCurrentLocation()`, `watchLocation()`, `clearWatch()`, `openApplicationSettings()`,
`openLocationServiceSettings()`.

- Permission results are normalized to `granted | denied | blocked | unavailable`. iOS "Allow Once" /
  reduced accuracy (`LIMITED`) counts as granted; `blocked` is never re-prompted (a no-op on both
  platforms) and routes the user to Settings instead.
- Failures reject with `LocationUnavailableError` carrying
  `service_disabled | position_unavailable | timeout | permission_denied | unknown`.
- Mock detection uses the Android `position.mocked` flag the native module attaches (no extra
  integrity library). iOS exposes no equivalent public signal, so it is always `false` there.
- `DeviceLocation.source` is `fresh` or `lastKnown`; anything older than 30s is `lastKnown`. Geo-fence
  decisions accept only `fresh`.

### `useLocationStore` (`src/store/location`)

The app-wide state machine, exactly as specified:
`unknown → unsupported | service_disabled | permission_required | permission_denied |
obtaining_location | mock_detected | ready | error`. `isLocationReady(status)` is true only for
`ready`. Overlapping evaluations are sequenced so only the newest one publishes.

`useLocationReadinessMonitor(isActive)` evaluates once when a session exists and again on every
`AppState` resume; it resets the state when the session ends.

### `GeocodingService` (`src/infrastructure/geocoding`)

Address → coordinates behind `IGeocodingProvider`. Providers are held in a registry keyed by the
`geocoding_provider` setting; `registerGeocodingProvider()` adds or replaces one. Google is the only
registered implementation, and nothing above the interface mentions it — swapping vendors is one
server-side setting plus one file.

Cache-first (MMKV, key `geocoding:v1:<provider>:<normalized address>`), which is what makes an
address-only case usable offline once resolved. A cache miss with no network fails with `offline`; an
address the provider cannot match fails with `not_found`. Coordinates are never invented. Failures are
not cached, and normalization (trim/lowercase/collapse whitespace) prevents re-billing the same
address.

### `DistanceService` (`src/infrastructure/distance`)

- `LocalDistanceService` — Haversine, offline, free, deterministic.
- `DirectionsDistanceService` — route/travel distance, replaceable provider, 6s default timeout.
- `DistanceService.measureDistance()` — the façade. See §5.

### `GeoFenceService` (`src/domain/geo-fence`)

`evaluateGeoFence({ distanceMeters, radiusMeters, distanceMethod })` — a pure rule with no
infrastructure dependency. The boundary is **inclusive** (`distance == radius` is inside), because GPS
accuracy is metres-wide and an exclusive edge would only punish rounding. Non-finite inputs fail closed.

### Banners (`src/shared/components`)

- `BottomBlockingBanner` — presentation-only persistent bottom banner (`error` red / `warning` amber),
  up to two actions, no dismiss affordance.
- `LocationPermissionBanner` — reads readiness itself and renders the right copy and action per state
  (prompt when askable, Settings when blocked, retry when a fix failed, nothing when ready).
- `MockLocationBanner` — red, mock-location only, retry + Settings.
- `LocationGuard` — hosts both banners and, while not ready, covers the app with a touch-swallowing
  layer and hides the content from assistive technology (so a screen-reader user can't reach a blocked
  control). Content stays rendered underneath so the executive doesn't lose their place.

All three banners are drop-in on any screen: they subscribe to the store and render `null` when not
applicable. They are mounted once in `ApplicationShell` and are inert before login.

### `useCaseGeoFence` (`src/features/cases/hooks`)

Owns the Case Details check: resolve the case location, measure, evaluate, and track retries and
consent. Statuses: `idle | configuration_unavailable | awaiting_location | resolving_case_location |
measuring | case_location_unresolved | inside | outside | error`. `isCaseContentUnlocked` is the single
gate the screen reads.

---

## 3. Server configuration usage

Nothing is hardcoded. Both required values come from the existing post-login
`mobileAppSettings` payload, read through the existing reference-data store:

| Setting                       | Used for                                                   |
| ----------------------------- | ---------------------------------------------------------- |
| `geo_fence_radius_meters`     | The geo-fence threshold                                    |
| `locationRetryCount`          | Recalculation attempts before Force Proceed is offered     |
| `mock_location_block_enabled` | Whether a mocked location blocks the app (already existed) |

**Strict, un-defaulted read.** Every other setting falls back to a safe default via
`resolveMobileAppSettings`. These two do not: `resolveGeoFenceConfiguration` returns `null` when the
payload has not arrived or either value is missing, malformed, or outside the range the back office
enforces (`geo_fence_radius_meters` 10–2000, `locationRetryCount` 3–10). A `null` result yields
`configuration_unavailable`, which unlocks nothing and offers no Force Proceed — a guessed radius could
wave through an executive who never visited the address. Its Retry re-fetches the payload, so a failed
post-login fetch is recoverable rather than a dead end.

Flow: `Login Success → Load mobileAppSettings → Validate Location → App Ready`. Enforced by ordering
`setReferenceData` before `setFieldExecutive` in both login paths — establishing the session is what
starts location validation, and that validation reads the settings.

### Provider configuration (also server-driven, optional)

Added to the same open `values` map, all optional with safe defaults:

| Key                           | Default  | Meaning                                      |
| ----------------------------- | -------- | -------------------------------------------- |
| `geocoding_provider`          | `google` | Which registered `IGeocodingProvider` to use |
| `directions_provider`         | `google` | Routing provider id                          |
| `directions_distance_enabled` | `false`  | Whether route distance may be fetched at all |
| `maps_api_key`                | `''`     | Provider key (never logged)                  |
| `maps_api_base_url`           | `''`     | Geocoding endpoint override (proxy)          |
| `directions_api_base_url`     | `''`     | Directions endpoint override (proxy)         |

With no key configured, geocoding fails with `not_configured` and route distance is never attempted —
neither affects a case that already carries coordinates, which needs no provider at all. The key is
therefore only needed for as long as cases arrive without coordinates (see §9.2).

---

## 4. iOS / Android permission changes

- **Android** (`android/app/src/main/AndroidManifest.xml`): no change needed —
  `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` were already declared. Opening the system
  Location Services screen uses `Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS')`,
  which needs no permission.
- **iOS** (`ios/FullScan/Info.plist`): `NSLocationWhenInUseUsageDescription` reworded to cover
  confirming presence at the assigned address as well as geotagging. No new key required — the app
  only ever needs when-in-use.
- **`ios/Podfile`**: no change — `setup_permissions(['LocationWhenInUse'])` was already present, which
  is what `openSettings()` and `check()`/`request()` need.
- No new npm dependencies. `react-native-permissions`, `@react-native-community/geolocation`,
  `react-native-mmkv` and `@react-native-community/netinfo` were already declared.

---

## 5. Distance / fallback strategy

`distanceMethod: 'local' | 'directions'` is reported on every result and surfaced in the UI as a
caption. No business rule or component branches on the provider.

**Geo-fence validation never depends on the Directions API.** `DistanceService.measureDistance()`
computes the local Haversine result _first_, then attempts a route distance only when
`directions_distance_enabled` is on and the provider has a key. Every routing failure — HTTP error,
`OVER_QUERY_LIMIT`/billing, timeout, no network, malformed route — is swallowed and the local result is
returned. So with both coordinates known, a verdict is always produced, offline included.

### Case location — two equally supported inputs

A case carries **at most coordinates or an address string** and nothing else. `CaseDetail.coordinates`
is `GeoCoordinates | null`; there is no server-computed distance or in-range verdict in the domain
model, because only the device can know where the executive is standing during the visit.

Both inputs are first-class and permanently supported — **neither is a fallback for the other, and
neither is treated as the exceptional case.** Resolution:

1. Usable coordinates on the case → used directly, no lookup. `0,0` (the column's default value) and
   out-of-range values count as absent.
2. Address only → `GeocodingService`, cached on success and reused thereafter, including offline.
3. Neither → `case_location_unresolved`; nothing is guessed.

Today most records are address-only; as digitization progresses more will arrive with coordinates.
**That shift needs no code change** — it simply moves cases from branch 2 to branch 1, and the cheaper
branch gets used more often. Nothing downstream of this step knows which branch produced the location:
`useCaseGeoFence`, the geo-fence rule, the distance services and the UI all see a resolved
`GeoCoordinates` either way, so both mixes of data behave identically.

Case-location resolution runs **before** the device fix is required, because the two are independent —
finding where the _case_ is never depends on where the _device_ is. Branch 1 returns immediately;
branch 2's lookup overlaps GPS acquisition instead of queueing behind it. A resolved address is then
held for the lifetime of the screen, so Recalculate re-reads GPS without re-billing a geocode.

`case-repository.ts` accepts both the flat `latitude`/`longitude` contract and the API's current nested
`gpsCheck.targetLatitude/targetLongitude`, discarding the pre-computed `distanceMeters`/`isWithinRange`
that shape also carries. So the app works before and after that server change, and nothing above the
repository sees the difference.

---

## 6. Case Details behaviour

On open, only the existing **Case Information** section plus **Case Location** render. Case Location
shows a spinner with "Determining the case location…" / "Finding your distance from the case address…"
while working.

| Outcome                   | Case Location                                                             | Sections below |
| ------------------------- | ------------------------------------------------------------------------- | -------------- |
| `distance <= radius`      | Green border + "GPS Match: {n}m from address"                             | All shown      |
| `distance > radius`       | Red border + "GPS Alert… you must be within {radius}m" + **Recalculate**  | Hidden         |
| Case location unresolved  | Red + a reason-specific message + Recalculate                             | Hidden         |
| Device location not ready | Amber "waiting for a valid device location" (the app banner owns the fix) | Hidden         |
| Configuration unavailable | Red + Retry (re-fetches settings)                                         | Hidden         |

After `locationRetryCount` recalculations without success, **Proceed Without Distance** appears at the
bottom of the Case Location section. It opens a red consent dialog stating that the case will be
scrutinized after submission. **Cancel** leaves the case blocked; **Agree** records the consent and
reveals the remaining sections, replacing the button with a standing warning notice.

The consent (`useGeoFenceBypassStore`) is per case and MMKV-persisted, so leaving and returning to Case
Details does not silently drop it.

**Wire contract.** The submission is an ordinary verification outcome carrying the visit's own location
evidence:

| Field                  | Value                                                                      |
| ---------------------- | -------------------------------------------------------------------------- |
| `currentLatitude`      | Where the executive was standing at the moment of submission               |
| `currentLongitude`     | ditto                                                                      |
| `distanceToCaseMeters` | Measured distance to the case location, as measured (`null` if unresolved) |
| `forceProceed`         | `true` only after the consent flow, `false` on every normal submission     |

The position is read from `useLocationStore` **at the moment of the tap**, not from the earlier
measurement, so it is where the executive actually is when they submit — and it is always a fresh fix,
since normal app usage is only permitted while location is `ready`. The distance is sent as measured;
the back office compares it against the configured radius itself rather than trusting an app-side
verdict. `forceProceed` is what marks the case for scrutiny — the back office accepts the case like any
other; no separate endpoint or nested payload is involved. The remaining consent detail (configured
radius, attempt count, consent timestamp) stays on the device in `useGeoFenceBypassStore` and can be
added later if the report wants it.

Force Proceed is offered for `outside`, `case_location_unresolved` and `error` only — never for a
device problem (permission, mock location) or a missing configuration, which must be fixed rather than
consented away. Accepting a **new** case remains available without being at the address, since that
happens before the executive travels.

---

## 7. Edge cases handled

| Case                                       | Behaviour                                                                        |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| Device does not support location           | `unsupported`; banner with no pointless action; app blocked                      |
| Location services disabled                 | `service_disabled`; Settings + Retry                                             |
| Permission denied (askable)                | `permission_required`; in-app prompt                                             |
| Permission permanently denied              | `permission_denied`; Settings (never a silent re-prompt)                         |
| Permission changed from Settings           | Re-evaluated on app resume                                                       |
| Granted but GPS unavailable / temporary    | `error` + reason; Retry                                                          |
| Mock location detected                     | `mock_detected`; red banner; app blocked; re-checked on resume and on retry      |
| App resumes from background                | `AppState` listener re-evaluates readiness                                       |
| No internet                                | Coordinates + fresh GPS → Haversine verdict; no network needed                   |
| Poor / intermittent internet               | Route distance timeout (6s) falls back to local; UI never blocks on it           |
| Case has coordinates                       | Used directly, no lookup                                                         |
| Case has only an address                   | Geocoded once, then cached and reusable offline                                  |
| Case has both                              | Coordinates win; any earlier geocode for that address is ignored                 |
| Case digitized between visits              | Next visit uses the payload coordinates; no further lookup, no code change       |
| Invalid / missing case location            | `case_location_unresolved`; explicit message; no guessing                        |
| Geocoding failure                          | Reason-specific copy (`offline`, `not_found`, `not_configured`, generic)         |
| Directions API failure / timeout           | Swallowed; local result used; `distanceMethod: 'local'`                          |
| Server configuration unavailable / invalid | `configuration_unavailable`; nothing unlocked; Retry re-fetches                  |
| Stale cached device location               | `source: 'lastKnown'` is refused as a current position                           |
| Stale/corrupt cache entry                  | Corrupt JSON is dropped and re-resolved                                          |
| Leaving and returning to Case Details      | Consent persists; retry budget resets (so it is harder, not easier, to bypass)   |
| Multiple recalculation attempts            | Counted against `locationRetryCount`; remaining count shown                      |
| Force Proceed cancelled / confirmed        | Blocked / unlocked with an auditable record                                      |
| Overlapping evaluations or measurements    | Only the newest result publishes; configuration is read live, not from a closure |

---

## 8. Tests and checks executed

- `npx tsc --noEmit` → clean.
- `npx jest` → **30 suites, 286 tests, all passing** (baseline before this work: 17 suites, 123 tests).
- `npx prettier --check` on every file added → clean.

Coverage added: location support detection; services disabled; all permission states; mock location
(and the server switch that disables blocking); current-location retrieval and stale-fix rejection;
Haversine values, symmetry and antimeridian; geo-fence inside / outside / `distance == radius`;
Directions success, failure, timeout, offline and unconfigured fallbacks; offline calculation; address
geocoding (provider, cache, offline, not-found, unconfigured, blank, corrupt cache); configuration
loading and strict validation; `locationRetryCount` at 3 and 5; Force Proceed eligibility, consent
confirmation, cancellation and per-case isolation; the submitted payload
(`currentLatitude`/`currentLongitude`/`distanceToCaseMeters`/`forceProceed`, on both normal and
force-proceeded submissions); case-detail coordinate mapping (flat, nested, absent, `0,0`, half-set,
out-of-range); coordinate/address precedence (a digitized case ignores any earlier
geocode); address-only resolution running ahead of the GPS fix and geocoding only once across
recalculations; and Case Details section visibility end-to-end at the screen level.

### `npm run lint` — pre-existing failure, not caused by this work

```
ESLint couldn't find the plugin "@typescript-eslint/eslint-plugin".
```

`.eslintrc.js` extends `@typescript-eslint`, `react`, `jsx-a11y`, `security`, `promise`, `sonarjs`,
`unicorn` and `prettier` plugins, but none of them are in `package.json`'s `devDependencies`, so lint
fails repo-wide on the pre-existing tree as well. Installing them was out of scope for this change; it
needs a dependency decision. As a substitute, the new files were checked with Prettier directly and
the repo's own conventions were followed by hand (kebab-case files, `FILE_NAME` log prefixes,
Gluestack-only components, theme tokens only, localization keys only, no `console.log`, no `any`).

`npx prettier --check "src/**"` also reports ~40 pre-existing files (e.g. `theme-engine.ts`,
`form-text-field.tsx`, `case-repository.ts`) as unformatted. Those were left alone deliberately —
reformatting them would bury this change in unrelated diff noise.

---

## 9. Decisions taken, and what is still open

Items 1-3 were decided on 2026-09-04; 4 onwards are still open.

1. **[DECIDED] Force Proceed is a flag on an ordinary submission.** Confirmed: the server accepts a
   force-proceeded case like any other, and the app sends `forceProceed: true` on the verification
   outcome (see §6). **Server-side work still needed:** accept and persist `forceProceed` on
   `POST /cases/:id/verification-outcome` (a boolean column on the component/outcome row) and surface it
   wherever cases are reviewed, so flagged cases can actually be scrutinized. Until then the flag is
   accepted and ignored — the app side is complete either way.
2. **[DECIDED] The maps key ships to the device, restricted by bundle id.** Confirmed: `maps_api_key` will be
   served through `mobileAppSettings` and locked down by application identity rather than proxied.
   Two things to get right when the key is created, because a bundle-id restriction only holds if both
   platforms are configured:

   - **iOS** — restrict to the iOS bundle id (`PRODUCT_BUNDLE_IDENTIFIER`).
   - **Android** — Android key restrictions are package name **plus** the signing certificate SHA-1;
     add the release keystore's fingerprint as well as the debug one, or the release build will get
     `REQUEST_DENIED`, which surfaces in the app as
     `caseDetails.geoFence.unresolvedNotConfigured`.
   - Restrict the key to the **Geocoding API** (and Directions, only if `directions_distance_enabled`
     is ever turned on) so an extracted key can't be spent on other Google products.
     Note that Geocoding is a **web-service** API: web-service calls authenticate by key alone and
     Google does not enforce bundle-id/package restrictions on them the way it does for the mobile
     SDKs. So treat the restriction as narrowing blast radius, not as preventing reuse — the real caps
     are the API restriction plus a **quota/budget alert** on the project. If per-key spend turns out
     to matter, `maps_api_base_url` still allows moving to a FullScanServer proxy later with no app
     change.

   **This dependency shrinks over time, it does not grow.** Only branch 2 of the case-location
   resolution (§5) needs the key, and every case that gets digitized moves permanently to branch 1.
   Combined with the per-address cache — an address costs at most one lookup ever — geocoding traffic
   should trend towards zero as the back office fills in coordinates. Worth factoring into how much to
   invest in the proxy: it is a bridge, not permanent infrastructure. Note also that until the key is
   served, branch 2 cases surface `caseDetails.geoFence.unresolvedNotConfigured` ("Address lookup is
   not configured") and cannot be geo-fenced, while branch 1 cases are unaffected.

3. **[DECIDED] A case carries coordinates or an address, and the app reports the visit back.**
   Confirmed: case detail holds at most latitude/longitude **or** an address string — no
   server-computed distance and no in-range verdict. `CaseDetail.gpsCheck` is therefore gone, replaced
   by `coordinates: GeoCoordinates | null` (see §5). Both inputs are permanently supported as equals:
   most records are address-only today, coordinates are expected to become the norm as digitization
   progresses, and that change requires nothing on the app side. The app sends the visit's location
   evidence on submission: `currentLatitude`, `currentLongitude`, `distanceToCaseMeters`,
   `forceProceed` (see §6).

   **Server-side work needed:** columns for the four submitted fields on the outcome row, and a
   decision on whether `gps_distance_meters` / `gps_is_within_range` should be overwritten from
   `distanceToCaseMeters` (recommended — the submitted value describes the actual visit, whereas the
   stored one is a pre-assignment estimate) or kept as separate visit columns. Also worth checking that
   nothing else — a report, an admin-portal column, an SLA rule — still reads the pre-assignment
   verdict as the answer to "was the executive at the address", since the app no longer honours it.

   The repository accepts the current nested `gpsCheck` shape as well as flat `latitude`/`longitude`,
   so the app needs no change whenever the server payload is trimmed.

4. **[OPEN] Service-disabled vs. no-fix on iOS.** Android reports disabled providers distinguishably; iOS does
   not, so a services-off iPhone surfaces as "unable to determine your location" rather than "turn
   location on". Both block the app and both point at settings, so it isn't user-visible — but if you
   want an exact iOS distinction it needs a native module.
5. **A fix older than 30s is treated as stale** (`FRESH_FIX_MAX_AGE_MS`). Chosen conservatively; adjust
   if field conditions (indoor stairwells, dense urban canyons) make it too aggressive.
6. **The retry budget resets when Case Details is remounted**, while the consent persists. This makes
   bypassing harder after a revisit, not easier. If the budget should also persist per case, say so.
7. **Accepting a new case is not geo-fenced.** Acceptance happens before travelling to the address, so
   requiring presence would break the workflow. Everything else on the screen is gated.
8. **Force Proceed also covers an unresolved case location** (e.g. address-only case, offline all day),
   not just "outside the fence". If policy is that an unresolved location must never be bypassable,
   that's a one-line change in `useCaseGeoFence`.
9. **Case detail itself is still fetched over the network.** Offline geo-fencing works for a case whose
   detail is already on screen; a fully offline case list/detail cache is separate, unbuilt work.
10. **`tsconfig.tsbuildinfo` is tracked in git** and was rewritten by the typecheck runs. Consider
    gitignoring it.
