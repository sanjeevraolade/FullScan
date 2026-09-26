-- Device change requests and device history.
--
-- A field executive's account is bound to one handset (`field_executives.device_id`,
-- migration 012). To move to another phone they request a device change from the
-- web portal; an admin approves or rejects it. Approval releases the binding, so
-- the next mobile login (on any phone, the old one included) binds again.
--
-- Both tables are history, not state: rows are never deleted. A request is only
-- ever moved from `pending` to `approved`/`rejected` once, and a device binding is
-- only ever closed (`released_at`), never removed or reopened.

CREATE TABLE IF NOT EXISTS device_change_requests (
  id TEXT PRIMARY KEY,
  field_executive_id TEXT NOT NULL REFERENCES field_executives(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT,

  -- Snapshot of the binding when the request was made — the phone being given up.
  device_id TEXT NOT NULL,
  device_details TEXT,

  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT,
  decided_by TEXT REFERENCES admin_users(id),
  decision_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_device_change_requests_executive
  ON device_change_requests(field_executive_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_device_change_requests_status
  ON device_change_requests(status, requested_at DESC);

-- At most one open request per executive, enforced by the database as well as the service.
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_change_requests_one_pending
  ON device_change_requests(field_executive_id) WHERE status = 'pending';

-- One row per period a handset was bound to an account.
CREATE TABLE IF NOT EXISTS field_executive_devices (
  id TEXT PRIMARY KEY,
  field_executive_id TEXT NOT NULL REFERENCES field_executives(id),
  device_id TEXT NOT NULL,
  device_details TEXT,

  -- First mobile login on this handset. NULL for bindings that predate this table.
  bound_at TEXT,
  -- Most recent mobile login on this handset while it was bound.
  last_login_at TEXT,

  released_at TEXT,
  release_reason TEXT CHECK (
    release_reason IS NULL OR release_reason IN ('device_change_approved', 'binding_replaced')
  ),
  released_by_request_id TEXT REFERENCES device_change_requests(id),

  -- The approved request this binding followed — "the new device" for that request.
  bound_after_request_id TEXT REFERENCES device_change_requests(id),

  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_field_executive_devices_executive
  ON field_executive_devices(field_executive_id, created_at DESC);

-- An account has at most one current binding.
CREATE UNIQUE INDEX IF NOT EXISTS idx_field_executive_devices_one_open
  ON field_executive_devices(field_executive_id) WHERE released_at IS NULL;

-- An approved request is followed by at most one new binding.
CREATE UNIQUE INDEX IF NOT EXISTS idx_field_executive_devices_after_request
  ON field_executive_devices(bound_after_request_id) WHERE bound_after_request_id IS NOT NULL;

-- Bindings that already exist become the first history row. When they started is unknown.
INSERT OR IGNORE INTO field_executive_devices (id, field_executive_id, device_id, device_details)
SELECT 'device-binding-legacy-' || id, id, device_id, device_details
FROM field_executives
WHERE device_id IS NOT NULL;

-- Request limit: at most `device_change_max_requests` requests in any rolling
-- `device_change_window_days`-day window. Every request counts, whatever its outcome.
INSERT OR IGNORE INTO mobile_app_settings
  (setting_key, setting_value, value_type, label, description, category, options_json, min_value, max_value, sort_order)
VALUES
  ('device_change_max_requests', '2', 'number',
   'Device change requests allowed',
   'How many device change requests a field executive can submit within the request window. Every request counts, whether it is approved, rejected or still pending.',
   'security', NULL, 1, 20, 50),
  ('device_change_window_days', '30', 'number',
   'Device change request window (days)',
   'Length of the rolling window, in days, that the device change request limit applies to.',
   'security', NULL, 1, 365, 60);
