import { z } from 'zod';
import * as caseDao from '../db/case.dao.js';
import * as referenceDataDao from '../db/reference-data.dao.js';
import { AppError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';
import type {
  CaseBucket,
  CaseComponentRow,
  CaseCounts,
  CaseDetail,
  CasePage,
  CaseSummary,
  CostRequested,
  LegacyCaseSummary,
  VerificationOutcomeInput,
} from '../types/case.types.js';

/** List items and the accept / verification-outcome responses. */
function mapSummary(row: CaseComponentRow): CaseSummary {
  return {
    id: row.id,
    checkId: row.id,
    caseRef: row.case_ref,
    clientName: row.client_name,
    candidateName: row.candidate_name,
    verificationType: row.verification_type,
    address: row.address,
    updatedAt: row.updated_at,
  };
}

/** @deprecated Items of the legacy all-buckets `GET /cases` — see `getCasesForCurrentFieldExecutive`. */
function mapLegacySummary(row: CaseComponentRow): LegacyCaseSummary {
  return {
    id: row.id,
    caseId: row.case_id,
    caseRef: row.case_ref,
    clientName: row.client_name,
    candidateName: row.candidate_name,
    verificationType: row.verification_type,
    address: row.address,
    bucket: row.bucket,
    updatedAt: row.updated_at,
  };
}

function mapCostRequested(row: CaseComponentRow): CostRequested | null {
  return row.cost_currency && row.cost_amount !== null
    ? { currency: row.cost_currency, amount: row.cost_amount }
    : null;
}

async function mapDetail(row: CaseComponentRow): Promise<CaseDetail> {
  const siblings = (await caseDao.findSiblingComponents(row.case_id, row.id)).map((sibling) => ({
    id: sibling.id,
    verificationType: sibling.verification_type,
    addressType: sibling.address_type,
    componentStatus: sibling.component_status,
    bucket: sibling.bucket,
  }));

  return {
    id: row.id,
    checkId: row.id,
    caseRef: row.case_ref,
    bucket: row.bucket,
    tatDueAt: row.tat_due_at,
    candidateName: row.candidate_name,
    fatherOrSpouseName: row.father_or_spouse_name,
    employerName: row.employer_name,
    verificationType: row.verification_type,
    clientName: row.client_name,
    address: row.address,
    addressType: row.address_type,
    residenceType: row.residence_type,
    gpsCheck: {
      targetLatitude: row.target_latitude,
      targetLongitude: row.target_longitude,
      distanceMeters: row.gps_distance_meters,
      isWithinRange: row.gps_is_within_range === 1,
    },
    maskedPrimaryPhone: row.masked_primary_phone,
    maskedSecondaryPhone: row.masked_secondary_phone,
    clientInstructions: row.client_instructions,
    fieldExecutiveNotes: row.field_executive_notes,
    selectedVerificationStatus: row.selected_verification_status,
    respondent:
      row.respondent_name && row.respondent_relation
        ? { name: row.respondent_name, relation: row.respondent_relation }
        : null,
    componentStatus: row.component_status,
    actionStatus: row.action_status,
    profileStatus: row.profile_status,
    costRequested: mapCostRequested(row),
    insuffRaisedAt: row.insuff_raised_date,
    insuffClearedAt: row.insuff_cleared_date,
    addlDocRequestedAt: row.addl_doc_requested_date,
    addlDocClearedAt: row.addl_doc_cleared_date,
    costApprovalRequestedAt: row.cost_approval_requested_date,
    costApprovedAt: row.cost_approved_date,
    costRejectedAt: row.cost_rejected_date,
    siblingComponents: siblings,
  };
}

const MIN_RANDOM_NEW_COMPONENTS = 3;
const MAX_RANDOM_NEW_COMPONENTS = 10;

/** How many components one New-tab draw asks for: a random integer from 3 to 10. */
function drawRandomNewCount(): number {
  return (
    MIN_RANDOM_NEW_COMPONENTS +
    Math.floor(Math.random() * (MAX_RANDOM_NEW_COMPONENTS - MIN_RANDOM_NEW_COMPONENTS + 1))
  );
}

/**
 * @deprecated The legacy all-buckets `GET /cases` (no `type`), kept unchanged for app
 * builds already installed in the field — the current app uses `getCaseCounts` and
 * `getCasesPage`. Remove it, with `LegacyCaseSummary`, once no supported build calls it.
 *
 * Returns the current field executive's actually-assigned components
 * (pending, beyond TAT, completed) plus a fresh random draw from the whole
 * 'new' bucket pool — the New tab simulates a live incoming-case feed, so it
 * is re-randomized on every request rather than reflecting a fixed
 * assignment. The app groups by bucket and computes tab counts client-side.
 */
export async function getCasesForCurrentFieldExecutive(fieldExecutiveId: string): Promise<LegacyCaseSummary[]> {
  const assignedRows = (await caseDao.findComponentsByFieldExecutive(fieldExecutiveId)).filter(
    (row) => row.bucket !== 'new',
  );

  const randomNewRows = await caseDao.findRandomNewComponents(drawRandomNewCount());

  return [...randomNewRows, ...assignedRows].map(mapLegacySummary);
}

/** The buckets whose tab lists what is actually assigned to the executive — every one but New. */
const ASSIGNED_BUCKETS = ['pending', 'beyond_tat', 'completed'] as const satisfies readonly CaseBucket[];

type AssignedBucket = (typeof ASSIGNED_BUCKETS)[number];

/**
 * `GET /cases/counts`. Pending / Beyond TAT / Completed count the executive's own
 * components — the rows `getCasesPage` lists for that type. New is a random draw on
 * every list call, so its count is one too: `min(random 3–10, size of the 'new' pool)`,
 * independent of any list call (the app reconciles the two).
 */
export async function getCaseCounts(fieldExecutiveId: string): Promise<CaseCounts> {
  const [assigned, newPoolSize] = await Promise.all([
    caseDao.countComponentsByFieldExecutive(fieldExecutiveId, ASSIGNED_BUCKETS),
    caseDao.countNewComponents(),
  ]);

  return {
    new: Math.min(drawRandomNewCount(), newPoolSize),
    pending: assigned.get('pending') ?? 0,
    beyond_tat: assigned.get('beyond_tat') ?? 0,
    completed: assigned.get('completed') ?? 0,
  };
}

const DEFAULT_CASES_PAGE_SIZE = 100;
const MAX_CASES_PAGE_SIZE = 500;

/** The last `CASES_PAGE_SIZE` value read, so an invalid one is warned about once, not per request. */
let pageSizeSetting: { readonly raw: string | undefined; readonly size: number } | undefined;

/**
 * `CASES_PAGE_SIZE`: an integer from 1 to 500, default 100; anything else logs a
 * warning and uses 100. Unset or empty means the default, without a warning.
 *
 * Read on use rather than at import: `src/index.ts` runs `dotenv.config()` after its
 * imports have loaded, so a module-level read would never see a value set in `.env`.
 */
function resolveCasesPageSize(): number {
  const raw = process.env.CASES_PAGE_SIZE;

  if (pageSizeSetting && pageSizeSetting.raw === raw) {
    return pageSizeSetting.size;
  }

  const trimmed = raw?.trim() ?? '';
  const parsed = /^[0-9]+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  const isValid = parsed >= 1 && parsed <= MAX_CASES_PAGE_SIZE;

  if (!isValid && trimmed !== '') {
    logger.warn(
      { value: raw },
      `CASES_PAGE_SIZE must be an integer from 1 to ${MAX_CASES_PAGE_SIZE}; using ${DEFAULT_CASES_PAGE_SIZE}`,
    );
  }

  const size = isValid ? parsed : DEFAULT_CASES_PAGE_SIZE;
  pageSizeSetting = { raw, size };
  return size;
}

const INVALID_CURSOR = 'Invalid cursor';

/** Longer than any cursor `encodeCursor` produces; anything longer is rejected before decoding. */
const MAX_CURSOR_LENGTH = 512;

/**
 * A cursor is base64url (unpadded) JSON `{ t, u, o }`: the tab it was issued for, and
 * the last item's `updated_at` and `insert_order` (hex). Opaque to the app — it only
 * hands back what it was given — so the encoding can change without a contract change.
 */
const cursorPayloadSchema = z
  .object({
    t: z.enum(ASSIGNED_BUCKETS),
    u: z.string().min(1).max(64),
    o: z.string().refine(caseDao.isInsertOrderKey),
  })
  .strict();

function encodeCursor(type: AssignedBucket, key: caseDao.ComponentPageKey): string {
  return Buffer.from(JSON.stringify({ t: type, u: key.updatedAt, o: key.insertOrder }), 'utf8').toString(
    'base64url',
  );
}

/** The page key a cursor encodes; `400 Invalid cursor` if it is malformed or was issued for another tab. */
function decodeCursor(cursor: string, type: AssignedBucket): caseDao.ComponentPageKey {
  if (cursor.length === 0 || cursor.length > MAX_CURSOR_LENGTH || !/^[A-Za-z0-9_-]+$/.test(cursor)) {
    throw new AppError(400, INVALID_CURSOR);
  }

  let decoded: unknown;

  try {
    decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new AppError(400, INVALID_CURSOR);
  }

  const payload = cursorPayloadSchema.safeParse(decoded);

  if (!payload.success || payload.data.t !== type) {
    throw new AppError(400, INVALID_CURSOR);
  }

  return { updatedAt: payload.data.u, insertOrder: payload.data.o };
}

/**
 * `GET /cases?type=…[&cursor=…]` — one page of one tab.
 *
 * Pending / Beyond TAT / Completed are keyset pages of the executive's own components,
 * newest `updated_at` first, ties by `insert_order`. `pageSize + 1` rows are read so
 * `nextCursor` is only issued when another row exists — `null` is the only end signal.
 *
 * New is the unchanged random draw (3–10 from the whole 'new' pool): always a single
 * page with `nextCursor: null`, so any cursor sent with it is invalid.
 */
export async function getCasesPage(
  fieldExecutiveId: string,
  type: CaseBucket,
  cursor: string | undefined,
): Promise<CasePage> {
  const pageSize = resolveCasesPageSize();

  if (type === 'new') {
    if (cursor !== undefined) {
      throw new AppError(400, INVALID_CURSOR);
    }

    const rows = await caseDao.findRandomNewComponents(drawRandomNewCount());
    return { type, items: rows.map(mapSummary), nextCursor: null, pageSize };
  }

  const after = cursor === undefined ? null : decodeCursor(cursor, type);
  const entries = await caseDao.findComponentsPageByFieldExecutive(fieldExecutiveId, type, after, pageSize + 1);
  const page = entries.slice(0, pageSize);
  const last = page.at(-1);
  const nextCursor = entries.length > pageSize && last ? encodeCursor(type, last.key) : null;

  return { type, items: page.map((entry) => mapSummary(entry.row)), nextCursor, pageSize };
}

/**
 * Moves a component from the New bucket to Pending/In Progress, and assigns
 * it to the accepting field executive — 'new' components are randomly drawn
 * from the whole pool per request, so acceptance is what actually claims
 * ownership.
 */
export async function acceptCase(componentId: string, fieldExecutiveId: string): Promise<CaseSummary> {
  const existing = await caseDao.findComponentById(componentId);

  if (!existing) {
    throw new AppError(404, `Case component not found: ${componentId}`);
  }

  if (existing.bucket !== 'new') {
    throw new AppError(409, `Case component ${componentId} is not in the New bucket`);
  }

  const updated = await caseDao.updateComponentBucket(componentId, 'pending', fieldExecutiveId);
  return mapSummary(updated);
}

/** Full Case Details payload for the verification workflow screen. */
export async function getCaseDetail(componentId: string): Promise<CaseDetail> {
  const existing = await caseDao.findComponentById(componentId);

  if (!existing) {
    throw new AppError(404, `Case component not found: ${componentId}`);
  }

  return mapDetail(existing);
}

async function assertKnownVerificationStatus(verificationStatus: string): Promise<void> {
  const statuses = await referenceDataDao.findDropdownOptionsByCategory('verification_type_status');

  if (!statuses.some((option) => option.code === verificationStatus)) {
    throw new AppError(400, 'Unknown verificationStatus');
  }
}

/**
 * Records the field executive's verification outcome — every field, plus the server time
 * — and moves the component to Completed. The body's shape and the `verified_clear` rules
 * were checked by the route schema; the status code is checked here, after the component
 * lookup. A later submission overwrites an earlier one, so a retried request is safe.
 * Only the executive the component is assigned to may submit it; anyone else gets the same
 * 404 as for an unknown id, so the route cannot be used to probe which ids exist.
 * docs/api-contracts/verification-outcome-submission.md.
 */
export async function submitVerificationOutcome(
  componentId: string,
  fieldExecutiveId: string,
  outcome: VerificationOutcomeInput,
): Promise<CaseSummary> {
  const existing = await caseDao.findComponentById(componentId);

  if (!existing || existing.assigned_field_executive_id !== fieldExecutiveId) {
    throw new AppError(404, `Case component not found: ${componentId}`);
  }

  await assertKnownVerificationStatus(outcome.verificationStatus);

  const updated = await caseDao.updateComponentVerificationOutcome(componentId, outcome);

  // No respondent details or coordinates: those are PII / location of the visit.
  logger.info(
    { componentId, verificationStatus: outcome.verificationStatus, forceProceed: outcome.forceProceed },
    'Verification outcome recorded',
  );

  return mapSummary(updated);
}
