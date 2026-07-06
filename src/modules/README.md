# Modules

Feature modules — each module is self-contained and owns its screens, state, services, models, validation, and tests.

## Structure

| Directory          | Feature Module            | Responsibility                          |
|--------------------|---------------------------|-----------------------------------------|
| `about/`           | About                     | App info, version, legal               |
| `assignments/`     | Assignments               | Case list, assignment details           |
| `attachments/`     | Attachments               | Evidence management UI                  |
| `authentication/`  | Authentication            | Login, logout, session management       |
| `dashboard/`       | Dashboard                 | Home screen, summary, quick actions     |
| `notifications/`   | Notifications             | Notification list, detail view          |
| `profile/`         | Profile                   | User profile management                 |
| `reports/`         | Reports                   | Verification reports, history           |
| `settings/`        | Settings                  | App preferences, theme, language        |
| `sync/`            | Synchronization           | Sync status UI, manual sync triggers    |
| `verification/`    | Verification              | Core verification workflow screens      |

## Rules

- Each module remains isolated — no direct imports between modules.
- Modules communicate through the store or event bus.
- Shared functionality belongs in `shared/` or `core/`.
- Business logic belongs in engines, not in module screens.
