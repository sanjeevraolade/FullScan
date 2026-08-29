-- The FullScanApp Case Details screen needs far more per-case data than the
-- list summary: assignment/SLA info, the target GPS check, masked contact
-- numbers, client SOP instructions, field notes, and (once set) the field
-- executive's in-progress verification outcome. Dropdown/option *values*
-- (verification status, UTV/Insufficient reasons, photo types) stay out of
-- this table on purpose — they already live in `dropdown_options` and are
-- fetched once via /reference-data, not duplicated per case.
ALTER TABLE cases ADD COLUMN father_or_spouse_name TEXT NOT NULL DEFAULT '';
ALTER TABLE cases ADD COLUMN employer_name TEXT NOT NULL DEFAULT '';
ALTER TABLE cases ADD COLUMN tat_due_at TEXT NOT NULL DEFAULT '';
ALTER TABLE cases ADD COLUMN target_latitude REAL NOT NULL DEFAULT 0;
ALTER TABLE cases ADD COLUMN target_longitude REAL NOT NULL DEFAULT 0;
ALTER TABLE cases ADD COLUMN gps_distance_meters INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cases ADD COLUMN gps_is_within_range INTEGER NOT NULL DEFAULT 1;
ALTER TABLE cases ADD COLUMN masked_primary_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE cases ADD COLUMN masked_secondary_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE cases ADD COLUMN client_instructions TEXT NOT NULL DEFAULT '';
ALTER TABLE cases ADD COLUMN field_executive_notes TEXT NOT NULL DEFAULT '';
-- Stores a dropdown_options(category='verification_type_status').code, or NULL when no outcome has been recorded yet.
ALTER TABLE cases ADD COLUMN selected_verification_status TEXT;
ALTER TABLE cases ADD COLUMN respondent_name TEXT;
ALTER TABLE cases ADD COLUMN respondent_relation TEXT;

UPDATE cases SET
  father_or_spouse_name = 'Mahesh Sharma', employer_name = 'Infoedge Technologies', tat_due_at = '2026-08-28 18:00:00',
  target_latitude = 17.4483, target_longitude = 78.3915, gps_distance_meters = 18, gps_is_within_range = 1,
  masked_primary_phone = '+91-8XXXX-00123', masked_secondary_phone = '+91-7XXXX-00123',
  client_instructions = 'Confirm residence continuity for the last 2 years. Capture a clear house-number photo.',
  field_executive_notes = 'Gated community — call the security desk from the main gate intercom.'
WHERE id = 'case-0123';

UPDATE cases SET
  father_or_spouse_name = 'Rajesh Verma', employer_name = 'Quess Corp', tat_due_at = '2026-08-27 18:00:00',
  target_latitude = 12.9698, target_longitude = 77.7500, gps_distance_meters = 22, gps_is_within_range = 1,
  masked_primary_phone = '+91-8XXXX-00118', masked_secondary_phone = '+91-7XXXX-00118',
  client_instructions = 'Standard address verification. Meet the candidate or an immediate family member only.',
  field_executive_notes = ''
WHERE id = 'case-0118';

UPDATE cases SET
  father_or_spouse_name = 'Om Prakash Gupta', employer_name = 'HCL Technologies', tat_due_at = '2026-08-29 18:00:00',
  target_latitude = 28.6139, target_longitude = 77.3910, gps_distance_meters = 31, gps_is_within_range = 1,
  masked_primary_phone = '+91-8XXXX-00112', masked_secondary_phone = '+91-7XXXX-00112',
  client_instructions = 'Verify against the ID proof carried. Do not accept a photocopy as sufficient.',
  field_executive_notes = 'Building has no lift — flat is on the 4th floor.'
WHERE id = 'case-0112';

UPDATE cases SET
  father_or_spouse_name = 'Ramesh Kumar', employer_name = 'Persistent Systems', tat_due_at = '2026-08-30 18:00:00',
  target_latitude = 18.5308, target_longitude = 73.8475, gps_distance_meters = 27, gps_is_within_range = 1,
  masked_primary_phone = '+91-8XXXX-00105', masked_secondary_phone = '+91-7XXXX-00105',
  client_instructions = 'Standard address verification.',
  field_executive_notes = ''
WHERE id = 'case-0105';

UPDATE cases SET
  father_or_spouse_name = 'Suresh Iyer', employer_name = 'Globex Corp', tat_due_at = '2026-08-31 18:00:00',
  target_latitude = 28.4949, target_longitude = 77.0890, gps_distance_meters = 24, gps_is_within_range = 1,
  masked_primary_phone = '+91-8XXXX-00131', masked_secondary_phone = '+91-7XXXX-00131',
  client_instructions = 'Employment verification — confirm designation, tenure and reason for leaving with HR.',
  field_executive_notes = 'HR contact available only between 11 AM and 4 PM.'
WHERE id = 'case-0131';

UPDATE cases SET
  father_or_spouse_name = 'Ashok Malhotra', employer_name = 'Tech Mahindra', tat_due_at = '2026-08-28 18:00:00',
  target_latitude = 22.5535, target_longitude = 88.3512, gps_distance_meters = 2350, gps_is_within_range = 0,
  masked_primary_phone = '+91-8XXXX-00134', masked_secondary_phone = '+91-7XXXX-00134',
  client_instructions = 'Standard address verification.',
  field_executive_notes = 'Candidate reported having moved recently — confirm current address before visiting again.'
WHERE id = 'case-0134';

UPDATE cases SET
  father_or_spouse_name = 'Ganesh Reddy', employer_name = 'St. Xavier College', tat_due_at = '2026-08-27 18:00:00',
  target_latitude = 13.0604, target_longitude = 80.2496, gps_distance_meters = 19, gps_is_within_range = 1,
  masked_primary_phone = '+91-8XXXX-00137', masked_secondary_phone = '+91-7XXXX-00137',
  client_instructions = 'Education verification — confirm degree, year of passing and enrollment number with the registrar.',
  field_executive_notes = ''
WHERE id = 'case-0137';

UPDATE cases SET
  father_or_spouse_name = 'Aslam Khan', employer_name = 'Wayne Enterprises', tat_due_at = '2026-08-29 18:00:00',
  target_latitude = 26.9139, target_longitude = 75.7887, gps_distance_meters = 15, gps_is_within_range = 1,
  masked_primary_phone = '+91-8XXXX-00140', masked_secondary_phone = '+91-7XXXX-00140',
  client_instructions = 'Confirm residence continuity for the last 2 years. Capture a clear house-number photo.',
  field_executive_notes = 'Preferred visiting hours: after 5 PM on weekdays.'
WHERE id = 'case-0140';

UPDATE cases SET
  father_or_spouse_name = 'Balan Nair', employer_name = 'Federal Bank', tat_due_at = '2026-08-25 18:00:00',
  target_latitude = 9.9658, target_longitude = 76.2421, gps_distance_meters = 12, gps_is_within_range = 1,
  masked_primary_phone = '+91-8XXXX-00098', masked_secondary_phone = '+91-7XXXX-00098',
  client_instructions = 'Standard address verification.',
  field_executive_notes = '', selected_verification_status = 'verified_clear',
  respondent_name = 'Latha Nair', respondent_relation = 'Mother'
WHERE id = 'case-0098';

UPDATE cases SET
  father_or_spouse_name = 'Vinod Mehta', employer_name = 'XYZ Solutions', tat_due_at = '2026-08-24 18:00:00',
  target_latitude = 12.9784, target_longitude = 77.6408, gps_distance_meters = 16, gps_is_within_range = 1,
  masked_primary_phone = '+91-8XXXX-00091', masked_secondary_phone = '+91-7XXXX-00091',
  client_instructions = 'Standard address verification.',
  field_executive_notes = 'Candidate confirmed to have shifted — awaiting UTV confirmation.',
  selected_verification_status = 'utv'
WHERE id = 'case-0091';

UPDATE cases SET
  father_or_spouse_name = 'Anil Bansal', employer_name = 'Acme Corp', tat_due_at = '2026-08-23 18:00:00',
  target_latitude = 22.5535, target_longitude = 88.3629, gps_distance_meters = 21, gps_is_within_range = 1,
  masked_primary_phone = '+91-8XXXX-00085', masked_secondary_phone = '+91-7XXXX-00085',
  client_instructions = 'Employment verification — confirm designation, tenure and reason for leaving with HR.',
  field_executive_notes = 'HR could not produce the relieving letter on file.',
  selected_verification_status = 'insufficient'
WHERE id = 'case-0085';

UPDATE cases SET
  father_or_spouse_name = 'Krishna Pillai', employer_name = 'MNO Industries', tat_due_at = '2026-08-22 18:00:00',
  target_latitude = 17.4126, target_longitude = 78.4482, gps_distance_meters = 29, gps_is_within_range = 1,
  masked_primary_phone = '+91-8XXXX-00079', masked_secondary_phone = '+91-7XXXX-00079',
  client_instructions = 'Standard address verification.',
  field_executive_notes = ''
WHERE id = 'case-0079';

UPDATE cases SET
  father_or_spouse_name = 'Prakash Joshi', employer_name = 'Globex Corp', tat_due_at = '2026-08-21 18:00:00',
  target_latitude = 18.5308, target_longitude = 73.8446, gps_distance_meters = 2100, gps_is_within_range = 0,
  masked_primary_phone = '+91-8XXXX-00072', masked_secondary_phone = '+91-7XXXX-00072',
  client_instructions = 'Standard address verification.',
  field_executive_notes = 'GPS mismatch on first visit — revisit and confirm the exact building.'
WHERE id = 'case-0072';

UPDATE cases SET
  father_or_spouse_name = 'Mohan Kapoor', employer_name = 'Initech', tat_due_at = '2026-08-15 18:00:00',
  target_latitude = 28.7096, target_longitude = 77.1927, gps_distance_meters = 25, gps_is_within_range = 1,
  masked_primary_phone = '+91-8XXXX-00050', masked_secondary_phone = '+91-7XXXX-00050',
  client_instructions = 'Standard address verification.',
  field_executive_notes = 'This case is past its TAT — prioritize today.'
WHERE id = 'case-0050';

UPDATE cases SET
  father_or_spouse_name = 'Bimal Das', employer_name = 'Umbrella Ltd', tat_due_at = '2026-08-14 18:00:00',
  target_latitude = 22.5800, target_longitude = 88.4100, gps_distance_meters = 20, gps_is_within_range = 1,
  masked_primary_phone = '+91-8XXXX-00044', masked_secondary_phone = '+91-7XXXX-00044',
  client_instructions = 'Standard address verification.',
  field_executive_notes = 'This case is past its TAT — prioritize today.'
WHERE id = 'case-0044';

UPDATE cases SET
  father_or_spouse_name = 'Anwar Ali', employer_name = 'Wayne Enterprises', tat_due_at = '2026-08-13 18:00:00',
  target_latitude = 26.9200, target_longitude = 75.8100, gps_distance_meters = 33, gps_is_within_range = 1,
  masked_primary_phone = '+91-8XXXX-00038', masked_secondary_phone = '+91-7XXXX-00038',
  client_instructions = 'Employment verification — confirm designation, tenure and reason for leaving with HR.',
  field_executive_notes = 'This case is past its TAT — prioritize today.'
WHERE id = 'case-0038';

UPDATE cases SET
  father_or_spouse_name = 'Srinivas Rao', employer_name = 'ABC Pvt Ltd', tat_due_at = '2026-08-05 18:00:00',
  target_latitude = 17.4310, target_longitude = 78.4076, gps_distance_meters = 14, gps_is_within_range = 1,
  masked_primary_phone = '+91-8XXXX-00020', masked_secondary_phone = '+91-7XXXX-00020',
  client_instructions = 'Standard address verification.',
  field_executive_notes = '', selected_verification_status = 'verified_clear',
  respondent_name = 'Kiran Rao', respondent_relation = 'Self'
WHERE id = 'case-0020';

UPDATE cases SET
  father_or_spouse_name = 'Ganesh Shetty', employer_name = 'XYZ Solutions', tat_due_at = '2026-08-04 18:00:00',
  target_latitude = 12.9352, target_longitude = 77.6245, gps_distance_meters = 11, gps_is_within_range = 1,
  masked_primary_phone = '+91-8XXXX-00015', masked_secondary_phone = '+91-7XXXX-00015',
  client_instructions = 'Standard address verification.',
  field_executive_notes = '', selected_verification_status = 'verified_clear',
  respondent_name = 'Pooja Shetty', respondent_relation = 'Self'
WHERE id = 'case-0015';
