/**
 * ============================================================================
 * FIELD EXECUTIVE DRAWER MENU REGISTRY
 * ============================================================================
 *
 * Same contract as the Admin Portal's `menu.js`, and rendered by the same shared
 * drawer and router (`/admin/assets/js/drawer.js`, `router.js`). To add a page:
 *
 *   1. Create `pages/<your-page>.js` exporting
 *        export async function render(container, context) { ... }
 *        export function destroy() { ... }        // optional cleanup
 *      `context` is `{ fieldExecutive, setStatus }`.
 *   2. Add one entry to `FE_MENU` below.
 *   3. Add an icon to `/admin/assets/js/icons.js` if you need a new one.
 *
 * Every field executive sees every entry — there are no roles to filter by.
 * The drawer is not a security boundary: each page's API is guarded server-side.
 */

export const FE_MENU = [
  {
    id: 'profile',
    route: 'profile',
    label: 'Profile',
    icon: 'user',
    title: 'Profile',
    subtitle: 'Your FullScan account details and the phone you use the FullScan app on.',
    loadPage: () => import('./pages/profile.js'),
  },
  {
    id: 'cases',
    route: 'cases',
    label: 'Cases',
    icon: 'briefcase',
    title: 'Cases',
    subtitle: 'Your Pending, Beyond TAT and Completed cases. Case work is done in the FullScan app.',
    loadPage: () => import('./pages/cases.js'),
  },
];

/** Where a field executive lands when the hash is empty or unknown: the first entry. */
export const DEFAULT_ROUTE = FE_MENU[0].route;

/** The drawer renders one unlabelled section — two entries need no grouping. */
export const FE_MENU_SECTIONS = [{ label: null, items: FE_MENU }];

export function findMenuItemByRoute(route) {
  return FE_MENU.find((item) => item.route === route);
}
