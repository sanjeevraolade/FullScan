# Configuration Engine

Per `docs/04-Runtime/06-Configuration-Engine.md`. Single source of runtime metadata for every other engine.

## Current behavior ("Hello Runtime" pass)

- `initialize()` loads `sample-configuration.json`, a bundled local `ConfigurationPackage` — **no
  networking**, per the current sprint scope. It still runs the validate-before-activate step (required
  metadata fields present, no duplicate `screenId`s) that a real downloaded package would go through; an
  invalid package is never activated.
- The bundled package currently defines two screens: `runtime-preview` (the original pipeline smoke-test
  fixture, still used by `dynamic-form-engine.test.tsx`) and `login` — the app's actual launch screen,
  rendered by `src/app/ApplicationShell.tsx`.
- `getActiveConfiguration()` / `getScreen(screenId)` read the activated package.
- `dispose()` clears the active package.

## Not implemented yet

Downloading over HTTPS, checksum/version compatibility checks, offline cache persistence, and rollback to
a previous package on activation failure (there is no previous package yet in this pass) — all deferred
until the app-wiring/networking follow-up.

`ConfigurationEngine` is exported as a class, not a singleton — the Verification Runtime Engine owns one
instance per runtime, matching `WidgetRegistry`.
