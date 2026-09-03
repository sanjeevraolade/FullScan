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
 */

export const ADMIN_MENU = [
  {
    id: 'mobile-app-settings',
    route: 'mobile-app-settings',
    label: 'Mobile App Settings',
    icon: 'sliders',
    title: 'Mobile App Settings',
    subtitle: 'Remote configuration the FullScan mobile app applies for every field executive.',
    loadPage: () => import('./pages/mobile-app-settings.js'),
  },

  // Future pages drop in here, e.g.:
  // {
  //   id: 'field-executives',
  //   route: 'field-executives',
  //   label: 'Field Executives',
  //   icon: 'users',
  //   title: 'Field Executives',
  //   section: 'Operations',
  //   roles: ['super_admin'],
  //   loadPage: () => import('./pages/field-executives.js'),
  // },
];

/** Route shown when the hash is empty or unrecognised. */
export const DEFAULT_ROUTE = ADMIN_MENU[0].route;

/** Menu entries the given admin role may see. */
export function getVisibleMenu(role) {
  return ADMIN_MENU.filter((item) => !item.roles || item.roles.includes(role));
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
