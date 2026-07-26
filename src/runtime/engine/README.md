# Verification Runtime Engine

Per `docs/04-Runtime/01-Verification-Runtime-Engine.md`. The orchestrator — coordinates the other engines,
owns the Runtime Context, delegates everything else.

## Current behavior ("Hello Runtime" pass)

`initialize()` runs: Configuration Engine → Theme Engine → Localization Engine → Widget Registry
(matching the documented Runtime Lifecycle's "Initialize Runtime → Load Configuration → Register Runtime
Components" steps). `getContext()` returns a read-only `RuntimeContext` snapshot (theme, language, active
configuration). `getScreen(screenId)` and `getWidgetRegistry()` are the two things a renderer needs; both
delegate rather than exposing the underlying engines directly.

Dependencies (`ConfigurationEngine`, `WidgetRegistry`, `ThemeEngine`, `LocalizationEngine`) are
constructor-injected with real defaults, so tests can substitute fakes without hidden coupling.

## Not implemented yet

Workflow execution, navigation orchestration, attachment/synchronization coordination, the Runtime Event
Bus, and the rest of `RuntimeContext` (Assignment, Candidate, Attachments, GPS, Form Data) — all
business-feature concerns explicitly out of scope for this pass. See `src/runtime/workflow` and
`src/runtime/validation` for the true skeletons standing in for two of those engines.
