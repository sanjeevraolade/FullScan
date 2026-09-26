import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROUTE,
  FE_MENU,
  FE_MENU_SECTIONS,
  findMenuItemByRoute,
} from '../public/fe/assets/js/menu.js';
import { renderIcon } from '../public/admin/assets/js/icons.js';

/**
 * The FE portal's DOM-free drawer registry. The shared drawer and router trust
 * this contract, so it is covered without a browser environment.
 */

describe('field executive drawer menu registry', () => {
  it('lists Profile then Cases, and nothing else', () => {
    expect(FE_MENU.map((item) => item.label)).toEqual(['Profile', 'Cases']);
  });

  it('lands on the first entry, Profile', () => {
    expect(DEFAULT_ROUTE).toBe('profile');
    expect(findMenuItemByRoute(DEFAULT_ROUTE)?.label).toBe('Profile');
  });

  it('resolves both routes, and an unknown route to nothing so the router can fall back', () => {
    expect(findMenuItemByRoute('profile')?.id).toBe('profile');
    expect(findMenuItemByRoute('cases')?.id).toBe('cases');
    expect(findMenuItemByRoute('mobile-app-settings')).toBeUndefined();
  });

  it('gives every entry the fields the shared drawer and router need', () => {
    for (const item of FE_MENU) {
      expect(item.id, 'id').toBeTypeOf('string');
      expect(item.route, `${item.id} route`).toBeTypeOf('string');
      expect(item.label, `${item.id} label`).toBeTypeOf('string');
      expect(item.title, `${item.id} title`).toBeTypeOf('string');
      expect(item.icon, `${item.id} icon`).toBeTypeOf('string');
      expect(item.loadPage, `${item.id} loadPage`).toBeTypeOf('function');
    }
  });

  it('keeps routes unique', () => {
    const routes = FE_MENU.map((item) => item.route);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('uses real icons, not the unknown-name fallback', () => {
    for (const item of FE_MENU) {
      expect(renderIcon(item.icon), item.id).not.toBe(renderIcon('no-such-icon'));
    }
  });

  it('renders as one unlabelled drawer section containing every entry', () => {
    expect(FE_MENU_SECTIONS).toEqual([{ label: null, items: FE_MENU }]);
  });
});
