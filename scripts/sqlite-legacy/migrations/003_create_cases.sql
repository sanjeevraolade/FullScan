-- Cases assigned to field executives, grouped into workflow buckets:
-- new -> pending -> beyond_tat -> completed (see product spec workflow).
CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  case_ref TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  candidate_name TEXT NOT NULL,
  verification_type TEXT NOT NULL,
  address TEXT NOT NULL,
  bucket TEXT NOT NULL CHECK (bucket IN ('new', 'pending', 'beyond_tat', 'completed')),
  assigned_field_executive_id TEXT NOT NULL REFERENCES field_executives(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cases_bucket ON cases(bucket);
CREATE INDEX IF NOT EXISTS idx_cases_assigned_fe ON cases(assigned_field_executive_id);

INSERT OR IGNORE INTO cases
  (id, case_ref, client_name, candidate_name, verification_type, address, bucket, assigned_field_executive_id)
VALUES
  ('case-0123', 'FS-2026-00123', 'ABC Pvt Ltd', 'Rahul Sharma', 'Address', 'Flat 204, Green Heights, Madhapur, Hyderabad', 'new', 'fe-001'),
  ('case-0118', 'FS-2026-00118', 'XYZ Solutions', 'Priya Verma', 'Address', '5th Floor, Tech Park, Whitefield, Bangalore', 'new', 'fe-001'),
  ('case-0112', 'FS-2026-00112', 'Acme Corp', 'Vikas Gupta', 'Address', '12B, Sector 62, Noida', 'new', 'fe-001'),
  ('case-0105', 'FS-2026-00105', 'MNO Industries', 'Sanjay Kumar', 'Address', '45/A, MG Road, Pune', 'new', 'fe-001'),
  ('case-0131', 'FS-2026-00131', 'Globex Corp', 'Ananya Iyer', 'Employment', 'Plot 9, Cyber City, Gurugram', 'new', 'fe-001'),
  ('case-0134', 'FS-2026-00134', 'Initech', 'Karan Malhotra', 'Address', '21, Park Street, Kolkata', 'new', 'fe-001'),
  ('case-0137', 'FS-2026-00137', 'Umbrella Ltd', 'Neha Reddy', 'Education', '8, Anna Salai, Chennai', 'new', 'fe-001'),
  ('case-0140', 'FS-2026-00140', 'Wayne Enterprises', 'Farhan Khan', 'Address', '14, Civil Lines, Jaipur', 'new', 'fe-001'),

  ('case-0098', 'FS-2026-00098', 'ABC Pvt Ltd', 'Divya Nair', 'Address', '3, Marine Drive, Kochi', 'pending', 'fe-001'),
  ('case-0091', 'FS-2026-00091', 'XYZ Solutions', 'Arjun Mehta', 'Address', '77, Residency Road, Bengaluru', 'pending', 'fe-001'),
  ('case-0085', 'FS-2026-00085', 'Acme Corp', 'Ritika Bansal', 'Employment', '22, Camac Street, Kolkata', 'pending', 'fe-001'),
  ('case-0079', 'FS-2026-00079', 'MNO Industries', 'Suresh Pillai', 'Address', '6, Banjara Hills, Hyderabad', 'pending', 'fe-001'),
  ('case-0072', 'FS-2026-00072', 'Globex Corp', 'Meera Joshi', 'Address', '19, FC Road, Pune', 'pending', 'fe-001'),

  ('case-0050', 'FS-2026-00050', 'Initech', 'Rohan Kapoor', 'Address', '5, Model Town, Delhi', 'beyond_tat', 'fe-001'),
  ('case-0044', 'FS-2026-00044', 'Umbrella Ltd', 'Sneha Das', 'Address', '31, Salt Lake, Kolkata', 'beyond_tat', 'fe-001'),
  ('case-0038', 'FS-2026-00038', 'Wayne Enterprises', 'Imran Ali', 'Employment', '2, MI Road, Jaipur', 'beyond_tat', 'fe-001'),

  ('case-0020', 'FS-2026-00020', 'ABC Pvt Ltd', 'Kiran Rao', 'Address', '10, Jubilee Hills, Hyderabad', 'completed', 'fe-001'),
  ('case-0015', 'FS-2026-00015', 'XYZ Solutions', 'Pooja Shetty', 'Address', '45, Koramangala, Bengaluru', 'completed', 'fe-001');
