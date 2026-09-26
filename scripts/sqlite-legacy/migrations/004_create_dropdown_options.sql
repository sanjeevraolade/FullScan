-- Server-managed dropdown/option data for the verification workflow.
-- Fetched by the app in one batch right after login (see product spec) so
-- the backend team can change option values without an app release. The
-- app renders these into fixed, hand-coded forms — this table holds option
-- *data* only, never screen layout.
CREATE TABLE IF NOT EXISTS dropdown_options (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (
    category IN ('verification_type_status', 'utv_option', 'insuff_option', 'photo_type')
  ),
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (category, code)
);

CREATE INDEX IF NOT EXISTS idx_dropdown_options_category ON dropdown_options(category);

INSERT OR IGNORE INTO dropdown_options (id, category, code, label, sort_order) VALUES
  ('vts-verified-clear', 'verification_type_status', 'verified_clear', 'Verified Clear', 1),
  ('vts-utv', 'verification_type_status', 'utv', 'UTV', 2),
  ('vts-insufficient', 'verification_type_status', 'insufficient', 'Insufficient', 3),

  ('utv-shifted', 'utv_option', 'shifted', 'Shifted', 1),
  ('utv-resigned', 'utv_option', 'resigned', 'Resigned', 2),
  ('utv-not-joining', 'utv_option', 'not_joining', 'Not Joining', 3),
  ('utv-neighbours-not-supporting', 'utv_option', 'neighbours_not_supporting', 'Neighbours/Family Not Supporting', 4),

  ('insuff-candidate-not-responding', 'insuff_option', 'candidate_not_responding', 'Candidate Not Responding', 1),
  ('insuff-incorrect-address', 'insuff_option', 'incorrect_address', 'Incorrect Address', 2),
  ('insuff-not-guiding', 'insuff_option', 'not_guiding', 'Not Guiding', 3),

  ('photo-house-1', 'photo_type', 'house_photo_1', 'House Photo 1', 1),
  ('photo-house-2', 'photo_type', 'house_photo_2', 'House Photo 2', 2),
  ('photo-aadhar', 'photo_type', 'aadhar', 'Aadhar', 3),
  ('photo-pan', 'photo_type', 'pan', 'PAN', 4),
  ('photo-id-proof', 'photo_type', 'id_proof', 'ID Proof', 5);
