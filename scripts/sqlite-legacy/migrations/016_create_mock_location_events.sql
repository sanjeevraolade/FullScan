-- Fraud evidence: every time the mobile app's location readiness check finds a
-- faked/mocked device position, it reports the detection here.
--
-- This is an append-only evidence log, not app state: rows are never updated or
-- deleted by the app, so an executive who switches a fake-GPS app off after
-- being blocked still leaves the detection behind. Everything the device could
-- observe at the moment of detection is stored, including the coordinates the
-- fake provider claimed — unlike ordinary location handling, the *fraudulent*
-- coordinates are exactly what an investigator needs.
--
-- `client_event_id` is generated on the device and is UNIQUE: the app retries a
-- report that failed while offline, and re-sending the same detection must not
-- create a second row.
CREATE TABLE IF NOT EXISTS mock_location_events (
  id TEXT PRIMARY KEY,
  client_event_id TEXT NOT NULL UNIQUE,
  field_executive_id TEXT NOT NULL,

  -- When and why the detection happened
  detection_stage TEXT NOT NULL,          -- post_login | app_resume | manual_recheck | photo_capture
  detected_at TEXT NOT NULL,              -- device clock, ISO-8601 (may be tampered with — see device_time_zone)
  reported_at TEXT NOT NULL DEFAULT (datetime('now')),   -- server clock when the report landed

  -- The fix the fake provider produced
  latitude REAL,
  longitude REAL,
  accuracy_meters REAL,
  fix_captured_at TEXT,
  fix_source TEXT,                        -- fresh | lastKnown

  -- What the executive was doing
  case_id TEXT,

  -- Handset identity, so a device can be traced across accounts
  device_id TEXT,
  device_name TEXT,
  device_model TEXT,
  device_brand TEXT,
  device_manufacturer TEXT,
  device_type TEXT,
  os_name TEXT,
  os_version TEXT,
  app_version TEXT,
  app_build_number TEXT,
  installer_package_name TEXT,
  is_emulator INTEGER NOT NULL DEFAULT 0,
  device_time_zone TEXT,

  -- Verbatim payload, so a field added by a newer app build is never lost
  raw_payload TEXT NOT NULL,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (field_executive_id) REFERENCES field_executives(id)
);

CREATE INDEX IF NOT EXISTS idx_mock_location_events_executive
  ON mock_location_events(field_executive_id, detected_at DESC);

-- A single handset used by several accounts is itself a fraud signal.
CREATE INDEX IF NOT EXISTS idx_mock_location_events_device
  ON mock_location_events(device_id);
