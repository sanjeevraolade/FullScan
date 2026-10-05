import { ObjectId, type Document } from 'mongodb';
import { getCollection, sessionOption } from './connection.js';
import { containsText, EXPOSE_ID, fromDocument, JOIN_PARENT_CASE, leftJoinFields } from './documents.js';
import { nowTimestamp } from './timestamp.js';
import type { CaseComponentRow } from '../types/case.types.js';
import type {
  AdminCaseListFilter,
  AdminCaseListItem,
  CaseCategoryCount,
  CaseRow,
} from '../types/admin-case.types.js';

export { runInTransaction } from './connection.js';

/**
 * Admin reads and writes over `cases` / `case_components`.
 *
 * Kept apart from `case.dao.ts` on purpose: that one answers "what is assigned
 * to *this* field executive", this one answers "what exists at all" and is the
 * only place cases are created or edited.
 */

/** `LEFT JOIN field_executives fe ON fe.id = cc.assigned_field_executive_id`, for the assignee's name. */
const JOIN_ASSIGNEE_NAME = leftJoinFields('field_executives', 'assigned_field_executive_id', {
  assigned_field_executive_name: 'name',
});

/** The columns of an `AdminCaseListItem` source row. */
const LIST_PROJECTION = {
  _id: 0,
  id: '$_id',
  case_id: 1,
  bucket: 1,
  verification_type: 1,
  address_type: 1,
  address: 1,
  component_status: 1,
  action_status: 1,
  assigned_field_executive_id: 1,
  assigned_to_name: 1,
  tat_due_at: 1,
  updated_at: 1,
  case_ref: 1,
  client_name: 1,
  candidate_name: 1,
  profile_status: 1,
  assigned_field_executive_name: 1,
};

interface AdminCaseListRow {
  readonly id: string;
  readonly case_id: string;
  readonly case_ref: string;
  readonly client_name: string;
  readonly candidate_name: string;
  readonly bucket: AdminCaseListItem['bucket'];
  readonly verification_type: string;
  readonly address_type: string | null;
  readonly address: string;
  readonly component_status: string;
  readonly action_status: string | null;
  readonly profile_status: string;
  readonly assigned_field_executive_id: string | null;
  readonly assigned_field_executive_name: string | null;
  readonly assigned_to_name: string;
  readonly tat_due_at: string;
  readonly updated_at: string;
}

/**
 * Components joined with their case and filtered — shared by the list, the total and
 * the category counts. Component-level conditions run before the join so the
 * indexes are used; the search spans case columns too, so it runs after.
 */
function buildFilteredComponents(
  filter: AdminCaseListFilter,
  options: { readonly includeBucket: boolean },
): Document[] {
  const componentMatch: Document = {};

  if (options.includeBucket && filter.bucket) {
    componentMatch.bucket = filter.bucket;
  }

  if (filter.fieldExecutiveId) {
    componentMatch.assigned_field_executive_id = filter.fieldExecutiveId;
  }

  const stages: Document[] = [{ $match: componentMatch }, ...JOIN_PARENT_CASE];

  if (filter.search) {
    const term = containsText(filter.search);
    stages.push({
      $match: {
        $or: [{ case_ref: term }, { candidate_name: term }, { client_name: term }, { address: term }],
      },
    });
  }

  return stages;
}

function mapListRow(row: AdminCaseListRow): AdminCaseListItem {
  return {
    id: row.id,
    caseId: row.case_id,
    caseRef: row.case_ref,
    clientName: row.client_name,
    candidateName: row.candidate_name,
    bucket: row.bucket,
    verificationType: row.verification_type,
    addressType: row.address_type,
    address: row.address,
    componentStatus: row.component_status,
    actionStatus: row.action_status,
    profileStatus: row.profile_status,
    assignedFieldExecutiveId: row.assigned_field_executive_id,
    assignedFieldExecutiveName: row.assigned_field_executive_name,
    assignedToName: row.assigned_to_name,
    tatDueAt: row.tat_due_at,
    updatedAt: row.updated_at,
  };
}

export async function findComponentsForAdmin(filter: AdminCaseListFilter): Promise<AdminCaseListItem[]> {
  const rows = await getCollection('case_components')
    .aggregate<AdminCaseListRow>(
      [
        ...buildFilteredComponents(filter, { includeBucket: true }),
        { $sort: { updated_at: -1, _id: 1 } },
        { $skip: filter.offset },
        { $limit: filter.limit },
        ...JOIN_ASSIGNEE_NAME,
        { $project: LIST_PROJECTION },
      ],
      sessionOption(),
    )
    .toArray();

  return rows.map(mapListRow);
}

export async function countComponentsForAdmin(filter: AdminCaseListFilter): Promise<number> {
  const [result] = await getCollection('case_components')
    .aggregate<{ total: number }>(
      [...buildFilteredComponents(filter, { includeBucket: true }), { $count: 'total' }],
      sessionOption(),
    )
    .toArray();

  return result?.total ?? 0;
}

/**
 * Per-bucket counts under the *non-bucket* part of the filter, so switching tabs
 * never changes the numbers on the tabs.
 */
export function countComponentsByBucket(filter: AdminCaseListFilter): Promise<CaseCategoryCount[]> {
  return getCollection('case_components')
    .aggregate<CaseCategoryCount>(
      [
        ...buildFilteredComponents(filter, { includeBucket: false }),
        { $group: { _id: '$bucket', count: { $sum: 1 } } },
        { $project: { _id: 0, bucket: '$_id', count: 1 } },
      ],
      sessionOption(),
    )
    .toArray();
}

async function findCase(filter: Document): Promise<CaseRow | undefined> {
  const document = await getCollection('cases').findOne(filter, sessionOption());
  return document ? fromDocument<CaseRow>(document) : undefined;
}

export function findCaseById(caseId: string): Promise<CaseRow | undefined> {
  return findCase({ _id: caseId });
}

export function findCaseByRef(caseRef: string): Promise<CaseRow | undefined> {
  return findCase({ case_ref: caseRef });
}

/** Components of one case, joined with their parent case and assignee name. */
export function findComponentRowsByCaseId(
  caseId: string,
): Promise<(CaseComponentRow & { assigned_field_executive_name: string | null })[]> {
  return getCollection('case_components')
    .aggregate<CaseComponentRow & { assigned_field_executive_name: string | null }>(
      [
        { $match: { case_id: caseId } },
        { $sort: { created_at: 1, _id: 1 } },
        ...JOIN_PARENT_CASE,
        ...JOIN_ASSIGNEE_NAME,
        ...EXPOSE_ID,
      ],
      sessionOption(),
    )
    .toArray();
}

export async function findComponentIdsByCaseId(caseId: string): Promise<string[]> {
  const documents = await getCollection<{ _id: string }>('case_components')
    .find({ case_id: caseId }, { projection: { _id: 1 }, ...sessionOption() })
    .toArray();
  return documents.map((document) => document._id);
}

/** Every column an admin write touches — insert and update bind the same shape. */
export interface CaseComponentWriteValues {
  readonly id: string;
  readonly caseId: string;
  readonly bucket: string;
  readonly componentStatus: string;
  readonly actionStatus: string | null;
  readonly verificationType: string;
  readonly addressType: string | null;
  readonly residenceType: string | null;
  readonly address: string;
  readonly location: string;
  readonly remarks: string;
  readonly additionalVerificationInstructions: string;
  readonly additionalVerificationRemarks: string;
  readonly assignedFieldExecutiveId: string | null;
  readonly assignedToName: string;
  readonly tatDueAt: string;
  readonly targetLatitude: number;
  readonly targetLongitude: number;
  readonly maskedPrimaryPhone: string;
  readonly maskedSecondaryPhone: string;
  readonly clientInstructions: string;
  readonly fieldExecutiveNotes: string;
}

export interface CaseWriteValues {
  readonly id: string;
  readonly caseRef: string;
  readonly clientName: string;
  readonly candidateName: string;
  readonly fatherOrSpouseName: string;
  readonly employerName: string;
  readonly primaryContactNumber: string;
  readonly secondaryContactNumber: string;
  readonly profileStatus: string;
}

function toCaseFields(values: CaseWriteValues): Document {
  return {
    case_ref: values.caseRef,
    client_name: values.clientName,
    candidate_name: values.candidateName,
    father_or_spouse_name: values.fatherOrSpouseName,
    employer_name: values.employerName,
    primary_contact_number: values.primaryContactNumber,
    secondary_contact_number: values.secondaryContactNumber,
    profile_status: values.profileStatus,
  };
}

function toComponentFields(values: CaseComponentWriteValues): Document {
  return {
    component_status: values.componentStatus,
    action_status: values.actionStatus,
    bucket: values.bucket,
    verification_type: values.verificationType,
    address_type: values.addressType,
    residence_type: values.residenceType,
    address: values.address,
    location: values.location,
    remarks: values.remarks,
    additional_verification_instructions: values.additionalVerificationInstructions,
    additional_verification_remarks: values.additionalVerificationRemarks,
    assigned_field_executive_id: values.assignedFieldExecutiveId,
    assigned_to_name: values.assignedToName,
    tat_due_at: values.tatDueAt,
    target_latitude: values.targetLatitude,
    target_longitude: values.targetLongitude,
    masked_primary_phone: values.maskedPrimaryPhone,
    masked_secondary_phone: values.maskedSecondaryPhone,
    client_instructions: values.clientInstructions,
    field_executive_notes: values.fieldExecutiveNotes,
  };
}

/**
 * The columns an admin write never sets, at the defaults SQLite gave them. Written
 * explicitly so a new component reads back with `null`s rather than missing fields.
 */
const COMPONENT_DEFAULTS = {
  gps_distance_meters: 0,
  gps_is_within_range: 0,
  selected_verification_status: null,
  respondent_name: null,
  respondent_relation: null,
  received_date: null,
  action_updated_date: null,
  insuff_raised_date: null,
  insuff_cleared_date: null,
  addl_doc_requested_date: null,
  addl_doc_cleared_date: null,
  cost_approval_requested_date: null,
  cost_approved_date: null,
  cost_rejected_date: null,
  cost_currency: null,
  cost_amount: null,
  // The rest of the field executive's verification outcome (case.dao `updateComponentVerificationOutcome`).
  utv_reason: null,
  utv_remarks: null,
  insufficient_reason: null,
  insufficient_remarks: null,
  observed_residence_type: null,
  observed_address_type: null,
  is_signature_captured: null,
  submitted_latitude: null,
  submitted_longitude: null,
  submitted_distance_meters: null,
  is_force_proceed: null,
  outcome_submitted_at: null,
} as const;

export async function insertCase(values: CaseWriteValues): Promise<void> {
  const now = nowTimestamp();
  await getCollection('cases').insertOne(
    { _id: values.id, ...toCaseFields(values), created_at: now, updated_at: now },
    sessionOption(),
  );
}

export async function updateCase(values: CaseWriteValues): Promise<void> {
  await getCollection('cases').updateOne(
    { _id: values.id },
    { $set: { ...toCaseFields(values), updated_at: nowTimestamp() } },
    sessionOption(),
  );
}

export async function insertCaseComponent(values: CaseComponentWriteValues): Promise<void> {
  const now = nowTimestamp();
  await getCollection('case_components').insertOne(
    {
      _id: values.id,
      case_id: values.caseId,
      ...toComponentFields(values),
      ...COMPONENT_DEFAULTS,
      created_at: now,
      updated_at: now,
      insert_order: new ObjectId(),
    },
    sessionOption(),
  );
}

/**
 * Updates an existing component. The verification outcome columns
 * (`selected_verification_status`, respondent, the rest of the submitted outcome —
 * `observed_*`, `submitted_*`, `is_force_proceed`, … — and the date trail) are deliberately
 * left out — they are the field executive's record of what happened on site, not
 * something the back office overwrites from a form.
 */
export async function updateCaseComponent(values: CaseComponentWriteValues): Promise<void> {
  await getCollection('case_components').updateOne(
    { _id: values.id, case_id: values.caseId },
    { $set: { ...toComponentFields(values), updated_at: nowTimestamp() } },
    sessionOption(),
  );
}
