# Widget Registry

Per `docs/04-Runtime/04-Widget-Registry.md`. Widgets register themselves — the registry never imports a
concrete widget. `src/widgets/index.ts` is the one place that knows about both the registry and concrete
widgets, and is expected to call `registry.register(type, factory)` for each built-in widget during
bootstrap.

## API

- `initialize()` / `dispose()` — clear all registrations.
- `register(type, factory)` — `WidgetFactory` is a zero-arg function returning a `WidgetComponent`.
- `resolve(type)` — returns the resolved component, or `undefined` (and logs a warning) if the type was
  never registered. The Dynamic Form Engine renderer is responsible for the graceful fallback UI per
  `docs/04-Runtime/03-Dynamic-Form-Engine.md`'s "degrade, don't fail the screen" rule — this registry only
  reports the miss.
- `isRegistered(type)` — existence check.

`WidgetRegistry` is exported as a class, not a singleton — the Verification Runtime Engine owns one
instance per runtime, and tests instantiate their own for isolation.
