---
applyTo: "**/db/**"
---

# Database Instructions

## SQLite Configuration
- Use `better-sqlite3` (server) and `react-native-sqlite-storage` (mobile)
- Enable foreign keys: `PRAGMA foreign_keys = ON`
- Enable WAL mode: `PRAGMA journal_mode = WAL`

## Migrations
- Numbered sequentially: `001_create_users.sql`, `002_create_assignments.sql`
- Located in `src/db/migrations/`
- Each migration is idempotent (use `IF NOT EXISTS`)
- Never modify existing migrations — create new ones for changes

## Query Patterns
- Always use parameterized queries — never string interpolation
- All DB access through DAO (Data Access Object) files: `src/db/<resource>.dao.ts`
- No raw queries in controllers or services
- Use transactions for multi-table operations

## Schema Conventions
- Primary keys: `id TEXT` (UUID) or `id INTEGER PRIMARY KEY AUTOINCREMENT`
- Timestamps: `created_at TEXT DEFAULT (datetime('now'))`, `updated_at TEXT`
- Soft delete: `deleted_at TEXT` (nullable) instead of hard delete
- Boolean columns: `INTEGER` (0/1) with CHECK constraint
- Foreign keys with `ON DELETE CASCADE` or `ON DELETE SET NULL` as appropriate

## Mobile Offline DB
- Mirror essential server tables locally for offline access
- `sync_queue` table tracks pending uploads: `{ id, type, payload, status, retry_count, created_at }`
- Status values: `pending`, `syncing`, `synced`, `failed`
- Process queue FIFO when connectivity restored
