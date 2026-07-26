/**
 * Skeleton only, per extradocs/Prompt 4 — Create Runtime Skeleton.md:
 * initialize()/dispose() only, no business logic. Workflow execution,
 * navigation decisions and the state machine described in
 * docs/04-Runtime/01-Verification-Runtime-Engine.md §9 are out of scope for
 * the "Hello Runtime" pass (rendering a static screen needs no workflow).
 */
export interface IWorkflowEngine {
  initialize(): void;
  dispose(): void;
}
