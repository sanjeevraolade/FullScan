import { describe, expect, it } from 'vitest';
import { toSafeAppRoute } from './safe-next-path';

describe('toSafeAppRoute', () => {
  it.each([
    ['/admin-app', '/'],
    ['/admin-app/', '/'],
    ['/admin-app/cases', '/cases'],
    ['/admin-app/cases/case-0001?tab=evidence', '/cases/case-0001?tab=evidence'],
    ['/admin-app?bucket=pending', '/?bucket=pending'],
  ])('follows in-app path %s', (next, expected) => {
    expect(toSafeAppRoute(next)).toBe(expected);
  });

  it.each([
    null,
    '',
    'https://evil.example/admin-app',
    '//evil.example/admin-app',
    '/admin-app//evil.example',
    '/\\evil.example',
    '/admin-app/\\evil.example',
    '/admin-app%2F%2Fevil.example',
    '/admin-app/%5Cevil.example',
    '/fe',
    '/app',
    '/admin',
    '/admin-application',
    'admin-app/cases',
    'javascript:alert(1)',
    `/admin-app/${'a'.repeat(3000)}`,
  ])('rejects %s', (next) => {
    expect(toSafeAppRoute(next)).toBeNull();
  });

  it('rejects control characters', () => {
    expect(toSafeAppRoute(`/admin-app/cases${String.fromCharCode(10)}x`)).toBeNull();
  });

  it('never loops back to the login page', () => {
    expect(toSafeAppRoute('/admin-app/login')).toBe('/');
    expect(toSafeAppRoute('/admin-app/login?next=admin-app')).toBe('/');
    // Encoded slashes are refused outright; the login page then falls back to the dashboard.
    expect(toSafeAppRoute('/admin-app/login?next=%2Fapp')).toBeNull();
  });
});
