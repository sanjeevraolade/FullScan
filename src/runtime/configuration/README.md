# Configuration Engine

Per `docs/04-Runtime/06-Configuration-Engine.md`. Single source of runtime metadata for every other engine.

## Current behavior ("Hello Runtime" pass)

- `initialize()` assembles a bundled local `ConfigurationPackage` — **no networking**, per the current
  sprint scope. It still runs the validate-before-activate step (required metadata fields present, no
  duplicate `screenId`s) that a real downloaded package would go through; an invalid package is never
  activated.
- Screens are authored one JSON file per screen under `screens/` (`runtime-preview.json`, `login.json`)
  rather than one growing file — easier to navigate/diff as more screens are added. `configuration-engine.ts`
  imports each and assembles them into `SAMPLE_CONFIGURATION` at module scope. This is a **runtime merge of
  already bundle-time-embedded JSON**: Metro inlines every imported JSON file into the JS bundle regardless
  of how many files it's split across, so assembling the array costs one object/array literal — not a
  network fetch, not a disk read, not measurable against RN startup cost. A real downloaded Configuration
  Package still arrives over the wire as a single JSON payload either way; this split is a source-authoring
  choice only.
- `runtime-preview` is the original pipeline smoke-test fixture, still used by `dynamic-form-engine.test.tsx`.
  `login` is the app's actual launch screen — the initial route of `src/navigation/root-navigator.tsx`.
- `getActiveConfiguration()` / `getScreen(screenId)` read the activated package.
- `dispose()` clears the active package.

## Not implemented yet

Downloading over HTTPS, checksum/version compatibility checks, offline cache persistence, and rollback to
a previous package on activation failure (there is no previous package yet in this pass) — all deferred
until the app-wiring/networking follow-up.

`ConfigurationEngine` is exported as a class, not a singleton — the Verification Runtime Engine owns one
instance per runtime, matching `WidgetRegistry`.
