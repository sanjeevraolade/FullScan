-- Super Admin user management — a super admin adds new admins from the portal by email.
--
-- Email becomes a sign-in identifier (new admins are created with username = email), so it
-- must be unique. COLLATE NOCASE because `Priya.Nair@…` and `priya.nair@…` are one mailbox.
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email COLLATE NOCASE);

-- Audit trail: which super admin created the account. NULL for migration-seeded admins.
ALTER TABLE admin_users ADD COLUMN created_by TEXT REFERENCES admin_users(id);
