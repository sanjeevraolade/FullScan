import { describe, expect, it } from 'vitest';
import type { AdminCaseDetail } from '../types/cases';
import {
  caseToDraft,
  createBlankCase,
  createBlankComponent,
  draftToPayload,
  isDraftChanged,
  MAX_COMPONENTS,
  validateCaseDraft,
  type CaseDraft,
} from './case-draft';

const detail: AdminCaseDetail = {
  id: 'case-1',
  caseRef: 'FS-2026-00001',
  clientName: 'Globex Corp',
  candidateName: 'Meera Joshi',
  fatherOrSpouseName: 'Prakash Joshi',
  employerName: 'Globex Corp',
  primaryContactNumber: '9999999999',
  secondaryContactNumber: '',
  profileStatus: 'wip',
  createdAt: '2026-08-01 10:00:00',
  updatedAt: '2026-08-02 10:00:00',
  components: [
    {
      id: 'comp-1',
      bucket: 'pending',
      componentStatus: 'new_component',
      actionStatus: null,
      verificationType: 'Address',
      addressType: 'present',
      residenceType: null,
      address: 'H.No. 1, Kondapur',
      location: 'Kondapur, Hyderabad',
      remarks: '',
      additionalVerificationInstructions: 'Check the landlord agreement',
      additionalVerificationRemarks: 'Landlord reachable after 6pm',
      assignedFieldExecutiveId: 'fe-001',
      assignedFieldExecutiveName: 'Amit Verma',
      assignedToName: '',
      tatDueAt: '2026-08-21 18:00:00',
      targetLatitude: 17.4699,
      targetLongitude: 78.3578,
      maskedPrimaryPhone: '98XXXXXX01',
      maskedSecondaryPhone: '',
      clientInstructions: 'Standard address verification.',
      fieldExecutiveNotes: '',
      selectedVerificationStatus: null,
      createdAt: '2026-08-01 10:00:00',
      updatedAt: '2026-08-02 10:00:00',
    },
  ],
};

function validBlankCase(): CaseDraft {
  const blank = createBlankCase();
  return {
    ...blank,
    caseRef: 'FS-NEW-1',
    clientName: 'Initech',
    candidateName: 'Ravi Kumar',
    profileStatus: 'wip',
    components: blank.components.map((component) => ({ ...component, address: 'H.No. 2, Miyapur' })),
  };
}

describe('case drafts', () => {
  it('round-trips a loaded case into the same payload, keeping component ids and every text field', () => {
    const payload = draftToPayload(caseToDraft(detail));
    const [component] = payload.components;

    expect(component).toMatchObject({
      id: 'comp-1',
      actionStatus: null,
      residenceType: null,
      assignedFieldExecutiveId: 'fe-001',
      targetLatitude: 17.4699,
      targetLongitude: 78.3578,
      additionalVerificationInstructions: 'Check the landlord agreement',
      additionalVerificationRemarks: 'Landlord reachable after 6pm',
    });
  });

  it('sends new components without an id and blanks as null / zero', () => {
    const payload = draftToPayload(validBlankCase());
    const [component] = payload.components;

    expect(component).not.toHaveProperty('id');
    expect(component).toMatchObject({ actionStatus: null, residenceType: null, assignedFieldExecutiveId: null });

    const withBlankCoordinates = draftToPayload({
      ...validBlankCase(),
      components: [{ ...createBlankComponent(), address: 'x', targetLatitude: ' ', targetLongitude: '' }],
    });
    expect(withBlankCoordinates.components[0]).toMatchObject({ targetLatitude: 0, targetLongitude: 0 });
  });

  it('accepts a complete draft and a loaded case', () => {
    expect(validateCaseDraft(validBlankCase())).toEqual([]);
    expect(validateCaseDraft(caseToDraft(detail))).toEqual([]);
  });

  it('reports required case fields and component problems by path', () => {
    const blank = createBlankCase();
    const problems = validateCaseDraft({
      ...blank,
      components: [{ ...blank.components[0]!, address: ' ', tatDueAt: '21/08/2026', targetLatitude: '91' }],
    });

    const paths = problems.map((problem) => JSON.stringify(problem.path));
    expect(paths).toContain(JSON.stringify({ kind: 'case', field: 'caseRef' }));
    expect(paths).toContain(JSON.stringify({ kind: 'case', field: 'profileStatus' }));
    expect(paths).toContain(JSON.stringify({ kind: 'component', index: 0, field: 'address' }));
    expect(paths).toContain(JSON.stringify({ kind: 'component', index: 0, field: 'tatDueAt' }));
    expect(paths).toContain(JSON.stringify({ kind: 'component', index: 0, field: 'targetLatitude' }));
  });

  it('requires a component on a new case and caps the count', () => {
    expect(validateCaseDraft({ ...validBlankCase(), components: [] }).map((problem) => problem.path.kind)).toContain(
      'components',
    );

    const tooMany = Array.from({ length: MAX_COMPONENTS + 1 }, () => ({ ...createBlankComponent(), address: 'x' }));
    expect(validateCaseDraft({ ...validBlankCase(), components: tooMany }).map((problem) => problem.path.kind)).toContain(
      'components',
    );
  });

  it('detects real changes only', () => {
    const loaded = caseToDraft(detail);

    expect(isDraftChanged(loaded, loaded)).toBe(false);
    expect(isDraftChanged({ ...loaded, clientName: 'Globex Corp ' }, loaded)).toBe(false);
    expect(isDraftChanged({ ...loaded, clientName: 'Umbrella Ltd' }, loaded)).toBe(true);
    expect(
      isDraftChanged(
        { ...loaded, components: loaded.components.map((component) => ({ ...component, targetLatitude: '17.46990' })) },
        loaded,
      ),
    ).toBe(false);
  });
});
