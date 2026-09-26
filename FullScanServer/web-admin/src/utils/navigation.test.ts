import { describe, expect, it } from 'vitest';
import { canAccess, getNavSections, NAV_ITEMS } from './navigation';

describe('admin navigation', () => {
  it('shows super admins every page, grouped in portal order', () => {
    expect(getNavSections('super_admin').map((section) => [section.label, section.items.map((item) => item.label)])).toEqual([
      ['Operations', ['Cases', 'Field Executive History', 'Device Change Requests', 'Add New Case']],
      ['Configuration', ['Mobile App Settings']],
      ['Administration', ['Add New Admin']],
    ]);
  });

  it('hides super-admin pages from admins', () => {
    const labels = getNavSections('admin').flatMap((section) => section.items.map((item) => item.label));

    expect(labels).toEqual(['Cases', 'Field Executive History', 'Device Change Requests', 'Add New Case']);
    expect(NAV_ITEMS.filter((item) => !canAccess(item, 'admin')).map((item) => item.path)).toEqual([
      '/mobile-app-settings',
      '/admin-users',
    ]);
  });

  it('has unique paths', () => {
    expect(new Set(NAV_ITEMS.map((item) => item.path)).size).toBe(NAV_ITEMS.length);
  });
});
