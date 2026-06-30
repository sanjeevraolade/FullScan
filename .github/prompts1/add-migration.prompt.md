---
description: "Generate a numbered SQLite migration file for mobile or server database"
---

# Add Migration

Create a new SQLite migration file.

## Input
- **Package**: ${input:package:Which package? (mobile/server)}
- **Description**: ${input:description:What does this migration do? (e.g., add status column to assignments)}

## Generate

1. Determine the next migration number by checking existing files in `${package}/src/db/migrations/`
2. Create `${package}/src/db/migrations/<next_number>_<description>.sql` with:
   - `IF NOT EXISTS` / `IF EXISTS` guards for idempotency
   - Proper column types (TEXT, INTEGER, REAL, BLOB)
   - Foreign key constraints where applicable
   - Default values for new columns on existing tables
   - Index creation for frequently queried columns

## Conventions
- File naming: `001_create_users.sql`, `002_add_status_to_assignments.sql`
- Use `ALTER TABLE` for adding columns to existing tables
- Never modify existing migrations — always create new ones
- Include both UP statements (migrations run forward only in SQLite)
- Add comments explaining the purpose of the migration
