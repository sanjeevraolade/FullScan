# Workflow Engine

**Status: skeleton only**, per `extradocs/Prompt 4 — Create Runtime Skeleton.md`. Exposes `initialize()`
and `dispose()` and nothing else — no business logic.

Workflow execution, navigation decisions, and the state machine
(`Initialized → Running → Waiting → Completed → Failed → Cancelled`) described in
`docs/04-Runtime/01-Verification-Runtime-Engine.md` §9 are deferred: rendering a single static screen from
configuration (the "Hello Runtime" scope) needs no workflow orchestration. Not wired into
`VerificationRuntimeEngine.initialize()` yet — implement this engine for real before any screen needs
next/previous/conditional navigation.
