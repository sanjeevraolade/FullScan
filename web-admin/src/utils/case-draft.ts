import { z } from 'zod';
import type {
  AdminCaseComponent,
  AdminCaseDetail,
  CaseBucket,
  CaseComponentPayload,
  CasePayload,
} from '../types/cases';
import { isCaseBucket } from './labels';

/**
 * The case editor works on string-valued drafts (exactly what the inputs hold) and
 * converts to the API payload only on save. Every editable field — including the
 * two additional-verification texts — round-trips, so saving never blanks a field
 * the form did not show.
 */

export interface ComponentDraft {
  /** Local key for React lists; stable across re-renders. */
  readonly key: string;
  /** Server id, or null for a component added in this editor. */
  readonly id: string | null;
  readonly bucket: CaseBucket;
  readonly componentStatus: string;
  readonly actionStatus: string;
  readonly verificationType: string;
  readonly addressType: string;
  readonly residenceType: string;
  readonly address: string;
  readonly location: string;
  readonly remarks: string;
  readonly additionalVerificationInstructions: string;
  readonly additionalVerificationRemarks: string;
  readonly assignedFieldExecutiveId: string;
  readonly assignedToName: string;
  readonly tatDueAt: string;
  readonly targetLatitude: string;
  readonly targetLongitude: string;
  readonly maskedPrimaryPhone: string;
  readonly maskedSecondaryPhone: string;
  readonly clientInstructions: string;
  readonly fieldExecutiveNotes: string;
}

export type ComponentField = Exclude<keyof ComponentDraft, 'key' | 'id'>;

export interface CaseDraft {
  /** Server id, or null when creating. */
  readonly id: string | null;
  readonly caseRef: string;
  readonly clientName: string;
  readonly candidateName: string;
  readonly fatherOrSpouseName: string;
  readonly employerName: string;
  readonly primaryContactNumber: string;
  readonly secondaryContactNumber: string;
  readonly profileStatus: string;
  readonly components: readonly ComponentDraft[];
}

export type CaseField = Exclude<keyof CaseDraft, 'id' | 'components'>;

let keySequence = 0;
function nextKey(): string {
  keySequence += 1;
  return `component-${keySequence}`;
}

export function createBlankComponent(): ComponentDraft {
  return {
    key: nextKey(),
    id: null,
    bucket: 'new',
    componentStatus: 'new_component',
    actionStatus: '',
    verificationType: 'Address',
    addressType: 'present',
    residenceType: '',
    address: '',
    location: '',
    remarks: '',
    additionalVerificationInstructions: '',
    additionalVerificationRemarks: '',
    assignedFieldExecutiveId: '',
    assignedToName: '',
    tatDueAt: '',
    targetLatitude: '0',
    targetLongitude: '0',
    maskedPrimaryPhone: '',
    maskedSecondaryPhone: '',
    clientInstructions: '',
    fieldExecutiveNotes: '',
  };
}

export function createBlankCase(): CaseDraft {
  return {
    id: null,
    caseRef: '',
    clientName: '',
    candidateName: '',
    fatherOrSpouseName: '',
    employerName: '',
    primaryContactNumber: '',
    secondaryContactNumber: '',
    profileStatus: '',
    components: [createBlankComponent()],
  };
}

function componentToDraft(component: AdminCaseComponent): ComponentDraft {
  return {
    key: nextKey(),
    id: component.id,
    bucket: component.bucket,
    componentStatus: component.componentStatus,
    actionStatus: component.actionStatus ?? '',
    verificationType: component.verificationType,
    addressType: component.addressType ?? '',
    residenceType: component.residenceType ?? '',
    address: component.address,
    location: component.location,
    remarks: component.remarks,
    additionalVerificationInstructions: component.additionalVerificationInstructions,
    additionalVerificationRemarks: component.additionalVerificationRemarks,
    assignedFieldExecutiveId: component.assignedFieldExecutiveId ?? '',
    assignedToName: component.assignedToName,
    tatDueAt: component.tatDueAt,
    targetLatitude: String(component.targetLatitude),
    targetLongitude: String(component.targetLongitude),
    maskedPrimaryPhone: component.maskedPrimaryPhone,
    maskedSecondaryPhone: component.maskedSecondaryPhone,
    clientInstructions: component.clientInstructions,
    fieldExecutiveNotes: component.fieldExecutiveNotes,
  };
}

export function caseToDraft(detail: AdminCaseDetail): CaseDraft {
  return {
    id: detail.id,
    caseRef: detail.caseRef,
    clientName: detail.clientName,
    candidateName: detail.candidateName,
    fatherOrSpouseName: detail.fatherOrSpouseName,
    employerName: detail.employerName,
    primaryContactNumber: detail.primaryContactNumber,
    secondaryContactNumber: detail.secondaryContactNumber,
    profileStatus: detail.profileStatus,
    components: detail.components.map(componentToDraft),
  };
}

/** Path of a validation problem: a case field, or a component field by index. */
export type DraftProblemPath =
  | { readonly kind: 'case'; readonly field: CaseField }
  | { readonly kind: 'component'; readonly index: number; readonly field: ComponentField }
  | { readonly kind: 'components' };

export interface DraftProblem {
  readonly path: DraftProblemPath;
  readonly message: string;
}

const TAT_PATTERN = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/;

function coordinateSchema(min: number, max: number, label: string) {
  return z
    .string()
    .trim()
    .refine((value) => value === '' || Number.isFinite(Number(value)), `${label} must be a number`)
    .refine((value) => {
      const number = Number(value || '0');
      return number >= min && number <= max;
    }, `${label} must be between ${min} and ${max}`);
}

/** Mirrors the server's `admin-case.schema.ts` limits; the server stays the authority. */
const componentDraftSchema = z.object({
  bucket: z.string().refine((value) => isCaseBucket(value), 'Choose a category'),
  componentStatus: z.string().min(1, 'Choose a component status'),
  verificationType: z.string().trim().min(1, 'Enter a verification type').max(100, 'Too long (100 max)'),
  address: z.string().trim().min(1, 'Enter an address').max(1000, 'Too long (1000 max)'),
  location: z.string().max(200, 'Too long (200 max)'),
  assignedToName: z.string().max(200, 'Too long (200 max)'),
  tatDueAt: z
    .string()
    .trim()
    .refine((value) => value === '' || TAT_PATTERN.test(value), 'Use YYYY-MM-DD HH:MM:SS'),
  targetLatitude: coordinateSchema(-90, 90, 'Latitude'),
  targetLongitude: coordinateSchema(-180, 180, 'Longitude'),
  maskedPrimaryPhone: z.string().max(50, 'Too long (50 max)'),
  maskedSecondaryPhone: z.string().max(50, 'Too long (50 max)'),
  remarks: z.string().max(2000, 'Too long (2000 max)'),
  additionalVerificationInstructions: z.string().max(2000, 'Too long (2000 max)'),
  additionalVerificationRemarks: z.string().max(2000, 'Too long (2000 max)'),
  clientInstructions: z.string().max(2000, 'Too long (2000 max)'),
  fieldExecutiveNotes: z.string().max(2000, 'Too long (2000 max)'),
});

const caseDraftSchema = z.object({
  caseRef: z.string().trim().min(1, 'Enter a case reference').max(100, 'Too long (100 max)'),
  clientName: z.string().trim().min(1, 'Enter the client').max(200, 'Too long (200 max)'),
  candidateName: z.string().trim().min(1, 'Enter the candidate').max(200, 'Too long (200 max)'),
  fatherOrSpouseName: z.string().max(200, 'Too long (200 max)'),
  employerName: z.string().max(200, 'Too long (200 max)'),
  primaryContactNumber: z.string().max(50, 'Too long (50 max)'),
  secondaryContactNumber: z.string().max(50, 'Too long (50 max)'),
  profileStatus: z.string().min(1, 'Choose a profile status'),
});

const CASE_FIELDS: ReadonlySet<string> = new Set(Object.keys(caseDraftSchema.shape));
const COMPONENT_FIELDS: ReadonlySet<string> = new Set(Object.keys(componentDraftSchema.shape));

function isCaseField(value: unknown): value is CaseField {
  return typeof value === 'string' && CASE_FIELDS.has(value);
}

function isComponentField(value: unknown): value is ComponentField {
  return typeof value === 'string' && COMPONENT_FIELDS.has(value);
}

export const MAX_COMPONENTS = 20;

/** Every problem worth fixing before a round trip, in form order. */
export function validateCaseDraft(draft: CaseDraft): readonly DraftProblem[] {
  const problems: DraftProblem[] = [];

  const caseResult = caseDraftSchema.safeParse(draft);
  if (!caseResult.success) {
    for (const issue of caseResult.error.issues) {
      const [field] = issue.path;
      if (isCaseField(field)) {
        problems.push({ path: { kind: 'case', field }, message: issue.message });
      }
    }
  }

  if (!draft.id && draft.components.length === 0) {
    problems.push({ path: { kind: 'components' }, message: 'A new case needs at least one component.' });
  }
  if (draft.components.length > MAX_COMPONENTS) {
    problems.push({ path: { kind: 'components' }, message: `A case can have at most ${MAX_COMPONENTS} components.` });
  }

  draft.components.forEach((component, index) => {
    const result = componentDraftSchema.safeParse(component);
    if (result.success) {
      return;
    }
    for (const issue of result.error.issues) {
      const [field] = issue.path;
      if (isComponentField(field)) {
        problems.push({ path: { kind: 'component', index, field }, message: issue.message });
      }
    }
  });

  return problems;
}

export function describeProblem(problem: DraftProblem): string {
  return problem.path.kind === 'component'
    ? `Component ${problem.path.index + 1}: ${problem.message}`
    : problem.message;
}

function toNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function toCoordinate(value: string): number {
  const trimmed = value.trim();
  return trimmed === '' ? 0 : Number(trimmed);
}

function componentToPayload(component: ComponentDraft): CaseComponentPayload {
  const payload: CaseComponentPayload = {
    bucket: component.bucket,
    componentStatus: component.componentStatus,
    actionStatus: toNullable(component.actionStatus),
    verificationType: component.verificationType.trim(),
    addressType: toNullable(component.addressType),
    residenceType: toNullable(component.residenceType),
    address: component.address.trim(),
    location: component.location.trim(),
    remarks: component.remarks.trim(),
    additionalVerificationInstructions: component.additionalVerificationInstructions.trim(),
    additionalVerificationRemarks: component.additionalVerificationRemarks.trim(),
    assignedFieldExecutiveId: toNullable(component.assignedFieldExecutiveId),
    assignedToName: component.assignedToName.trim(),
    tatDueAt: component.tatDueAt.trim(),
    targetLatitude: toCoordinate(component.targetLatitude),
    targetLongitude: toCoordinate(component.targetLongitude),
    maskedPrimaryPhone: component.maskedPrimaryPhone.trim(),
    maskedSecondaryPhone: component.maskedSecondaryPhone.trim(),
    clientInstructions: component.clientInstructions.trim(),
    fieldExecutiveNotes: component.fieldExecutiveNotes.trim(),
  };
  return component.id ? { id: component.id, ...payload } : payload;
}

/** Call only on a draft `validateCaseDraft` passed. */
export function draftToPayload(draft: CaseDraft): CasePayload {
  return {
    caseRef: draft.caseRef.trim(),
    clientName: draft.clientName.trim(),
    candidateName: draft.candidateName.trim(),
    fatherOrSpouseName: draft.fatherOrSpouseName.trim(),
    employerName: draft.employerName.trim(),
    primaryContactNumber: draft.primaryContactNumber.trim(),
    secondaryContactNumber: draft.secondaryContactNumber.trim(),
    profileStatus: draft.profileStatus,
    components: draft.components.map(componentToPayload),
  };
}

/** Compares what would be sent, so formatting-only differences (e.g. `0` vs `0.0`) are not "unsaved". */
export function isDraftChanged(draft: CaseDraft, baseline: CaseDraft): boolean {
  return JSON.stringify(draftToPayload(draft)) !== JSON.stringify(draftToPayload(baseline));
}
