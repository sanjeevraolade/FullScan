-- Real client exports show a case (one Case Ref Number, e.g. QUATH00000116) is
-- routinely made up of several independent verification components (present
-- address, permanent address, employment...), each progressing through its
-- own status/date trail. The previous schema assumed one address per case —
-- this migration splits that out into `case_components` and slims `cases`
-- down to the case-level identity fields shared by every component.

CREATE TABLE IF NOT EXISTS case_components (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id),
  -- dropdown_options(category='component_status').code — e.g. 'verified_clear', 'insuff_raised'.
  component_status TEXT NOT NULL DEFAULT 'new_component',
  -- dropdown_options(category='action_status').code, or NULL until the FE (or back office) has acted.
  action_status TEXT,
  bucket TEXT NOT NULL CHECK (bucket IN ('new', 'pending', 'beyond_tat', 'completed')),
  -- What kind of check this component is (e.g. 'Address', 'Employment', 'Education') — free text,
  -- distinct from address_type below (which address of possibly several, for an address check).
  verification_type TEXT NOT NULL DEFAULT 'Address',
  address_type TEXT CHECK (address_type IN ('present', 'permanent', 'previous')),
  residence_type TEXT CHECK (
    residence_type IN ('owned', 'rented', 'hostel', 'paying_guest', 'company_quarters', 'relative_owned')
  ),
  address TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  remarks TEXT NOT NULL DEFAULT '',
  additional_verification_instructions TEXT NOT NULL DEFAULT '',
  additional_verification_remarks TEXT NOT NULL DEFAULT '',
  assigned_field_executive_id TEXT REFERENCES field_executives(id),
  -- Free-text fallback for the source system's assignee when it doesn't map to a field_executives row.
  assigned_to_name TEXT NOT NULL DEFAULT '',
  tat_due_at TEXT NOT NULL DEFAULT '',
  target_latitude REAL NOT NULL DEFAULT 0,
  target_longitude REAL NOT NULL DEFAULT 0,
  gps_distance_meters INTEGER NOT NULL DEFAULT 0,
  gps_is_within_range INTEGER NOT NULL DEFAULT 0,
  masked_primary_phone TEXT NOT NULL DEFAULT '',
  masked_secondary_phone TEXT NOT NULL DEFAULT '',
  client_instructions TEXT NOT NULL DEFAULT '',
  field_executive_notes TEXT NOT NULL DEFAULT '',
  selected_verification_status TEXT,
  respondent_name TEXT,
  respondent_relation TEXT,
  received_date TEXT,
  action_updated_date TEXT,
  insuff_raised_date TEXT,
  insuff_cleared_date TEXT,
  addl_doc_requested_date TEXT,
  addl_doc_cleared_date TEXT,
  cost_approval_requested_date TEXT,
  cost_approved_date TEXT,
  cost_rejected_date TEXT,
  cost_currency TEXT,
  cost_amount REAL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_case_components_case_id ON case_components(case_id);
CREATE INDEX IF NOT EXISTS idx_case_components_bucket ON case_components(bucket);
CREATE INDEX IF NOT EXISTS idx_case_components_assigned_fe ON case_components(assigned_field_executive_id);

-- Fold every existing case's single implicit address/outcome into one component row,
-- so already-seeded cases (original 18 + the 500-row bulk set) keep working unchanged.
INSERT INTO case_components (
  id, case_id, component_status, action_status, bucket, verification_type, address_type, residence_type, address,
  assigned_field_executive_id, tat_due_at, target_latitude, target_longitude, gps_distance_meters,
  gps_is_within_range, masked_primary_phone, masked_secondary_phone, client_instructions,
  field_executive_notes, selected_verification_status, respondent_name, respondent_relation,
  created_at, updated_at
)
SELECT
  c.id || '-comp-1',
  c.id,
  CASE WHEN c.selected_verification_status IS NOT NULL THEN c.selected_verification_status ELSE 'new_component' END,
  CASE WHEN c.bucket = 'completed' THEN 'accepted' ELSE NULL END,
  c.bucket,
  c.verification_type,
  'present',
  'rented',
  c.address,
  c.assigned_field_executive_id,
  c.tat_due_at,
  c.target_latitude,
  c.target_longitude,
  c.gps_distance_meters,
  c.gps_is_within_range,
  c.masked_primary_phone,
  c.masked_secondary_phone,
  c.client_instructions,
  c.field_executive_notes,
  c.selected_verification_status,
  c.respondent_name,
  c.respondent_relation,
  c.created_at,
  c.updated_at
FROM cases c;

-- Case-level fields that now live on every component instead.
ALTER TABLE cases ADD COLUMN profile_status TEXT NOT NULL DEFAULT 'wip';
ALTER TABLE cases ADD COLUMN primary_contact_number TEXT NOT NULL DEFAULT '';
ALTER TABLE cases ADD COLUMN secondary_contact_number TEXT NOT NULL DEFAULT '';

UPDATE cases SET profile_status = CASE WHEN bucket = 'completed' THEN 'completed' ELSE 'wip' END;

DROP INDEX IF EXISTS idx_cases_bucket;
DROP INDEX IF EXISTS idx_cases_assigned_fe;

ALTER TABLE cases DROP COLUMN verification_type;
ALTER TABLE cases DROP COLUMN address;
ALTER TABLE cases DROP COLUMN bucket;
ALTER TABLE cases DROP COLUMN assigned_field_executive_id;
ALTER TABLE cases DROP COLUMN tat_due_at;
ALTER TABLE cases DROP COLUMN target_latitude;
ALTER TABLE cases DROP COLUMN target_longitude;
ALTER TABLE cases DROP COLUMN gps_distance_meters;
ALTER TABLE cases DROP COLUMN gps_is_within_range;
ALTER TABLE cases DROP COLUMN masked_primary_phone;
ALTER TABLE cases DROP COLUMN masked_secondary_phone;
ALTER TABLE cases DROP COLUMN client_instructions;
ALTER TABLE cases DROP COLUMN field_executive_notes;
ALTER TABLE cases DROP COLUMN selected_verification_status;
ALTER TABLE cases DROP COLUMN respondent_name;
ALTER TABLE cases DROP COLUMN respondent_relation;

-- New reference-data categories for the real component/action/profile status vocabulary
-- (see dropdown_options in 004_create_dropdown_options.sql) — codes only get stored on
-- rows; labels are fetched once via /reference-data like every other dropdown category.
-- SQLite can't ALTER a CHECK constraint in place, so the table is rebuilt to widen it.
CREATE TABLE dropdown_options_new (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (
    category IN (
      'verification_type_status', 'utv_option', 'insuff_option', 'photo_type',
      'component_status', 'action_status', 'profile_status'
    )
  ),
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (category, code)
);
INSERT INTO dropdown_options_new SELECT * FROM dropdown_options;
DROP TABLE dropdown_options;
ALTER TABLE dropdown_options_new RENAME TO dropdown_options;
CREATE INDEX IF NOT EXISTS idx_dropdown_options_category ON dropdown_options(category);

INSERT OR IGNORE INTO dropdown_options (id, category, code, label, sort_order) VALUES
  ('cs-new-component', 'component_status', 'new_component', 'New Component', 1),
  ('cs-additional-verification-requested', 'component_status', 'additional_verification_requested', 'Additional Verification Request Raised', 2),
  ('cs-component-accepted', 'component_status', 'component_accepted', 'Component Accepted', 3),
  ('cs-insuff-raised', 'component_status', 'insuff_raised', 'Insuff Raised', 4),
  ('cs-insuff-cleared', 'component_status', 'insuff_cleared', 'Insuff Cleared', 5),
  ('cs-addl-doc-requested', 'component_status', 'addl_doc_requested', 'Additional Doc Requested', 6),
  ('cs-addl-doc-cleared', 'component_status', 'addl_doc_cleared', 'Additional Doc Cleared', 7),
  ('cs-cost-approval-requested', 'component_status', 'cost_approval_requested', 'Cost Approval Requested', 8),
  ('cs-cost-approved', 'component_status', 'cost_approved', 'Cost Approved', 9),
  ('cs-cost-rejected', 'component_status', 'cost_rejected', 'Cost Rejected', 10),
  ('cs-verified-clear', 'component_status', 'verified_clear', 'Verified Clear', 11),
  ('cs-discrepancy', 'component_status', 'discrepancy', 'Discrepancy', 12),
  ('cs-utv', 'component_status', 'utv', 'UTV', 13),
  ('cs-component-stopped', 'component_status', 'component_stopped', 'Component Stopped', 14),

  ('as-uploaded', 'action_status', 'uploaded', 'Uploaded', 1),
  ('as-accepted', 'action_status', 'accepted', 'Accept/Approve', 2),
  ('as-stopped', 'action_status', 'stopped', 'Stop', 3),

  ('ps-bgv-profile-created', 'profile_status', 'bgv_profile_created', 'BGV Profile Created', 1),
  ('ps-wip', 'profile_status', 'wip', 'WIP', 2),
  ('ps-interim-report-generated', 'profile_status', 'interim_report_generated', 'Interim Report Generated', 3),
  ('ps-final-report-generated', 'profile_status', 'final_report_generated', 'Final Report Generated', 4),
  ('ps-completed', 'profile_status', 'completed', 'Completed', 5),
  ('ps-stop-profile', 'profile_status', 'stop_profile', 'Stop Profile', 6);
