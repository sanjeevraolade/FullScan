# Engines

Runtime engines that execute configurable business workflows.

These engines are the core differentiator of the FullScan platform. Business behaviour evolves through configuration rather than source code changes.

## Structure

| Directory        | Engine                    | Responsibility                           |
|------------------|---------------------------|------------------------------------------|
| `analytics/`     | Analytics Engine          | Telemetry, usage tracking, crash reports |
| `attachment/`    | Attachment Engine         | Evidence capture, metadata, watermark    |
| `configuration/` | Configuration Engine      | Config download, versioning, activation  |
| `geo/`           | Geo Engine                | GPS, geofencing, location validation     |
| `localization/`  | Localization Engine       | Language resolution, string lookup       |
| `rules/`         | Rules Engine              | Business rule evaluation                 |
| `security/`      | Security Engine           | Device registration, tamper detection    |
| `sync/`          | Synchronization Engine    | Offline queue, retry, upload scheduling  |
| `theme/`         | Theme Engine              | Colors, typography, spacing, variants    |
| `validation/`    | Validation Engine         | Configuration-driven field validation    |
| `workflow/`      | Workflow Engine           | Workflow execution, state transitions    |

## Rules

- Engines are orchestrated by the Verification Runtime Engine.
- Each engine is self-contained with a clear public API.
- Engines must never depend on UI or presentation layer.
- Engines communicate through the Runtime Context, not direct references.
- New engines follow the Open/Closed Principle.
