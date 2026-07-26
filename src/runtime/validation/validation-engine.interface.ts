/**
 * Skeleton only, per extradocs/Prompt 4 — Create Runtime Skeleton.md:
 * initialize()/dispose() only, no business logic. Field/business/workflow
 * validation (docs/06-Contracts/05-Validation-Schema.md) is out of scope for
 * the "Hello Runtime" pass — the sample screen has no required fields to
 * validate.
 */
export interface IValidationEngine {
  initialize(): void;
  dispose(): void;
}
