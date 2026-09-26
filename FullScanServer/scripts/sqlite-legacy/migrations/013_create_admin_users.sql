-- Admin users — back-office operators who sign in to the Admin Portal (/admin).
-- Kept in a separate table from `field_executives` on purpose: admins never carry
-- device binding, never own cases, and their tokens are scoped to admin routes only.
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);

-- Seed admins for local development / testing.
-- Every seeded account shares the password: Admin@123!
-- (bcrypt, cost 10 — one distinct salt per row).
INSERT OR IGNORE INTO admin_users (id, username, name, email, password_hash, role, is_active) VALUES
('admin-001', 'admin001', 'Ravi Menon', 'ravi.menon@fullscan.test', '$2a$10$UDK0XJ6Bd3vhv7ScA0iiwuZ.tG3zuUmiq73Vx5DnscZo7lKQlymua', 'super_admin', 1),
('admin-002', 'admin002', 'Priya Nair', 'priya.nair@fullscan.test', '$2a$10$tYhdHRvSUqncri.ppIBW1uuLsiH5vLJcf4LnsRAayBEI6NcsQaC4K', 'admin', 1),
('admin-003', 'admin003', 'Sunil Kulkarni', 'sunil.kulkarni@fullscan.test', '$2a$10$/OevGM0gYRYp22eClXROIuFBKDH8L14.bfvHSoS0cQk44CQOOubWK', 'admin', 1),
('admin-004', 'admin004', 'Deactivated Operator', 'inactive.admin@fullscan.test', '$2a$10$2pT6zHXZWSpqQhCIePi16ODvX88VtWtuLsNi2F7QLTsWmxh2JPaMu', 'admin', 0);
