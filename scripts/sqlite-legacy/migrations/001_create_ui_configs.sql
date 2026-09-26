-- UI Configs table for server-driven UI
CREATE TABLE IF NOT EXISTS ui_configs (
  id TEXT PRIMARY KEY,
  screen_id TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  config_json TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for quick lookup by screen_id
CREATE INDEX IF NOT EXISTS idx_ui_configs_screen_id ON ui_configs(screen_id);

-- Seed default screen configs
INSERT OR IGNORE INTO ui_configs (id, screen_id, version, title, config_json) VALUES
(
  'cfg-assignment-list',
  'assignment-list',
  1,
  'Assignment List',
  json('[{"type":"card","fields":[{"key":"candidateName","label":"Candidate Name","type":"text","visible":true,"order":1},{"key":"address","label":"Address","type":"text","visible":true,"order":2},{"key":"status","label":"Status","type":"status","visible":true,"order":3},{"key":"assignedDate","label":"Assigned Date","type":"date","visible":true,"order":4}]}]')
),
(
  'cfg-assignment-detail',
  'assignment-detail',
  1,
  'Assignment Detail',
  json('[{"type":"header","fields":[{"key":"candidateName","label":"Candidate Name","type":"text","visible":true,"order":1},{"key":"status","label":"Status","type":"status","visible":true,"order":2}]},{"type":"detail","fields":[{"key":"address","label":"Address","type":"text","visible":true,"order":1},{"key":"location","label":"Location","type":"location","visible":true,"order":2},{"key":"assignedDate","label":"Assigned Date","type":"date","visible":true,"order":3},{"key":"employerName","label":"Employer","type":"text","visible":true,"order":4},{"key":"caseId","label":"Case ID","type":"text","visible":true,"order":5}]}]')
),
(
  'cfg-evidence-capture',
  'evidence-capture',
  1,
  'Evidence Capture',
  json('[{"type":"form","fields":[{"key":"photo","label":"Capture Photo","type":"image","visible":true,"order":1},{"key":"location","label":"Current Location","type":"location","visible":true,"order":2},{"key":"remarks","label":"Remarks","type":"text","visible":true,"order":3}]}]')
),
(
  'cfg-verification-report',
  'verification-report',
  1,
  'Verification Report',
  json('[{"type":"form","fields":[{"key":"candidatePresent","label":"Candidate Present","type":"status","visible":true,"order":1},{"key":"identityVerified","label":"Identity Verified","type":"status","visible":true,"order":2},{"key":"addressConfirmed","label":"Address Confirmed","type":"status","visible":true,"order":3},{"key":"remarks","label":"Observations","type":"text","visible":true,"order":4}]}]')
);
