import { describe, expect, it } from 'vitest';
import { MAX_EVIDENCE_FILE_BYTES, MAX_EVIDENCE_FILES } from '../types/evidence';
import { validateEvidenceSelection, validateLoginForm } from './validation';

describe('validateLoginForm', () => {
  it('trims the username and accepts valid credentials', () => {
    expect(validateLoginForm({ username: '  fe001 ', password: 'Password123!' })).toEqual({
      isValid: true,
      value: { username: 'fe001', password: 'Password123!' },
    });
  });

  it('reports each missing field', () => {
    const result = validateLoginForm({ username: '   ', password: '' });

    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errors.username).toBe('Enter your username');
      expect(result.errors.password).toBe('Enter your password');
    }
  });

  it('matches the server length limits', () => {
    const result = validateLoginForm({ username: 'u'.repeat(101), password: 'p'.repeat(201) });

    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errors.username).toBeDefined();
      expect(result.errors.password).toBeDefined();
    }
  });
});

describe('validateEvidenceSelection', () => {
  const image = (name: string, size = 1024, type = 'image/jpeg') => ({ name, size, type });

  it('accepts JPEG, PNG and WebP images within the limits', () => {
    expect(
      validateEvidenceSelection([image('a.jpg'), image('b.png', 10, 'image/png'), image('c.webp', 10, 'image/webp')]),
    ).toEqual([]);
  });

  it('rejects other types, empty files and oversized files by name', () => {
    const errors = validateEvidenceSelection([
      image('doc.pdf', 10, 'application/pdf'),
      image('empty.jpg', 0),
      image('huge.jpg', MAX_EVIDENCE_FILE_BYTES + 1),
    ]);

    expect(errors.some((message) => message.startsWith('doc.pdf'))).toBe(true);
    expect(errors.some((message) => message.startsWith('empty.jpg'))).toBe(true);
    expect(errors.some((message) => message.startsWith('huge.jpg'))).toBe(true);
  });

  it('limits how many files go in one upload', () => {
    const files = Array.from({ length: MAX_EVIDENCE_FILES + 1 }, (_, index) => image(`${index}.jpg`));

    expect(validateEvidenceSelection(files)).toEqual([`Upload at most ${MAX_EVIDENCE_FILES} images at a time`]);
  });
});
