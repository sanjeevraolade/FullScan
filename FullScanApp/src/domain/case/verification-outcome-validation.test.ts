import { validateVerificationOutcome } from './verification-outcome-validation';
import type { VerificationOutcomeAnswers } from './verification-outcome-validation';

const NOTHING_ENTERED: VerificationOutcomeAnswers = {
  verificationStatus: '',
  utvReason: '',
  utvRemarks: '',
  insufficientReason: '',
  insufficientRemarks: '',
  residenceType: null,
  addressType: null,
  respondentName: '',
  respondentRelation: '',
  isSignatureCaptured: false,
  capturedPhotoCount: 0,
};

const COMPLETE_VERIFIED_CLEAR: VerificationOutcomeAnswers = {
  ...NOTHING_ENTERED,
  verificationStatus: 'verified_clear',
  residenceType: 'owned',
  addressType: 'present',
  respondentName: 'Anita',
  respondentRelation: 'Mother',
  isSignatureCaptured: true,
  capturedPhotoCount: 2,
};

describe('validateVerificationOutcome', () => {
  describe('nothing entered', () => {
    it('refuses the submission and says nothing has been entered', () => {
      const result = validateVerificationOutcome(NOTHING_ENTERED);

      expect(result.isValid).toBe(false);
      expect(result.formErrorKeys).toEqual(['caseDetails.validation.nothingEntered']);
      expect(result.fieldErrorKeys).toEqual({
        verificationStatus: 'validation.required',
        capturedPhotoCount: 'caseDetails.validation.photoRequired',
      });
    });
  });

  describe('only photos captured', () => {
    it('refuses the submission and says photos alone are not enough', () => {
      const result = validateVerificationOutcome({ ...NOTHING_ENTERED, capturedPhotoCount: 3 });

      expect(result.isValid).toBe(false);
      expect(result.formErrorKeys).toEqual(['caseDetails.validation.photosOnly']);
      expect(result.fieldErrorKeys).toEqual({ verificationStatus: 'validation.required' });
    });

    it('treats a whitespace-only status as no status', () => {
      const result = validateVerificationOutcome({
        ...NOTHING_ENTERED,
        verificationStatus: '  ',
        capturedPhotoCount: 1,
      });

      expect(result.formErrorKeys).toEqual(['caseDetails.validation.photosOnly']);
    });
  });

  describe('Verified Clear', () => {
    it('accepts a fully completed Verified Residence & Respondent section', () => {
      expect(validateVerificationOutcome(COMPLETE_VERIFIED_CLEAR).isValid).toBe(true);
    });

    it('requires every Verified Residence & Respondent field when nothing is filled in', () => {
      const result = validateVerificationOutcome({
        ...NOTHING_ENTERED,
        verificationStatus: 'verified_clear',
        capturedPhotoCount: 2,
      });

      expect(result.isValid).toBe(false);
      expect(result.formErrorKeys).toEqual([]);
      expect(result.fieldErrorKeys).toEqual({
        residenceType: 'validation.required',
        addressType: 'validation.required',
        respondentName: 'validation.required',
        respondentRelation: 'validation.required',
        isSignatureCaptured: 'validation.required',
      });
    });

    it.each([
      ['residenceType', { residenceType: null }],
      ['addressType', { addressType: null }],
      ['respondentName', { respondentName: '' }],
      ['respondentName', { respondentName: '   ' }],
      ['respondentRelation', { respondentRelation: '' }],
      ['isSignatureCaptured', { isSignatureCaptured: false }],
    ] as const)('flags only %s when that is the one missing field', (field, missing) => {
      const result = validateVerificationOutcome({ ...COMPLETE_VERIFIED_CLEAR, ...missing });

      expect(result.isValid).toBe(false);
      expect(result.fieldErrorKeys).toEqual({ [field]: 'validation.required' });
    });

    it('still requires a photo when the residence section is complete', () => {
      const result = validateVerificationOutcome({
        ...COMPLETE_VERIFIED_CLEAR,
        capturedPhotoCount: 0,
      });

      expect(result.isValid).toBe(false);
      expect(result.formErrorKeys).toEqual([]);
      expect(result.fieldErrorKeys).toEqual({
        capturedPhotoCount: 'caseDetails.validation.photoRequired',
      });
    });
  });

  describe('photo evidence', () => {
    it.each(['verified_clear', 'utv', 'insufficient'])(
      'requires at least one photo for %s',
      (verificationStatus) => {
        const answers = { ...COMPLETE_VERIFIED_CLEAR, verificationStatus, capturedPhotoCount: 0 };

        expect(validateVerificationOutcome(answers).fieldErrorKeys.capturedPhotoCount).toBe(
          'caseDetails.validation.photoRequired',
        );
      },
    );

    it('accepts exactly one photo', () => {
      expect(
        validateVerificationOutcome({ ...COMPLETE_VERIFIED_CLEAR, capturedPhotoCount: 1 }).isValid,
      ).toBe(true);
    });
  });

  describe('required fields', () => {
    it('requires only the status and a photo before a status is chosen', () => {
      expect(validateVerificationOutcome(NOTHING_ENTERED).requiredFields).toEqual({
        verificationStatus: true,
        capturedPhotoCount: true,
      });
    });

    it('also requires every Verified Residence & Respondent field for Verified Clear, even once filled', () => {
      expect(validateVerificationOutcome(COMPLETE_VERIFIED_CLEAR).requiredFields).toEqual({
        verificationStatus: true,
        capturedPhotoCount: true,
        residenceType: true,
        addressType: true,
        respondentName: true,
        respondentRelation: true,
        isSignatureCaptured: true,
      });
    });

    it.each(['utv', 'insufficient'])(
      'requires only the status and a photo for %s',
      (verificationStatus) => {
        expect(
          validateVerificationOutcome({ ...NOTHING_ENTERED, verificationStatus }).requiredFields,
        ).toEqual({ verificationStatus: true, capturedPhotoCount: true });
      },
    );
  });

  describe('other statuses', () => {
    it.each(['utv', 'insufficient'])(
      'does not require the Verified Residence fields for %s',
      (verificationStatus) => {
        expect(
          validateVerificationOutcome({
            ...NOTHING_ENTERED,
            verificationStatus,
            capturedPhotoCount: 1,
          }).isValid,
        ).toBe(true);
      },
    );
  });
});
