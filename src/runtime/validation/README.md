# Validation Engine

**Status: partial.** Only the `required` validation type from `docs/06-Contracts/05-Validation-Schema.md`
is implemented — enough to stop the Login screen's submit action when a required field is empty. Pattern,
Range, GPS, GeoFence, MockLocation, Attachment, and BusinessRule types are not implemented; there's nothing
yet (no camera/GPS widgets, no business workflow) for them to validate against.

## API

- `initialize()` / `dispose()` — lifecycle hooks; `validateScreen` is a pure function of its arguments, so
  neither does real work yet.
- `validateScreen(screen, values)` — iterates every widget across every section; for each `required`
  widget whose current value (looked up by `widgetId`, not yet the configured `binding` path — see
  `src/runtime/renderer/form-state.ts`) is empty, adds `widgetId -> 'validation.required'` to the returned
  error map.

`ValidationEngine` is exported as a class (not a singleton), matching `WidgetRegistry`/`ConfigurationEngine`
— `src/runtime/renderer/screen-renderer.tsx` owns a module-level instance since `validateScreen` has no
per-runtime state to isolate. Not orchestrated by `VerificationRuntimeEngine.initialize()` — the renderer
calls it directly on submit.
