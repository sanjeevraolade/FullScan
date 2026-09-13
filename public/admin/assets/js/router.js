/**
 * Hash router over the drawer menu registry.
 *
 * Page modules are imported lazily on first visit and cached, so adding a page
 * costs nothing until an admin opens it. The previous page's `destroy()` runs
 * before the next one renders.
 */

import { findMenuItemByRoute, getDefaultRoute } from './menu.js';
import { escapeHtml, renderAlert } from './dom.js';

/** `#/mobile-app-settings` -> `mobile-app-settings` */
function readRouteFromHash(defaultRoute) {
  return window.location.hash.replace(/^#\/?/, '').split('?')[0] || defaultRoute;
}

export function createRouter({ shell, adminUser, drawer }) {
  // Role-aware: an admin must never be sent to a page only a super admin can open.
  const defaultRoute = getDefaultRoute(adminUser.role);
  const outlet = shell.querySelector('[data-outlet]');
  const topbarTitle = shell.querySelector('[data-topbar-title]');
  const pageHeader = shell.querySelector('[data-page-header]');
  const pageAlert = shell.querySelector('[data-page-alert]');
  const moduleCache = new Map();

  let activePage = null;
  let renderToken = 0;

  function setStatus(alert) {
    renderAlert(pageAlert, alert);
  }

  async function loadPageModule(item) {
    if (!moduleCache.has(item.id)) {
      moduleCache.set(item.id, await item.loadPage());
    }
    return moduleCache.get(item.id);
  }

  async function renderRoute() {
    const route = readRouteFromHash(defaultRoute);
    const item = findMenuItemByRoute(route, adminUser.role);

    // Unknown or not-permitted route: fall back to the default page rather than
    // leaving the admin on a blank screen. Rewriting the hash re-enters here.
    if (!item) {
      window.location.replace(`#/${defaultRoute}`);
      return;
    }

    const token = ++renderToken;

    if (activePage && typeof activePage.destroy === 'function') {
      activePage.destroy();
    }
    activePage = null;

    document.title = `${item.title} · FullScan Admin`;
    topbarTitle.textContent = item.title;
    drawer.setActiveRoute(item.route);
    setStatus(null);

    pageHeader.hidden = false;
    pageHeader.innerHTML = `
      <h1 class="page-header__title">${escapeHtml(item.title)}</h1>
      ${item.subtitle ? `<p class="page-header__subtitle">${escapeHtml(item.subtitle)}</p>` : ''}`;

    outlet.innerHTML = '<div class="state"><span class="spinner"></span></div>';

    try {
      const pageModule = await loadPageModule(item);

      // A faster click may have superseded this render — drop the stale one.
      if (token !== renderToken) {
        return;
      }

      const container = document.createElement('div');
      outlet.replaceChildren(container);

      await pageModule.render(container, { adminUser, setStatus });
      activePage = pageModule;
    } catch (error) {
      if (token !== renderToken) {
        return;
      }
      outlet.replaceChildren();
      setStatus({ variant: 'error', message: error.message || 'This page failed to load.' });
    }
  }

  return {
    start() {
      window.addEventListener('hashchange', renderRoute);

      if (!window.location.hash) {
        window.location.replace(`#/${defaultRoute}`);
        return;
      }

      return renderRoute();
    },
  };
}
