#!/usr/bin/env node
/**
 * Generator: reads real case-export CSVs (one row per verification
 * component — New/Pending/Uploaded/Completed/Stopped/Rejected, etc.) and
 * emits INSERT statements seeding `cases` + `case_components` with real,
 * de-identified shaped data instead of synthetic filler.
 *
 * By default processes the original 5-phase set (used for migration 010).
 * Pass an explicit file:phase manifest to target a different/incremental
 * set of CSVs (e.g. a later migration adding a newly-seen phase) — every
 * `INSERT` is `OR IGNORE`, so re-running against already-seeded cases is
 * safe, but each run gets its own migration file: earlier migrations may
 * already be applied to a running dev DB, so already-numbered migration
 * files should never be edited/regenerated in place — add a new one instead.
 *
 * Usage: node scripts/generate-real-case-seed.mjs <csv-dir> <output-sql-path> [Base1:phase1 Base2:phase2 ...]
 */
import fs from 'fs';
import path from 'path';

const [, , csvDir, outPath, ...manifestArgs] = process.argv;
if (!csvDir || !outPath) {
  console.error(
    'Usage: node scripts/generate-real-case-seed.mjs <csv-dir> <output-sql-path> [Base1:phase1 Base2:phase2 ...]',
  );
  process.exit(1);
}

const DEFAULT_FILES = {
  New_Cases: 'new',
  Pending: 'pending',
  Uploaded: 'uploaded',
  Completed: 'completed',
  Stopped: 'stopped',
};

const FILES =
  manifestArgs.length > 0
    ? Object.fromEntries(
        manifestArgs.map((entry) => {
          const [base, phase] = entry.split(':');
          if (!base || !phase) {
            console.error(`Invalid manifest entry "${entry}" — expected Base:phase`);
            process.exit(1);
          }
          return [base, phase];
        }),
      )
    : DEFAULT_FILES;

const TODAY = new Date('2026-08-29T00:00:00Z');

function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function stripExcelFormula(value) {
  // Excel exports wrap literal strings as ="value" to prevent auto-formatting; the CSV
  // parser above already consumes the surrounding quotes as the field's quoting, leaving
  // a literal leading '=' behind (e.g. `="38622013"` -> field text `=38622013`).
  const trimmed = value.trim();
  return trimmed.startsWith('=') ? trimmed.slice(1) : trimmed;
}

function parseMdy(value) {
  const v = stripExcelFormula(value);
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

const COMPONENT_STATUS_CODE = {
  '': 'new_component',
  'new component': 'new_component',
  'additional verification request raised': 'additional_verification_requested',
  'component accepted': 'component_accepted',
  'component stopped': 'component_stopped',
  'insuff raised': 'insuff_raised',
  'insuff cleared': 'insuff_cleared',
  'addtional doc req raised': 'addl_doc_requested',
  'addtional doc req cleared': 'addl_doc_cleared',
  'cost approval requested': 'cost_approval_requested',
  'cost approved': 'cost_approved',
  'cost rejected': 'cost_rejected',
  'verified clear': 'verified_clear',
  discrepancy: 'discrepancy',
  utv: 'utv',
};

const ACTION_STATUS_CODE = {
  uploaded: 'uploaded',
  'accept/approve': 'accepted',
  stop: 'stopped',
  rejected: 'rejected',
};

/** Action statuses meaning the FE's submission is done and out of their active queue. */
const TERMINAL_ACTION_STATUS_CODES = new Set(['uploaded', 'accepted', 'stopped']);
/** Action statuses meaning the component needs FE rework — back into the active queue. */
const REWORK_ACTION_STATUS_CODES = new Set(['rejected']);

const RESIDENCE_TYPE_CODE = {
  own: 'owned',
  rented: 'rented',
  hostel: 'hostel',
  'paying guest': 'paying_guest',
  'company quarters': 'company_quarters',
  'relative owned': 'relative_owned',
};

const ADDRESS_TYPE_CODE = {
  present: 'present',
  permanent: 'permanent',
  previous: 'previous',
};

const PROFILE_STATUS_CODE = {
  'bgv profile created': 'bgv_profile_created',
  wip: 'wip',
  'interim report generated': 'interim_report_generated',
  'final report generated': 'final_report_generated',
  completed: 'completed',
  'stop profile': 'stop_profile',
};
const PROFILE_STATUS_RANK = {
  bgv_profile_created: 1,
  wip: 2,
  interim_report_generated: 3,
  final_report_generated: 4,
  completed: 5,
  stop_profile: 6,
};

function sqlStr(value) {
  if (value === null || value === undefined || value === '') return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}
function sqlStrRequired(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}
function sqlNum(value) {
  return value === null || value === undefined || Number.isNaN(value) ? 'NULL' : String(value);
}

function maskPhone(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length < 4) return '';
  return `+91-${digits.slice(0, 1)}XXXXX${digits.slice(-4)}`;
}

function parseContacts(raw) {
  const parts = (raw || '')
    .split('/')
    .map((p) => stripExcelFormula(p))
    .filter(Boolean);
  return { primary: parts[0] || '', secondary: parts[1] || parts[0] || '' };
}

function parseCost(raw) {
  const v = (raw || '').trim();
  if (!v) return { currency: null, amount: null };
  const m = /^([A-Z]{2,3})\s+([\d,]+(?:\.\d+)?)$/.exec(v);
  if (!m) return { currency: null, amount: null };
  return { currency: m[1], amount: Number(m[2].replace(/,/g, '')) };
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const HEADER = [
  'Check Id', 'Case Ref Number', 'Component Status', 'Client Name', 'Candidate Name', 'Contact Number',
  'Address Type', 'Residence Type', 'Address', 'Location', 'Remarks', 'Additional Verification Instructions',
  'Additional Verification Remarks', 'Received Date', 'Profile Created', 'Assigned To', 'Action Status',
  'Action Updated Date', 'Insuff Raised Date', 'Insuff Cleared Date', 'Addl Doc Req Date', 'Addl Doc Cleared Date',
  'Cost Approval Req Date', 'Cost Approved Date', 'Cost Rejected Date', 'Cost Requested', 'Profile Status',
];

const cases = new Map(); // case_ref -> { clientName, candidateName, primary, secondary, receivedDate, profileCreated, profileStatusRank, profileStatusCode }
const components = [];
let compSeq = 0;

for (const [fileBase, sourceLabel] of Object.entries(FILES)) {
  const match = fs.readdirSync(csvDir).find((f) => f.includes(fileBase));
  if (!match) {
    console.error(`Missing CSV for ${fileBase} in ${csvDir}`);
    process.exit(1);
  }
  const text = fs.readFileSync(path.join(csvDir, match), 'utf-8');
  const rows = parseCsv(text);
  const header = rows[0].map((h) => h.trim());
  if (header.join('|') !== HEADER.join('|')) {
    console.error(`Unexpected header in ${match}:\n${header.join('|')}`);
    process.exit(1);
  }

  for (const row of rows.slice(1)) {
    if (row.every((c) => c.trim() === '')) continue;
    const get = (name) => row[header.indexOf(name)] ?? '';

    const caseRef = get('Case Ref Number').trim();
    if (!caseRef) continue;
    const clientName = get('Client Name').trim();
    const candidateName = get('Candidate Name').trim();
    const { primary, secondary } = parseContacts(get('Contact Number'));
    const receivedDate = parseMdy(get('Received Date'));
    const profileCreated = parseMdy(get('Profile Created'));
    const rawProfileStatus = get('Profile Status').trim().toLowerCase();
    const profileStatusCode = PROFILE_STATUS_CODE[rawProfileStatus] || 'bgv_profile_created';
    const profileStatusRank = PROFILE_STATUS_RANK[profileStatusCode];

    const existingCase = cases.get(caseRef);
    if (!existingCase || profileStatusRank > existingCase.profileStatusRank) {
      cases.set(caseRef, {
        clientName,
        candidateName,
        primary,
        secondary,
        receivedDate: existingCase?.receivedDate || receivedDate,
        profileCreated: existingCase?.profileCreated || profileCreated,
        profileStatusRank,
        profileStatusCode,
      });
    } else {
      existingCase.receivedDate = existingCase.receivedDate || receivedDate;
      existingCase.profileCreated = existingCase.profileCreated || profileCreated;
    }

    const rawCheckId = stripExcelFormula(get('Check Id'));
    compSeq += 1;
    const componentId = rawCheckId ? `check-${rawCheckId}` : `comp-${slugify(caseRef)}-${sourceLabel}-${compSeq}`;

    const rawComponentStatus = get('Component Status').trim().toLowerCase();
    const componentStatusCode = COMPONENT_STATUS_CODE[rawComponentStatus] || 'new_component';
    const rawActionStatus = get('Action Status').trim().toLowerCase();
    const actionStatusCode = ACTION_STATUS_CODE[rawActionStatus] || null;

    const addressTypeCode = ADDRESS_TYPE_CODE[get('Address Type').trim().toLowerCase()] || null;
    const residenceTypeCode = RESIDENCE_TYPE_CODE[get('Residence Type').trim().toLowerCase()] || null;
    const verificationType = addressTypeCode
      ? `${addressTypeCode[0].toUpperCase()}${addressTypeCode.slice(1)} Address`
      : 'Address';

    const dueBaseline = receivedDate || profileCreated || TODAY.toISOString().slice(0, 10);
    const tatDue = addDays(dueBaseline, 7);
    const isOverdue = new Date(`${tatDue}T18:00:00Z`) < TODAY;

    let bucket;
    if (TERMINAL_ACTION_STATUS_CODES.has(actionStatusCode)) {
      // FE's work is done, whatever the eventual back-office outcome (uploaded/accepted/stopped).
      bucket = 'completed';
    } else if (
      REWORK_ACTION_STATUS_CODES.has(actionStatusCode) ||
      (!actionStatusCode &&
        componentStatusCode !== 'new_component' &&
        componentStatusCode !== 'additional_verification_requested')
    ) {
      // Rejected (needs FE rework) or already-accepted/in-progress — still active for the FE.
      bucket = isOverdue ? 'beyond_tat' : 'pending';
    } else {
      bucket = 'new';
    }

    const tatDueAt = `${tatDue} 18:00:00`;
    const cost = parseCost(get('Cost Requested'));

    components.push({
      id: componentId,
      caseRef,
      componentStatusCode,
      actionStatusCode,
      bucket,
      verificationType,
      addressTypeCode,
      residenceTypeCode,
      address: get('Address').trim(),
      location: get('Location').trim(),
      remarks: get('Remarks').trim(),
      additionalVerificationInstructions: get('Additional Verification Instructions').trim(),
      additionalVerificationRemarks: get('Additional Verification Remarks').trim(),
      assignedToName: get('Assigned To').trim(),
      tatDueAt,
      maskedPrimaryPhone: maskPhone(primary),
      maskedSecondaryPhone: maskPhone(secondary),
      receivedDate,
      actionUpdatedDate: parseMdy(get('Action Updated Date')),
      insuffRaisedDate: parseMdy(get('Insuff Raised Date')),
      insuffClearedDate: parseMdy(get('Insuff Cleared Date')),
      addlDocReqDate: parseMdy(get('Addl Doc Req Date')),
      addlDocClearedDate: parseMdy(get('Addl Doc Cleared Date')),
      costApprovalReqDate: parseMdy(get('Cost Approval Req Date')),
      costApprovedDate: parseMdy(get('Cost Approved Date')),
      costRejectedDate: parseMdy(get('Cost Rejected Date')),
      costCurrency: cost.currency,
      costAmount: cost.amount,
      sourceFile: sourceLabel,
    });
  }
}

const lines = [];
lines.push(
  '-- Generated by scripts/generate-real-case-seed.mjs from real (de-identified test-account) case',
  `-- exports covering: ${Object.values(FILES).join(', ')}. Do not hand-edit — regenerate from the source CSVs instead.`,
  '',
  'INSERT OR IGNORE INTO cases (id, case_ref, client_name, candidate_name, profile_status, primary_contact_number, secondary_contact_number) VALUES',
);
const caseEntries = [...cases.entries()];
caseEntries.forEach(([caseRef, c], idx) => {
  const id = `case-real-${slugify(caseRef)}`;
  const comma = idx === caseEntries.length - 1 ? ';' : ',';
  lines.push(
    `  (${sqlStrRequired(id)}, ${sqlStrRequired(caseRef)}, ${sqlStrRequired(c.clientName)}, ${sqlStrRequired(c.candidateName)}, ${sqlStrRequired(c.profileStatusCode)}, ${sqlStrRequired(c.primary)}, ${sqlStrRequired(c.secondary)})${comma}`,
  );
});

lines.push(
  '',
  'INSERT OR IGNORE INTO case_components (',
  '  id, case_id, component_status, action_status, bucket, verification_type, address_type, residence_type, address, location,',
  '  remarks, additional_verification_instructions, additional_verification_remarks, assigned_to_name, tat_due_at,',
  '  masked_primary_phone, masked_secondary_phone, received_date, action_updated_date, insuff_raised_date,',
  '  insuff_cleared_date, addl_doc_requested_date, addl_doc_cleared_date, cost_approval_requested_date,',
  '  cost_approved_date, cost_rejected_date, cost_currency, cost_amount',
  ') VALUES',
);
components.forEach((comp, idx) => {
  const caseId = `case-real-${slugify(comp.caseRef)}`;
  const comma = idx === components.length - 1 ? ';' : ',';
  lines.push(
    `  (${sqlStrRequired(comp.id)}, ${sqlStrRequired(caseId)}, ${sqlStrRequired(comp.componentStatusCode)}, ${sqlStr(comp.actionStatusCode)}, ${sqlStrRequired(comp.bucket)}, ${sqlStrRequired(comp.verificationType)}, ${sqlStr(comp.addressTypeCode)}, ${sqlStr(comp.residenceTypeCode)}, ${sqlStrRequired(comp.address)}, ${sqlStrRequired(comp.location)}, ${sqlStrRequired(comp.remarks)}, ${sqlStrRequired(comp.additionalVerificationInstructions)}, ${sqlStrRequired(comp.additionalVerificationRemarks)}, ${sqlStrRequired(comp.assignedToName)}, ${sqlStrRequired(comp.tatDueAt)}, ${sqlStrRequired(comp.maskedPrimaryPhone)}, ${sqlStrRequired(comp.maskedSecondaryPhone)}, ${sqlStr(comp.receivedDate)}, ${sqlStr(comp.actionUpdatedDate)}, ${sqlStr(comp.insuffRaisedDate)}, ${sqlStr(comp.insuffClearedDate)}, ${sqlStr(comp.addlDocReqDate)}, ${sqlStr(comp.addlDocClearedDate)}, ${sqlStr(comp.costApprovalReqDate)}, ${sqlStr(comp.costApprovedDate)}, ${sqlStr(comp.costRejectedDate)}, ${sqlStr(comp.costCurrency)}, ${sqlNum(comp.costAmount)})${comma}`,
  );
});

fs.writeFileSync(outPath, lines.join('\n') + '\n');
console.log(`Wrote ${outPath}: ${caseEntries.length} cases, ${components.length} components`);
