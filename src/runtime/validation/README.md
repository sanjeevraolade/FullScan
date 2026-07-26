# Validation Engine

**Status: skeleton only**, per `extradocs/Prompt 4 — Create Runtime Skeleton.md`. Exposes `initialize()`
and `dispose()` and nothing else — no business logic.

Field/business/workflow/attachment/GPS/security validation (`docs/06-Contracts/05-Validation-Schema.md`)
is deferred: the sample screen rendered in this pass has no required fields to validate. Not wired into
`VerificationRuntimeEngine.initialize()` yet — implement this engine for real before any screen has
validation rules to enforce.
