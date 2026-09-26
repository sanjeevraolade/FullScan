-- Adds username/password credentials to field_executives so a real login
-- endpoint can validate them, replacing the single hardcoded mock session.
ALTER TABLE field_executives ADD COLUMN username TEXT;
ALTER TABLE field_executives ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';

UPDATE field_executives SET username = 'fe001', password_hash = '$2a$10$jF92zQ2OtaZSlo1CuqNC8uQty0dbktbwRei95d/NRRpOWjrzkWmDi' WHERE id = 'fe-001';

CREATE UNIQUE INDEX IF NOT EXISTS idx_field_executives_username ON field_executives(username);
