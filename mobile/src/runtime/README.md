# Runtime

Verification Runtime Engine (VRE) — the central orchestration component of the platform.

The Runtime layer is the heart of the FullScan platform. It executes configurable business workflows without requiring application code changes.

## Structure

| Directory          | Responsibility                                       |
|--------------------|------------------------------------------------------|
| `configuration/`   | Runtime configuration loading and management         |
| `engine/`          | Core VRE orchestration logic                         |
| `lifecycle/`       | Runtime lifecycle management (init, start, stop)     |
| `localization/`    | Runtime localization integration                     |
| `navigation/`      | Workflow-driven navigation coordination              |
| `plugins/`         | Plugin system for engine extensibility               |
| `registry/`        | Widget and engine registry management                |
| `renderer/`        | Dynamic screen/form rendering orchestration          |
| `serialization/`   | State serialization/deserialization                   |
| `validation/`      | Runtime validation coordination                      |
| `workflow/`        | Workflow state machine and execution                  |

## Rules

- The VRE orchestrates all other engines.
- Business state belongs to the Runtime Context.
- Widgets and screens do not own business state.
- Never bypass the VRE for business execution.
