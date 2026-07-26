# Dynamic Form Engine (Renderer)

Per `docs/04-Runtime/03-Dynamic-Form-Engine.md`. Turns a `ScreenDefinition` into a rendered screen:
`ScreenRenderer` → `SectionRenderer` → `Widget Registry` → resolved widget component.

## Deviation from the Interface/Implementation/Types/Constants/Tests/README template

Unlike the other engines in this pass, the Dynamic Form Engine's actual behavior is two React
components (`ScreenRenderer`, `SectionRenderer`), not a class with imperative state — there is nothing
meaningful for an `initialize()`/`dispose()` lifecycle to do (screens render on demand from whatever
registry/config they're given). So this folder has `dynamic-form-engine.types.ts` (the component prop
contracts) instead of a `.interface.ts` + class pair.

## Current behavior

- Sections and widgets are sorted by `order` (per Screen Schema §9, "widget order shall be
  deterministic") and filtered by `visible`.
- Only `vertical` and `scroll` root layouts are implemented; any other declared layout logs a warning and
  falls back to `vertical` rather than failing the whole screen.
- An unresolved widget type is skipped (the Widget Registry already logs the miss) — one bad widget never
  takes down the rest of the screen.
- `screen.actions` (submit/cancel/...) render as an `ActionBar` below the sections. The Screen Schema only
  gives actions a verb, not a label key, so labels resolve by convention: `${screenId}.actions.${action}`.
  `ScreenRenderer` accepts an optional `onAction` callback — pressing a button calls it (or just logs, if
  none is given); there is no Workflow Engine yet to actually act on it.
- `grid`/`card`/`accordion`/`tabs` layouts, validation binding, and localization/theme binding beyond what
  Gluestack + `react-i18next` already provide per-widget are not implemented yet.

The end-to-end proof — Configuration Engine → Verification Runtime Engine → Widget Registry →
`ScreenRenderer` → `TextWidget` — lives in `dynamic-form-engine.test.tsx`.
