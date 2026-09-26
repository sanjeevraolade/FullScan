#!/usr/bin/env node
/**
 * Generator: emits a small set of synthetic cases (one component each) with realistic,
 * moderately long text in every free-text field — candidate name up to 50 characters,
 * address up to 150, notes up to 200 — so the mobile app's list/detail layouts can be
 * checked against believable content rather than short placeholders.
 *
 * Text is never cut mid-word or mid-sentence: names are filled word by word, remarks and
 * instructions sentence by sentence (from a pool of varied-length sentences, so they land
 * close to the limit), and addresses/locations are whole hand-written values checked
 * against their limit. Coded columns (bucket, statuses, address/residence type) and dates
 * keep valid values — CHECK constraints and dropdown codes reject free text there. Masked
 * phones stay real-looking numbers. Target coordinates are placed around TEST_CENTRE rather
 * than geocoded from the address, so the cases sit near whoever is testing.
 *
 * Buckets are split evenly: New cases are unassigned (New is a random draw from the whole
 * pool); Pending / Beyond TAT / Completed cases are assigned to fe-001.
 *
 * The generated SQL first deletes every `case-uitest-*` case and `comp-uitest-*` component,
 * then inserts the set fresh — re-running resets these test cases (bucket, status and
 * assignment included) and removes any left over from an earlier, larger run.
 *
 * Usage: node scripts/sqlite-legacy/generate-ui-test-case-seed.mjs <output-sql-path>
 */
import fs from 'fs';

const [, , outPath] = process.argv;
if (!outPath) {
  console.error('Usage: node scripts/sqlite-legacy/generate-ui-test-case-seed.mjs <output-sql-path>');
  process.exit(1);
}

const RECORD_COUNT = 12;
const ASSIGNED_FIELD_EXECUTIVE_ID = 'fe-001';
const BUCKETS = ['new', 'pending', 'beyond_tat', 'completed'];

const MAX_LENGTH = {
  candidateName: 50,
  fatherOrSpouseName: 50,
  employerName: 60,
  clientName: 60,
  address: 150,
  location: 60,
  remarks: 150,
  additionalVerificationInstructions: 150,
  additionalVerificationRemarks: 150,
  clientInstructions: 200,
  fieldExecutiveNotes: 200,
  assignedToName: 40,
  respondentName: 50,
  respondentRelation: 30,
};

const PERSON_WORDS = [
  'Venkata', 'Sai', 'Lakshmi', 'Narasimha', 'Rao', 'Subrahmanya', 'Devi', 'Ramakrishna',
  'Kumar', 'Bhagyalakshmi', 'Reddy', 'Chowdary', 'Kondapalli', 'Naidu', 'Yarlagadda', 'Prasad',
];
const ORGANISATION_WORDS = [
  'Sri', 'Venkateswara', 'Infrastructure', 'Technology', 'Global', 'Services', 'Consolidated',
  'Financial', 'Solutions', 'Private', 'Limited', 'India', 'Holdings', 'Enterprises',
];
const ADDRESSES = [
  'Flat No. 1204, Tower 7B, Mythri Square Apartments, Beside Miyapur Metro Station, Mythri Nagar, Miyapur, Hyderabad, Telangana 500049',
  'Plot No. 45/A, Survey No. 118/2, Near Chanda Nagar Railway Station, Pragathi Nagar, Chanda Nagar, Hyderabad, Telangana 500050',
  'H.No. 8-3-231/B/12, Floor 1, Sri Krishna Nagar, Near Nizampet Cross Roads, JP Nagar, Nizampet, Hyderabad, Telangana 500090',
  'Door No. 2-48/7, Second Floor, Sai Residency, Near Hafeezpet Railway Station, Kondapur Road, Hafeezpet, Hyderabad, Telangana 500049',
];
const LOCATIONS = [
  'Miyapur, Near Metro Station, Hyderabad, Telangana',
  'Chanda Nagar, Near Railway Station, Hyderabad, Telangana',
  'Nizampet, Near Cross Roads, Hyderabad, Telangana',
  'Hafeezpet, Near Kondapur Road, Hyderabad, Telangana',
];
const NOTE_SENTENCES = [
  'Candidate confirmed continuous residence at this address since early childhood.',
  'Neighbour verified identity from the photograph.',
  'Call the candidate thirty minutes before arriving.',
  'Gated community security desk issues visitor passes.',
  'Capture the house number plate and main entrance separately.',
  'If the house is locked, verify with two independent neighbours.',
  'Record respondent name and relation.',
  'Visit only between 10 AM and 6 PM.',
  'Candidate lives with parents and two younger siblings.',
  'Street name board must be visible in one photograph.',
  'Landmark is the Mythri Nagar community hall.',
  'Do not accept photocopies of address proof.',
  'Owner confirmed the rental agreement.',
  'Ask for the electricity bill.',
];
const RELATIONS = ['Paternal uncle living nearby', 'Neighbour for over 20 years', 'Elder brother of the candidate', 'Landlord of the rented portion'];

const COMPONENT_STATUSES_IN_PROGRESS = ['component_accepted', 'insuff_raised', 'cost_approval_requested', 'addl_doc_requested'];
const ADDRESS_TYPES = ['present', 'permanent', 'previous'];
const RESIDENCE_TYPES = ['owned', 'rented', 'hostel', 'paying_guest', 'company_quarters', 'relative_owned'];
/** The tester's own position — seeded cases sit within MAX_DISTANCE_KM of it. */
const TEST_CENTRE = { latitude: 17.493971, longitude: 78.324914 };
const MAX_DISTANCE_KM = 5;
const KM_PER_DEGREE = 111.32;

/** A point `distanceKm` from the centre along `bearingDegrees`, so cases fan out around the tester. */
function offsetFromCentre(distanceKm, bearingDegrees) {
  const bearing = (bearingDegrees * Math.PI) / 180;
  const latitude = TEST_CENTRE.latitude + (distanceKm * Math.cos(bearing)) / KM_PER_DEGREE;
  const longitude =
    TEST_CENTRE.longitude +
    (distanceKm * Math.sin(bearing)) / (KM_PER_DEGREE * Math.cos((latitude * Math.PI) / 180));
  return { latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)) };
}

/** Whole hand-written values are used as-is, so fail loudly rather than seed an over-limit one. */
function assertWithinLimit(values, maxLength, label) {
  const tooLong = values.filter((value) => value.length > maxLength);
  if (tooLong.length > 0) {
    console.error(`${label} over ${maxLength} characters:\n${tooLong.map((v) => `  ${v.length}: ${v}`).join('\n')}`);
    process.exit(1);
  }
}
assertWithinLimit(ADDRESSES, MAX_LENGTH.address, 'ADDRESSES');
assertWithinLimit(LOCATIONS, MAX_LENGTH.location, 'LOCATIONS');
assertWithinLimit(RELATIONS, MAX_LENGTH.respondentRelation, 'RELATIONS');

function sqlStr(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNum(value) {
  return value === null || value === undefined ? 'NULL' : String(value);
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Adds units (words or whole sentences) cyclically from `offset` while they fit within
 * `maxLength`, skipping any unit that would overflow, so the result lands at (or close to)
 * the limit without ever splitting a unit.
 */
function fillUnits(units, maxLength, offset) {
  let out = '';
  for (let k = offset, misses = 0; misses < units.length; k++) {
    const unit = units[k % units.length];
    const next = out ? `${out} ${unit}` : unit;
    if (next.length > maxLength) {
      misses++;
      continue;
    }
    out = next;
    misses = 0;
  }
  return out;
}

function capitalise(text) {
  return `${text[0].toUpperCase()}${text.slice(1)}`;
}

const cases = [];
const components = [];

for (let i = 0; i < RECORD_COUNT; i++) {
  const n = String(i + 1).padStart(3, '0');
  const bucket = BUCKETS[Math.floor(i / (RECORD_COUNT / BUCKETS.length))];
  const caseId = `case-uitest-${n}`;
  const isNew = bucket === 'new';
  const isCompleted = bucket === 'completed';
  const addressType = ADDRESS_TYPES[i % ADDRESS_TYPES.length];
  // The first case sits inside the 200 m geofence so a passing check can be tested; the rest fan
  // out to MAX_DISTANCE_KM on a golden-angle spiral, giving a spread of distances and bearings.
  const distanceKm = i === 0 ? 0.08 : (i / (RECORD_COUNT - 1)) * MAX_DISTANCE_KM;
  const target = offsetFromCentre(distanceKm, i * 137.5);
  const receivedDate = addDays('2026-08-20', i % 10);
  const tatDue = bucket === 'pending' ? addDays('2026-09-15', i % 10) : addDays(receivedDate, 7);

  cases.push({
    id: caseId,
    caseRef: `UITEST-QUATH00009${n}`,
    clientName: fillUnits(ORGANISATION_WORDS, MAX_LENGTH.clientName, i * 2),
    candidateName: fillUnits(PERSON_WORDS, MAX_LENGTH.candidateName, i * 3),
    fatherOrSpouseName: fillUnits(PERSON_WORDS, MAX_LENGTH.fatherOrSpouseName, i * 3 + 7),
    employerName: fillUnits(ORGANISATION_WORDS, MAX_LENGTH.employerName, i * 2 + 5),
    profileStatus: isNew ? 'bgv_profile_created' : isCompleted ? 'interim_report_generated' : 'wip',
    primaryContactNumber: `98765${String(43000 + i).padStart(5, '0')}`,
    secondaryContactNumber: `87654${String(21000 + i).padStart(5, '0')}`,
  });

  components.push({
    id: `comp-uitest-${n}`,
    caseId,
    componentStatus: isNew
      ? 'new_component'
      : isCompleted
        ? 'verified_clear'
        : COMPONENT_STATUSES_IN_PROGRESS[i % COMPONENT_STATUSES_IN_PROGRESS.length],
    actionStatus: isCompleted ? 'uploaded' : null,
    bucket,
    verificationType: `${capitalise(addressType)} Address Verification`,
    addressType,
    residenceType: RESIDENCE_TYPES[i % RESIDENCE_TYPES.length],
    address: ADDRESSES[i % ADDRESSES.length],
    location: LOCATIONS[i % LOCATIONS.length],
    remarks: fillUnits(NOTE_SENTENCES, MAX_LENGTH.remarks, i),
    additionalVerificationInstructions: fillUnits(NOTE_SENTENCES, MAX_LENGTH.additionalVerificationInstructions, i + 3),
    additionalVerificationRemarks: fillUnits(NOTE_SENTENCES, MAX_LENGTH.additionalVerificationRemarks, i + 6),
    assignedFieldExecutiveId: isNew ? null : ASSIGNED_FIELD_EXECUTIVE_ID,
    assignedToName: fillUnits(PERSON_WORDS, MAX_LENGTH.assignedToName, i * 3 + 11),
    tatDueAt: `${tatDue} 18:00:00`,
    targetLatitude: target.latitude,
    targetLongitude: target.longitude,
    maskedPrimaryPhone: `+91-9XXXXX${String(4300 + i).padStart(4, '0')}`,
    maskedSecondaryPhone: `+91-8XXXXX${String(2100 + i).padStart(4, '0')}`,
    clientInstructions: fillUnits(NOTE_SENTENCES, MAX_LENGTH.clientInstructions, i + 9),
    fieldExecutiveNotes: fillUnits(NOTE_SENTENCES, MAX_LENGTH.fieldExecutiveNotes, i + 12),
    selectedVerificationStatus: isCompleted ? 'verified_clear' : null,
    respondentName: fillUnits(PERSON_WORDS, MAX_LENGTH.respondentName, i * 3 + 4),
    respondentRelation: RELATIONS[i % RELATIONS.length],
    receivedDate,
    actionUpdatedDate: isCompleted ? addDays(receivedDate, 5) : null,
    insuffRaisedDate: addDays(receivedDate, 1),
    insuffClearedDate: addDays(receivedDate, 2),
    addlDocRequestedDate: addDays(receivedDate, 2),
    addlDocClearedDate: addDays(receivedDate, 3),
    costApprovalRequestedDate: addDays(receivedDate, 3),
    costApprovedDate: addDays(receivedDate, 4),
    costRejectedDate: addDays(receivedDate, 4),
    costCurrency: 'INR',
    costAmount: 12500,
  });
}

const lines = [
  '-- Generated by scripts/sqlite-legacy/generate-ui-test-case-seed.mjs: a small set of synthetic cases with realistic,',
  '-- moderately long text in every free-text field, for checking mobile app layouts.',
  '-- Deletes and re-inserts every uitest case, so it is safe to re-run. Do not hand-edit — regenerate instead.',
  '',
  "DELETE FROM case_components WHERE id LIKE 'comp-uitest-%';",
  "DELETE FROM cases WHERE id LIKE 'case-uitest-%';",
  '',
  'INSERT INTO cases (',
  '  id, case_ref, client_name, candidate_name, father_or_spouse_name, employer_name, profile_status,',
  '  primary_contact_number, secondary_contact_number',
  ') VALUES',
];
cases.forEach((c, idx) => {
  const terminator = idx === cases.length - 1 ? ';' : ',';
  lines.push(
    `  (${[c.id, c.caseRef, c.clientName, c.candidateName, c.fatherOrSpouseName, c.employerName, c.profileStatus, c.primaryContactNumber, c.secondaryContactNumber].map(sqlStr).join(', ')})${terminator}`,
  );
});

lines.push(
  '',
  'INSERT INTO case_components (',
  '  id, case_id, component_status, action_status, bucket, verification_type, address_type, residence_type, address,',
  '  location, remarks, additional_verification_instructions, additional_verification_remarks,',
  '  assigned_field_executive_id, assigned_to_name, tat_due_at, target_latitude, target_longitude,',
  '  masked_primary_phone, masked_secondary_phone, client_instructions, field_executive_notes,',
  '  selected_verification_status, respondent_name, respondent_relation, received_date, action_updated_date,',
  '  insuff_raised_date, insuff_cleared_date, addl_doc_requested_date, addl_doc_cleared_date,',
  '  cost_approval_requested_date, cost_approved_date, cost_rejected_date, cost_currency, cost_amount',
  ') VALUES',
);
components.forEach((c, idx) => {
  const terminator = idx === components.length - 1 ? ';' : ',';
  const values = [
    sqlStr(c.id), sqlStr(c.caseId), sqlStr(c.componentStatus), sqlStr(c.actionStatus), sqlStr(c.bucket),
    sqlStr(c.verificationType), sqlStr(c.addressType), sqlStr(c.residenceType), sqlStr(c.address),
    sqlStr(c.location), sqlStr(c.remarks), sqlStr(c.additionalVerificationInstructions),
    sqlStr(c.additionalVerificationRemarks), sqlStr(c.assignedFieldExecutiveId), sqlStr(c.assignedToName),
    sqlStr(c.tatDueAt), sqlNum(c.targetLatitude), sqlNum(c.targetLongitude), sqlStr(c.maskedPrimaryPhone),
    sqlStr(c.maskedSecondaryPhone), sqlStr(c.clientInstructions), sqlStr(c.fieldExecutiveNotes),
    sqlStr(c.selectedVerificationStatus), sqlStr(c.respondentName), sqlStr(c.respondentRelation),
    sqlStr(c.receivedDate), sqlStr(c.actionUpdatedDate), sqlStr(c.insuffRaisedDate), sqlStr(c.insuffClearedDate),
    sqlStr(c.addlDocRequestedDate), sqlStr(c.addlDocClearedDate), sqlStr(c.costApprovalRequestedDate),
    sqlStr(c.costApprovedDate), sqlStr(c.costRejectedDate), sqlStr(c.costCurrency), sqlNum(c.costAmount),
  ];
  lines.push(`  (${values.join(', ')})${terminator}`);
});

fs.writeFileSync(outPath, lines.join('\n') + '\n');
console.log(`Wrote ${outPath}: ${cases.length} cases, ${components.length} components`);
