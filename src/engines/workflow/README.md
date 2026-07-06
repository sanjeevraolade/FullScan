# Workflow Engine

Controls workflow execution, state transitions, and navigation decisions.

## Responsibility

- Application workflow execution (onboarding, permissions, etc.)
- Business workflow execution (verification activities)
- Workflow state machine
- Step transitions
- Navigation decisions based on workflow state
- Workflow persistence for resume

## Workflow Categories

### Application Workflows
- Welcome, Onboarding, Permission Requests, User Guide, What's New

### Business Workflows
- Candidate Verification, Residence Verification, Employment Verification

## Rules

- Screens must never decide workflow progression.
- Navigation reacts to workflow state rather than controlling it.
- Workflow definitions come from backend configuration.
