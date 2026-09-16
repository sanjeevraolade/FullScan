import { describe, expect, it } from 'vitest';
import { toSafeAppRoute } from './safe-next-path';

describe('toSafeAppRoute', () => {
  it.each([
    ['/app', '/'],
    ['/app/', '/'],
    ['/app/assignments', '/assignments'],
    ['/app/assignments/abc-123?tab=evidence', '/assignments/abc-123?tab=evidence'],
    ['/app?bucket=pending', '/?bucket=pending'],
  ])('follows in-app path %s', (next, expected) => {
    expect(toSafeAppRoute(next)).toBe(expected);
  });

  it.each([
    null,
    '',
    'https://evil.example/app',
    '//evil.example/app',
    '/app//evil.example',
    '/\\evil.example',
    '/app/\\evil.example',
    '/app%2F%2Fevil.example',
    '/app/%5Cevil.example',
    '/fe',
    '/admin',
    '/application',
    'app/assignments',
    'javascript:alert(1)',
    `/app/${'a'.repeat(3000)}`,
  ])('rejects %s', (next) => {
    expect(toSafeAppRoute(next)).toBeNull();
  });

  it('rejects control characters', () => {
    expect(toSafeAppRoute(`/app/assignments${String.fromCharCode(10)}x`)).toBeNull();
  });

  it('never loops back to the login page', () => {
    expect(toSafeAppRoute('/app/login')).toBe('/');
    expect(toSafeAppRoute('/app/login?next=app')).toBe('/');
    // Encoded slashes are refused outright; the login page then falls back to the dashboard.
    expect(toSafeAppRoute('/app/login?next=%2Fapp')).toBeNull();
  });
});
