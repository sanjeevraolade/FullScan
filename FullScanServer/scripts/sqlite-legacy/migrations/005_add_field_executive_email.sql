-- The drawer menu (FullScanApp) shows the logged-in field executive's email
-- alongside their name, so the profile row needs one.
ALTER TABLE field_executives ADD COLUMN email TEXT NOT NULL DEFAULT '';

UPDATE field_executives SET email = 'amit.verma@fullscan.example' WHERE id = 'fe-001';
