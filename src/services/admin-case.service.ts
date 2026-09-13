import { v4 as uuidv4 } from 'uuid';

import * as adminCaseDao from '../db/admin-case.dao.js';
import * as fieldExecutiveDao from '../db/field-executive.dao.js';
import * as referenceDataDao from '../db/reference-data.dao.js';
import { AppError } from '../utils/app-error.js';
import type { CaseComponentRow } from '../types/case.types.js';
import type {
  AdminCaseComponent,
  AdminCaseComponentInput,
  AdminCaseDetail,
  AdminCaseListFilter,
  AdminCaseListResult,
  CaseCategoryCount,
  CaseRow,
  CreateCaseInput,
  CaseFormOptions,
  UpdateCaseInput,
} from '../types/admin-case.types.js';
import { ADDRESS_TYPES, CASE_BUCKETS, RESIDENCE_TYPES } from '../types/admin-case.types.js';
import type { DropdownCategory, DropdownOption } from '../types/reference-data.types.js';

/**
 * Admin case management.
 *
 * The shape of the request is already checked by the route schema; what happens
 * here is everything that needs the database to decide: that the case ref is
 * free, that the assignee exists, and that every status code is one the
 * reference data actually defines (the portal renders those dropdowns from the
 * same table, so a code that isn't in it would show up blank on the device).
 */

const DEFAULT_COMPONENT_STATUS = 'new_component';

function isKnownDropdownCode(category: DropdownCategory, code: string): boolean {
  return referenceDataDao
    .findDropdownOptionsByCategory(category)
    .some((option) => option.code === code);
}

function assertKnownDropdownCode(
  category: DropdownCategory,
  code: string,
  fieldLabel: string,
): void {
  if (!isKnownDropdownCode(category, code)) {
    throw new AppError(400, `Unknown ${fieldLabel}: ${code}`);
  }
}

function assertFieldExecutiveExists(fieldExecutiveId: string): void {
  if (!fieldExecutiveDao.findFieldExecutiveById(fieldExecutiveId)) {
    throw new AppError(400, `Unknown field executive: ${fieldExecutiveId}`);
  }
}

function toText(value: string | undefined | null): string {
  return value?.trim() ?? '';
}

function toNullableText(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function mapComponent(
  row: CaseComponentRow & { assigned_field_executive_name: string | null },
): AdminCaseComponent {
  return {
    id: row.id,
    bucket: row.bucket,
    componentStatus: row.component_status,
    actionStatus: row.action_status,
    verificationType: row.verification_type,
    addressType: row.address_type,
    residenceType: row.residence_type,
    address: row.address,
    location: row.location,
    remarks: row.remarks,
    additionalVerificationInstructions: row.additional_verification_instructions,
    additionalVerificationRemarks: row.additional_verification_remarks,
    assignedFieldExecutiveId: row.assigned_field_executive_id,
    assignedFieldExecutiveName: row.assigned_field_executive_name,
    assignedToName: row.assigned_to_name,
    tatDueAt: row.tat_due_at,
    targetLatitude: row.target_latitude,
    targetLongitude: row.target_longitude,
    maskedPrimaryPhone: row.masked_primary_phone,
    maskedSecondaryPhone: row.masked_secondary_phone,
    clientInstructions: row.client_instructions,
    fieldExecutiveNotes: row.field_executive_notes,
    selectedVerificationStatus: row.selected_verification_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDetail(caseRow: CaseRow): AdminCaseDetail {
  return {
    id: caseRow.id,
    caseRef: caseRow.case_ref,
    clientName: caseRow.client_name,
    candidateName: caseRow.candidate_name,
    fatherOrSpouseName: caseRow.father_or_spouse_name,
    employerName: caseRow.employer_name,
    primaryContactNumber: caseRow.primary_contact_number,
    secondaryContactNumber: caseRow.secondary_contact_number,
    profileStatus: caseRow.profile_status,
    createdAt: caseRow.created_at,
    updatedAt: caseRow.updated_at,
    components: adminCaseDao.findComponentRowsByCaseId(caseRow.id).map(mapComponent),
  };
}

/** Every bucket appears, including the ones with nothing in them, so tabs never vanish. */
function fillMissingCategories(counted: CaseCategoryCount[]): CaseCategoryCount[] {
  return CASE_BUCKETS.map((bucket) => ({
    bucket,
    count: counted.find((entry) => entry.bucket === bucket)?.count ?? 0,
  }));
}

/** All case components, filtered and paged, plus the per-category counts behind the tabs. */
export function listCasesForAdmin(filter: AdminCaseListFilter): AdminCaseListResult {
  if (filter.fieldExecutiveId) {
    assertFieldExecutiveExists(filter.fieldExecutiveId);
  }

  return {
    items: adminCaseDao.findComponentsForAdmin(filter),
    total: adminCaseDao.countComponentsForAdmin(filter),
    categories: fillMissingCategories(adminCaseDao.countComponentsByBucket(filter)),
    limit: filter.limit,
    offset: filter.offset,
  };
}

/** One case with every component beneath it — what the admin editor loads. */
export function getCaseForAdmin(caseId: string): AdminCaseDetail {
  const caseRow = adminCaseDao.findCaseById(caseId);

  if (!caseRow) {
    throw new AppError(404, `Case not found: ${caseId}`);
  }

  return mapDetail(caseRow);
}

/** Validates one component payload and binds it to the columns a write touches. */
function toComponentWriteValues(
  componentId: string,
  caseId: string,
  input: AdminCaseComponentInput,
): adminCaseDao.CaseComponentWriteValues {
  const componentStatus = toText(input.componentStatus) || DEFAULT_COMPONENT_STATUS;
  const actionStatus = toNullableText(input.actionStatus);
  const assignedFieldExecutiveId = toNullableText(input.assignedFieldExecutiveId);

  assertKnownDropdownCode('component_status', componentStatus, 'component status');

  if (actionStatus) {
    assertKnownDropdownCode('action_status', actionStatus, 'action status');
  }

  if (assignedFieldExecutiveId) {
    assertFieldExecutiveExists(assignedFieldExecutiveId);
  }

  return {
    id: componentId,
    caseId,
    bucket: input.bucket,
    componentStatus,
    actionStatus,
    verificationType: toText(input.verificationType),
    addressType: toNullableText(input.addressType),
    residenceType: toNullableText(input.residenceType),
    address: toText(input.address),
    location: toText(input.location),
    remarks: toText(input.remarks),
    additionalVerificationInstructions: toText(input.additionalVerificationInstructions),
    additionalVerificationRemarks: toText(input.additionalVerificationRemarks),
    assignedFieldExecutiveId,
    assignedToName: toText(input.assignedToName),
    tatDueAt: toText(input.tatDueAt),
    targetLatitude: input.targetLatitude ?? 0,
    targetLongitude: input.targetLongitude ?? 0,
    maskedPrimaryPhone: toText(input.maskedPrimaryPhone),
    maskedSecondaryPhone: toText(input.maskedSecondaryPhone),
    clientInstructions: toText(input.clientInstructions),
    fieldExecutiveNotes: toText(input.fieldExecutiveNotes),
  };
}

function toCaseWriteValues(caseId: string, input: CreateCaseInput | UpdateCaseInput): adminCaseDao.CaseWriteValues {
  assertKnownDropdownCode('profile_status', input.profileStatus, 'profile status');

  return {
    id: caseId,
    caseRef: toText(input.caseRef),
    clientName: toText(input.clientName),
    candidateName: toText(input.candidateName),
    fatherOrSpouseName: toText(input.fatherOrSpouseName),
    employerName: toText(input.employerName),
    primaryContactNumber: toText(input.primaryContactNumber),
    secondaryContactNumber: toText(input.secondaryContactNumber),
    profileStatus: input.profileStatus,
  };
}

/**
 * Creates a case and its components. A case with no component would be invisible
 * to the mobile app (which lists components), so at least one is required —
 * enforced by the route schema and relied on here.
 */
export function createCase(input: CreateCaseInput): AdminCaseDetail {
  const caseRef = toText(input.caseRef);

  if (adminCaseDao.findCaseByRef(caseRef)) {
    throw new AppError(409, `A case already exists with reference ${caseRef}`);
  }

  const caseId = uuidv4();
  const caseValues = toCaseWriteValues(caseId, input);
  const componentValues = input.components.map((component) =>
    toComponentWriteValues(uuidv4(), caseId, component),
  );

  adminCaseDao.runInTransaction(() => {
    adminCaseDao.insertCase(caseValues);
    componentValues.forEach(adminCaseDao.insertCaseComponent);
  });

  return getCaseForAdmin(caseId);
}

/**
 * Updates a case's own fields and upserts the components it carries: an entry
 * with an `id` updates that component, one without adds a new component to the
 * case. Components of the case left out of the payload are untouched — the back
 * office edits one component at a time, and a partial payload must never silently
 * delete the rest of a candidate's verification trail.
 */
export function updateCase(caseId: string, input: UpdateCaseInput): AdminCaseDetail {
  const existing = adminCaseDao.findCaseById(caseId);

  if (!existing) {
    throw new AppError(404, `Case not found: ${caseId}`);
  }

  const caseRef = toText(input.caseRef);
  const conflicting = adminCaseDao.findCaseByRef(caseRef);

  if (conflicting && conflicting.id !== caseId) {
    throw new AppError(409, `A case already exists with reference ${caseRef}`);
  }

  const ownedComponentIds = new Set(adminCaseDao.findComponentIdsByCaseId(caseId));
  const caseValues = toCaseWriteValues(caseId, input);

  const writes = input.components.map((component) => {
    if (component.id && !ownedComponentIds.has(component.id)) {
      throw new AppError(404, `Component ${component.id} does not belong to case ${caseId}`);
    }

    return {
      isNew: !component.id,
      values: toComponentWriteValues(component.id ?? uuidv4(), caseId, component),
    };
  });

  adminCaseDao.runInTransaction(() => {
    adminCaseDao.updateCase(caseValues);

    for (const write of writes) {
      if (write.isNew) {
        adminCaseDao.insertCaseComponent(write.values);
      } else {
        adminCaseDao.updateCaseComponent(write.values);
      }
    }
  });

  return getCaseForAdmin(caseId);
}

function mapOptions(category: DropdownCategory): DropdownOption[] {
  return referenceDataDao
    .findDropdownOptionsByCategory(category)
    .map((row) => ({ code: row.code, label: row.label }));
}

/**
 * Everything the case form's dropdowns need, from the same `dropdown_options`
 * rows the mobile app reads — so a status the portal offers is always one the
 * device can render a label for.
 */
export function getCaseFormOptions(): CaseFormOptions {
  return {
    buckets: CASE_BUCKETS,
    addressTypes: ADDRESS_TYPES,
    residenceTypes: RESIDENCE_TYPES,
    componentStatuses: mapOptions('component_status'),
    actionStatuses: mapOptions('action_status'),
    profileStatuses: mapOptions('profile_status'),
  };
}
