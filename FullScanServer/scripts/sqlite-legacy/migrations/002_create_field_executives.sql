-- Field executives (mocked — real auth/device-binding not implemented yet)
CREATE TABLE IF NOT EXISTS field_executives (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO field_executives (id, name, role) VALUES
('fe-001', 'Amit Verma', 'Field Agent');
