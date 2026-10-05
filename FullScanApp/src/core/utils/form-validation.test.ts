import type { ValidationSection } from '@/core/types';

import { atLeast, required, validateForm } from './form-validation';

interface SampleFormValues {
  readonly kind: string;
  readonly name: string;
  readonly isConfirmed: boolean;
  readonly tags: readonly string[];
  readonly count: number;
}

const FILLED: SampleFormValues = {
  kind: 'detailed',
  name: 'Anita',
  isConfirmed: true,
  tags: ['a'],
  count: 0,
};

describe('required', () => {
  const validator = required('validation.required');

  it('identifies itself as the "required" rule with the given message key', () => {
    expect(validator.ruleId).toBe('required');
    expect(validator.messageKey).toBe('validation.required');
  });

  it.each([
    ['an empty string', ''],
    ['a whitespace-only string', '   \n\t'],
    ['null', null],
    ['undefined', undefined],
    ['false', false],
    ['an empty list', []],
  ])('fails %s', (_label, value) => {
    expect(validator.isSatisfiedBy(value)).toBe(false);
  });

  it.each([
    ['a non-blank string', ' x '],
    ['true', true],
    ['a non-empty list', ['a']],
    ['zero', 0],
  ])('passes %s', (_label, value) => {
    expect(validator.isSatisfiedBy(value)).toBe(true);
  });
});

describe('atLeast', () => {
  it('passes the minimum and anything above it, and fails below it', () => {
    const validator = atLeast(1, 'errors.photoRequired');

    expect(validator.ruleId).toBe('atLeast');
    expect(validator.isSatisfiedBy(0)).toBe(false);
    expect(validator.isSatisfiedBy(1)).toBe(true);
    expect(validator.isSatisfiedBy(5)).toBe(true);
  });

  it('marks the field required only when the minimum is above zero', () => {
    expect(atLeast(1, 'errors.min').isRequirement).toBe(true);
    expect(atLeast(0, 'errors.min').isRequirement).toBe(false);
  });
});

describe('validateForm', () => {
  const SECTIONS: readonly ValidationSection<SampleFormValues>[] = [
    {
      sectionId: 'basics',
      fields: { kind: [required('errors.kindRequired')] },
    },
    {
      sectionId: 'details',
      appliesWhen: (values) => values.kind === 'detailed',
      fields: {
        name: [required('errors.nameRequired')],
        isConfirmed: [required('errors.confirmRequired')],
      },
    },
  ];

  it('is valid when every applicable rule passes', () => {
    const result = validateForm(FILLED, SECTIONS);

    expect(result).toEqual({
      isValid: true,
      issues: [],
      fieldErrorKeys: {},
      formErrorKeys: [],
      requiredFields: { kind: true, name: true, isConfirmed: true },
    });
  });

  it('reports every failing field at once, not just the first', () => {
    const result = validateForm({ ...FILLED, name: '', isConfirmed: false }, SECTIONS);

    expect(result.isValid).toBe(false);
    expect(result.fieldErrorKeys).toEqual({
      name: 'errors.nameRequired',
      isConfirmed: 'errors.confirmRequired',
    });
    expect(result.issues).toEqual([
      {
        sectionId: 'details',
        ruleId: 'required',
        field: 'name',
        messageKey: 'errors.nameRequired',
      },
      {
        sectionId: 'details',
        ruleId: 'required',
        field: 'isConfirmed',
        messageKey: 'errors.confirmRequired',
      },
    ]);
  });

  it('skips a section whose appliesWhen is false', () => {
    const result = validateForm(
      { ...FILLED, kind: 'simple', name: '', isConfirmed: false },
      SECTIONS,
    );

    expect(result.isValid).toBe(true);
  });

  it('reports only the first failing validator for a field', () => {
    const result = validateForm({ ...FILLED, name: '' }, [
      {
        sectionId: 'stacked',
        fields: {
          name: [
            required('errors.first'),
            { ruleId: 'neverPasses', messageKey: 'errors.second', isSatisfiedBy: () => false },
          ],
        },
      },
    ]);

    expect(result.fieldErrorKeys).toEqual({ name: 'errors.first' });
    expect(result.issues).toHaveLength(1);
  });

  it('keeps the earliest section’s message when two sections flag the same field', () => {
    const result = validateForm({ ...FILLED, name: '' }, [
      { sectionId: 'first', fields: { name: [required('errors.first')] } },
      { sectionId: 'second', fields: { name: [required('errors.second')] } },
    ]);

    expect(result.fieldErrorKeys).toEqual({ name: 'errors.first' });
    expect(result.issues).toHaveLength(2);
  });

  it('reports a failed form-wide check without tying it to a field', () => {
    const result = validateForm({ ...FILLED, tags: [] }, [
      {
        sectionId: 'evidence',
        checks: [
          {
            ruleId: 'hasTags',
            messageKey: 'errors.noTags',
            isSatisfiedBy: (values) => values.tags.length > 0,
          },
        ],
      },
    ]);

    expect(result.isValid).toBe(false);
    expect(result.formErrorKeys).toEqual(['errors.noTags']);
    expect(result.fieldErrorKeys).toEqual({});
    expect(result.issues).toEqual([
      { sectionId: 'evidence', ruleId: 'hasTags', field: null, messageKey: 'errors.noTags' },
    ]);
  });

  it('is valid with no sections at all', () => {
    expect(validateForm(FILLED, []).isValid).toBe(true);
  });

  describe('requiredFields', () => {
    it('lists the required fields of applicable sections, whether or not they are filled in', () => {
      expect(validateForm({ ...FILLED, name: '' }, SECTIONS).requiredFields).toEqual({
        kind: true,
        name: true,
        isConfirmed: true,
      });
    });

    it('leaves out the fields of a section that does not apply', () => {
      expect(validateForm({ ...FILLED, kind: 'simple' }, SECTIONS).requiredFields).toEqual({
        kind: true,
      });
    });

    it('counts any requirement-type validator, not just "required"', () => {
      const result = validateForm(FILLED, [
        { sectionId: 'evidence', fields: { count: [atLeast(1, 'errors.photoRequired')] } },
      ]);

      expect(result.requiredFields).toEqual({ count: true });
    });

    it('leaves out a field whose validators include no requirement', () => {
      const result = validateForm(FILLED, [
        {
          sectionId: 'optional',
          fields: {
            name: [
              { ruleId: 'maxLength', messageKey: 'errors.tooLong', isSatisfiedBy: () => true },
            ],
          },
        },
      ]);

      expect(result.requiredFields).toEqual({});
    });
  });
});
