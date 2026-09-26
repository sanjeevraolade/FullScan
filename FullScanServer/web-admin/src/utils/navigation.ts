import type { AdminRole } from '../types/auth';

export type NavIcon = 'briefcase' | 'shield' | 'phone' | 'plus' | 'sliders' | 'userPlus';

export interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly icon: NavIcon;
  readonly section: 'Operations' | 'Configuration' | 'Administration';
  /** Roles that may open the page; omitted = every admin role. */
  readonly roles?: readonly AdminRole[];
}

/**
 * The admin menu — same pages and role rules as the static portal's `menu.js`.
 * `roles` only hides pages; every restricted API is also guarded by
 * `requireAdminRole` on the server. The menu is not a security boundary.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/cases', label: 'Cases', icon: 'briefcase', section: 'Operations' },
  { path: '/field-executive-history', label: 'Field Executive History', icon: 'shield', section: 'Operations' },
  { path: '/device-change-requests', label: 'Device Change Requests', icon: 'phone', section: 'Operations' },
  { path: '/cases/new', label: 'Add New Case', icon: 'plus', section: 'Operations' },
  {
    path: '/mobile-app-settings',
    label: 'Mobile App Settings',
    icon: 'sliders',
    section: 'Configuration',
    roles: ['super_admin'],
  },
  { path: '/admin-users', label: 'Add New Admin', icon: 'userPlus', section: 'Administration', roles: ['super_admin'] },
];

export function canAccess(item: Pick<NavItem, 'roles'>, role: AdminRole): boolean {
  return !item.roles || item.roles.includes(role);
}

export interface NavSection {
  readonly label: NavItem['section'];
  readonly items: readonly NavItem[];
}

export function getNavSections(role: AdminRole): readonly NavSection[] {
  const sections: { label: NavItem['section']; items: NavItem[] }[] = [];
  for (const item of NAV_ITEMS.filter((candidate) => canAccess(candidate, role))) {
    const section = sections.find((candidate) => candidate.label === item.section);
    if (section) {
      section.items.push(item);
    } else {
      sections.push({ label: item.section, items: [item] });
    }
  }
  return sections;
}
