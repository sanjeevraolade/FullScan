/**
 * ============================================================================
 * ADMIN DRAWER MENU REGISTRY — the extension point for the whole portal.
 * ============================================================================
 *
 * To add a page to the drawer:
 *
 *   1. Create `pages/<your-page>.js` exporting
 *        export async function render(container, context) { ... }
 *        export function destroy() { ... }        // optional cleanup
 *      `context` is `{ adminUser, setStatus }`.
 *   2. Add one entry to `ADMIN_MENU` below.
 *   3. Add an icon to `icons.js` if you need a new one.
 *
 * Nothing else changes: the drawer renders itself from this array, and the
 * router resolves and lazily imports the page module on first visit.
 *
 * Entry shape:
 *   id          unique key
 *   route       URL hash fragment (`#/<route>`)
 *   label       drawer text
 *   icon        name from `icons.js`
 *   title       topbar / page heading
 *   subtitle    optional one-line description under the heading
 *   section     optional drawer group label (entries without one come first)
 *   roles       optional array of admin roles allowed to see it; omit = all
 *   loadPage    () => import('./pages/<module>.js')
 *
 * Role access (see docs/super-admin-functionality.md):
 *   super_admin  Cases · Field Executive History · Device Change Requests · Add New Case · Mobile App Settings · Add New Admin
 *   admin        Cases · Field Executive History · Device Change Requests · Add New Case
 *
 * `roles` only hides the page. Any API it calls that must be restricted too needs
 * `requireAdminRole(...)` on the server — the drawer is not a security boundary.
 */

export const ADMIN_MENU = [
  {
    id: 'cases',
    route: 'cases',
    label: 'Cases',
    icon: 'briefcase',
    title: 'Cases',
    subtitle: 'Every case in the system, by workflow category — create new ones and edit existing ones.',
    section: 'Operations',
    loadPage: () => import('./pages/cases.js'),
  },
  {
    id: 'field-executive-history',
    route: 'field-executive-history',
    label: 'Field Executive History',
    icon: 'shield',
    title: 'Field Executive History',
    subtitle: 'Case-wise activity for one field executive, including every mock-location detection.',
    section: 'Operations',
    loadPage: () => import('./pages/field-executive-history.js'),
  },
  {
    id: 'device-change-requests',
    route: 'device-change-requests',
    label: 'Device Change Requests',
    icon: 'phone',
    title: 'Device Change Requests',
    subtitle: 'Field executives asking to use the FullScan app on another phone — approve or reject.',
    section: 'Operations',
    loadPage: () => import('./pages/device-change-requests.js'),
  },
  {
    id: 'new-case',
    route: 'new-case',
    label: 'Add New Case',
    icon: 'plus',
    title: 'Add New Case',
    subtitle: 'Create a case with one or more verification components, ready to be assigned.',
    section: 'Operations',
    loadPage: () => import('./pages/new-case.js'),
  },
  {
    id: 'mobile-app-settings',
    route: 'mobile-app-settings',
    label: 'Mobile App Settings',
    icon: 'sliders',
    title: 'Mobile App Settings',
    subtitle: 'Remote configuration the FullScan mobile app applies for every field executive.',
    section: 'Configuration',
    roles: ['super_admin'],
    loadPage: () => import('./pages/mobile-app-settings.js'),
  },
  {
    id: 'admin-users',
    route: 'admin-users',
    label: 'Add New Admin',
    icon: 'userPlus',
    title: 'Add New Admin',
    subtitle: 'Add admins by email, promote or demote them, and deactivate or delete accounts.',
    section: 'Administration',
    roles: ['super_admin'],
    loadPage: () => import('./pages/admin-users.js'),
  },
];

/** The registry's first route. Every role can see it today — prefer `getDefaultRoute(role)`. */
export const DEFAULT_ROUTE = ADMIN_MENU[0].route;

/** Menu entries the given admin role may see. */
export function getVisibleMenu(role) {
  return ADMIN_MENU.filter((item) => !item.roles || item.roles.includes(role));
}

/**
 * Where a role lands when the hash is empty or names a page it cannot open.
 * Always a route that role can see — falling back to a hidden route would make the
 * router redirect to it, fail to resolve it, and redirect again forever.
 */
export function getDefaultRoute(role) {
  const [first] = getVisibleMenu(role);
  return first ? first.route : DEFAULT_ROUTE;
}

export function findMenuItemByRoute(route, role) {
  return getVisibleMenu(role).find((item) => item.route === route);
}

/**
 * Groups visible entries into drawer sections, preserving registry order.
 * Ungrouped entries come first under no label.
 */
export function groupMenuBySection(role) {
  const sections = [];

  for (const item of getVisibleMenu(role)) {
    const label = item.section || null;
    let section = sections.find((candidate) => candidate.label === label);

    if (!section) {
      section = { label, items: [] };
      sections.push(section);
    }

    section.items.push(item);
  }

  return sections.sort((a, b) => (a.label === null ? -1 : b.label === null ? 1 : 0));
}
