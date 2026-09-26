# Workflow Engine

**Document ID:** WFE-001

**Document Version:** 1.0

**Status:** Approved

**Owner:** Solution Architect

**Reviewed By:** Technical Architect

**Last Updated:** 29-Jun-2026

---

# 1. Purpose

The Workflow Engine is responsible for executing configurable business workflows within the FullScan Mobile Platform.

It interprets workflow definitions received from backend configuration and coordinates the execution of business steps without requiring hardcoded application logic.

The Workflow Engine enables organizations to modify verification processes through configuration rather than application updates.

---

# 2. Scope

The Workflow Engine manages:

* Workflow Definitions
* Workflow Execution
* Workflow State
* Step Navigation
* Conditional Branching
* Workflow Validation
* Workflow Events
* Workflow Persistence
* Workflow Recovery
* Workflow Completion

---

# 3. References

| Document                    | Purpose                |
| --------------------------- | ---------------------- |
| Verification Runtime Engine | Runtime Orchestration  |
| Dynamic Form Engine         | Form Rendering         |
| Validation Engine           | Business Validation    |
| Configuration Engine        | Workflow Configuration |
| Functional Requirements     | Business Behaviour     |

---

# 4. Workflow Philosophy

A workflow is a configurable sequence of business activities.

The mobile application shall execute workflows defined by configuration instead of embedding business processes directly into application code.

Business workflows should evolve independently of application releases.

---

# 5. Responsibilities

The Workflow Engine is responsible for:

* Loading workflow definitions
* Starting workflows
* Executing workflow steps
* Evaluating transition conditions
* Managing workflow state
* Resuming interrupted workflows
* Cancelling workflows
* Completing workflows
* Publishing workflow events
* Persisting workflow progress

The Workflow Engine does **not** render user interfaces or execute platform services directly. Those responsibilities belong to collaborating runtime components.

---

# 6. Workflow Lifecycle

```text
Workflow Requested
        │
        ▼
Load Definition
        │
        ▼
Initialize Context
        │
        ▼
Execute Current Step
        │
        ▼
Evaluate Result
        │
        ▼
Next Step?
   │          │
   ▼          ▼
Yes         Complete
   │          │
   ▼          ▼
Execute    Archive
```

A workflow may also be paused, cancelled, or resumed.

---

# 7. Workflow States

Every workflow transitions through well-defined states.

```text
Created
   │
   ▼
Initialized
   │
   ▼
Running
   │
   ├── WaitingForInput
   ├── WaitingForLocation
   ├── WaitingForCamera
   ├── WaitingForSynchronization
   │
   ▼
Validating
   │
   ▼
Completed
```

Exceptional states:

* Paused
* Cancelled
* Failed
* Archived

---

# 8. Workflow Definition

A workflow is composed of ordered steps.

Example:

```text
Assignment Selected
        │
        ▼
Navigate to Candidate
        │
        ▼
Validate Location
        │
        ▼
Capture Candidate Photo
        │
        ▼
Capture Supporting Documents
        │
        ▼
Review Verification
        │
        ▼
Submit Verification
```

The engine shall execute the workflow according to the configured sequence.

---

# 9. Workflow Step Model

Each workflow consists of one or more steps.

Every step contains:

* Step Identifier
* Step Name
* Step Type
* Screen Reference
* Validation Rules
* Entry Conditions
* Exit Conditions
* Next Step
* Failure Behaviour
* Retry Policy

Steps are configuration-driven.

---

# 10. Workflow Types

The architecture supports multiple workflow categories.

Examples include:

* Candidate Verification
* Employment Verification
* Residence Verification
* Document Collection
* Identity Verification
* Custom Customer Workflow

New workflow types shall be introduced through configuration whenever possible.

---

# 11. Conditional Branching

The Workflow Engine supports conditional execution.

Examples:

* Candidate unavailable
* GPS validation failed
* Photo rejected
* Additional document required
* Employer-specific verification path

Example:

```text
Capture Photo
      │
      ▼
Photo Accepted?
   │          │
  Yes         No
   │          │
   ▼          ▼
Review     Retake Photo
```

Branching rules shall be defined through configuration.

---

# 12. Workflow Persistence

Workflow progress shall be persisted after every completed step.

Persisted information includes:

* Current Step
* Completed Steps
* Form Data
* Attachments
* Runtime Context
* Validation Results
* Timestamps

Persistence enables recovery after application termination or device restart.

---

# 13. Workflow Recovery

When the application restarts, the Workflow Engine shall:

1. Restore runtime context.
2. Restore workflow state.
3. Restore attachments.
4. Restore form data.
5. Resume execution from the last completed step.

No completed work should be lost.

---

# 14. Workflow Events

The Workflow Engine publishes lifecycle events.

Examples include:

* WorkflowStarted
* StepStarted
* StepCompleted
* StepSkipped
* ValidationFailed
* WorkflowPaused
* WorkflowResumed
* WorkflowCancelled
* WorkflowCompleted
* WorkflowFailed

Other runtime components subscribe to these events as needed.

---

# 15. Offline Behaviour

The Workflow Engine shall support offline execution.

Capabilities include:

* Execute configured workflows.
* Persist workflow progress locally.
* Continue evidence collection.
* Queue submission.
* Resume after restart.
* Synchronize when connectivity returns.

Offline execution shall not require modifications to workflow definitions.

---

# 16. Error Handling

The Workflow Engine shall gracefully handle:

* Invalid workflow configuration
* Missing workflow steps
* Circular transitions
* Validation failures
* Device capability failures
* Synchronization failures

Errors shall produce localized messages and maintain workflow integrity.

---

# 17. Extension Points

The Workflow Engine supports future enhancements including:

* Parallel workflow execution
* Nested workflows
* Reusable workflow fragments
* Dynamic step insertion
* AI-assisted workflow decisions
* Customer-specific workflow extensions
* Versioned workflows

Extensions shall not require modification of the core engine.

---

# 18. Workflow Configuration Example

```json
{
  "workflowId": "candidate-verification",
  "version": 1,
  "steps": [
    {
      "id": "location",
      "type": "locationValidation",
      "next": "candidatePhoto"
    },
    {
      "id": "candidatePhoto",
      "type": "camera",
      "next": "review"
    },
    {
      "id": "review",
      "type": "summary",
      "next": "submit"
    },
    {
      "id": "submit",
      "type": "submission"
    }
  ]
}
```

The Configuration Engine provides this definition to the Workflow Engine during runtime initialization.

---

# 19. Design Principles

The Workflow Engine follows these principles:

* Configuration before hardcoding
* Explicit workflow states
* Event-driven execution
* Deterministic transitions
* Recoverable execution
* Offline-first operation
* Single responsibility
* Extensible workflow definitions

---

## Workflow Categories

The Workflow Engine supports two categories of workflows:

### Application Workflows

Application workflows manage application lifecycle activities that are not part of business verification.

Examples:
- User Onboarding
- Permission Requests
- Welcome Tour
- What's New
- User Guide

### Business Workflows

Business workflows execute verification activities.

Examples:
- Candidate Verification
- Residence Verification
- Employment Verification

Login Successful
       │
       ▼
Runtime Engine
       │
       ▼
User Profile
       │
       ▼
First Login?
       │
   ┌───┴────┐
   │        │
  Yes      No
   │        │
   ▼        ▼
Application  Business
Workflow     Workflow
(Onboarding) (Dashboard)

---

# 20. Traceability

The Workflow Engine supports:

* Business Rules
* Functional Requirements
* Runtime Architecture
* Verification Runtime Engine

It transforms business workflow definitions into executable runtime behaviour.

---

# 21. Ownership

| Role                | Responsibility      |
| ------------------- | ------------------- |
| Solution Architect  | Workflow Design     |
| Technical Architect | Engine Architecture |
| Engineering Team    | Implementation      |
| QA Team             | Workflow Validation |

---

# 22. Guiding Philosophy

> The Workflow Engine is the business process executor of the FullScan Mobile Platform.

> It converts backend-defined workflow configurations into deterministic, recoverable, and configurable execution paths while remaining independent of presentation, storage, and platform-specific implementation details.

By separating workflow execution from user interface and business configuration, the Workflow Engine enables the platform to adapt to changing verification processes with minimal application changes while preserving consistency, traceability, and long-term maintainability.
