import { describe, expect, it } from 'vitest';
import {
  ADMIN_MENU,
  DEFAULT_ROUTE,
  findMenuItemByRoute,
  getVisibleMenu,
  groupMenuBySection,
} from '../public/admin/assets/js/menu.js';
import { escapeHtml } from '../public/admin/assets/js/dom.js';
import { renderIcon } from '../public/admin/assets/js/icons.js';

/**
 * The portal's DOM-free modules. These carry the drawer's extensibility contract
 * and its HTML escaping, so they are worth covering without pulling in a
 * browser environment.
 */

describe('drawer menu registry', () => {
  it('ships Mobile App Settings as the default route', () => {
    expect(DEFAULT_ROUTE).toBe('mobile-app-settings');
    expect(findMenuItemByRoute('mobile-app-settings', 'admin')?.label).toBe(
      'Mobile App Settings',
    );
  });

  it('gives every entry the fields the drawer and router need', () => {
    for (const item of ADMIN_MENU) {
      expect(item.id, 'id').toBeTypeOf('string');
      expect(item.route, `${item.id} route`).toBeTypeOf('string');
      expect(item.label, `${item.id} label`).toBeTypeOf('string');
      expect(item.title, `${item.id} title`).toBeTypeOf('string');
      expect(item.icon, `${item.id} icon`).toBeTypeOf('string');
      expect(item.loadPage, `${item.id} loadPage`).toBeTypeOf('function');
    }
  });

  it('keeps route ids unique so the router cannot be ambiguous', () => {
    const routes = ADMIN_MENU.map((item) => item.route);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('resolves an unknown route to nothing, so the router can fall back', () => {
    expect(findMenuItemByRoute('not-a-page', 'super_admin')).toBeUndefined();
  });

  it('shows unrestricted entries to every role', () => {
    // No shipped entry declares `roles`, so both roles see the whole registry.
    expect(getVisibleMenu('admin').map((item) => item.id)).toEqual(
      ADMIN_MENU.map((item) => item.id),
    );
    expect(getVisibleMenu('super_admin').length).toBe(ADMIN_MENU.length);
  });

  it('honours `roles` on an entry that declares it', () => {
    const restricted = ADMIN_MENU.filter((item) => item.roles);

    for (const item of restricted) {
      const deniedRole = ['admin', 'super_admin'].find((role) => !item.roles.includes(role));
      if (deniedRole) {
        expect(findMenuItemByRoute(item.route, deniedRole), item.id).toBeUndefined();
      }
      expect(findMenuItemByRoute(item.route, item.roles[0]), item.id).toBeDefined();
    }
  });

  it('groups entries into sections, ungrouped ones first', () => {
    const sections = groupMenuBySection('super_admin');

    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].label).toBeNull();
    expect(sections[0].items.map((item) => item.id)).toContain('mobile-app-settings');
  });
});

describe('escapeHtml', () => {
  it('neutralises markup in admin-authored values', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('escapes both quote styles so attribute interpolation is safe', () => {
    expect(escapeHtml('" onload="x')).toBe('&quot; onload=&quot;x');
    expect(escapeHtml("' onload='x")).toBe('&#39; onload=&#39;x');
  });

  it('renders null and undefined as empty strings, not "null"', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('leaves ordinary text untouched', () => {
    expect(escapeHtml('Geo-fence radius (metres)')).toBe('Geo-fence radius (metres)');
  });
});

describe('renderIcon', () => {
  it('returns inline SVG at the requested size', () => {
    const svg = renderIcon('logout', 24);

    expect(svg).toContain('<svg');
    expect(svg).toContain('width="24"');
    expect(svg).toContain('aria-hidden="true"');
  });

  it('falls back to a known icon rather than emitting an empty SVG', () => {
    expect(renderIcon('no-such-icon')).toBe(renderIcon('sliders'));
  });

  it('has an icon for every menu entry', () => {
    for (const item of ADMIN_MENU) {
      expect(renderIcon(item.icon), item.id).toBe(renderIcon(item.icon));
      expect(renderIcon(item.icon)).not.toBe('');
    }
  });
});
