-- Evidence files attached to a case component.
--
-- The mobile app's evidence rule is camera-only (GPS + timestamp + watermark). Rows
-- here come from the field executive **web** app, which uploads files from the
-- browser: `source` records that, so these can never be mistaken for camera
-- captures. The file bytes live on disk under UPLOAD_DIR; this table holds only
-- metadata and the SHA-256 of what was stored.
--
-- History, not state: rows are never updated or deleted by the API.

CREATE TABLE IF NOT EXISTS case_evidence (
  id TEXT PRIMARY KEY,
  component_id TEXT NOT NULL REFERENCES case_components(id),
  field_executive_id TEXT NOT NULL REFERENCES field_executives(id),
  source TEXT NOT NULL DEFAULT 'web_upload' CHECK (source IN ('web_upload')),

  original_name TEXT NOT NULL,
  -- Path relative to UPLOAD_DIR. Server-generated, never derived from the upload's name.
  storage_path TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  sha256 TEXT NOT NULL,

  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_case_evidence_component
  ON case_evidence(component_id, uploaded_at DESC);
