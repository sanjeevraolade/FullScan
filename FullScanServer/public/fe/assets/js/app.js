/**
 * Field executive web portal shell bootstrap.
 *
 * The page is already gated server-side (`authenticateFeWebPage`), so reaching this
 * script means a valid session existed when the HTML was served. `GET /auth/me`
 * re-confirms it and supplies the drawer's account details; a 401 means the
 * session expired in between, and the API layer redirects to the login page.
 *
 * The drawer and hash router are the Admin Portal's shared modules, driven by this
 * portal's own menu registry (`menu.js`): Profile and Cases.
 */

import { feWebApi, ApiError, LOGIN_PATH } from './api.js';
import { DEFAULT_ROUTE, FE_MENU_SECTIONS, findMenuItemByRoute } from './menu.js';
import { createDrawer } from '/admin/assets/js/drawer.js';
import { createRouter } from '/admin/assets/js/router.js';
import { renderAlert } from '/admin/assets/js/dom.js';

const shell = document.querySelector('[data-shell]');
const bootAlert = shell.querySelector('[data-boot-alert]');

async function signOut(event) {
  const button = event.currentTarget;
  button.disabled = true;

  try {
    await feWebApi.logout();
  } catch {
    // The cookie is cleared by the server; if the call itself failed, leaving the
    // portal is still the right outcome.
  }

  window.location.replace(LOGIN_PATH);
}

async function startPortal() {
  let fieldExecutive;

  try {
    fieldExecutive = await feWebApi.getCurrentFieldExecutive();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return; // api.js is already navigating to the login page.
    }
    shell.querySelector('[data-outlet]').replaceChildren();
    renderAlert(bootAlert, {
      variant: 'error',
      message: error.message || 'The portal could not be loaded.',
    });
    return;
  }

  const drawer = createDrawer({
    shell,
    account: { name: fieldExecutive.name, subtitle: fieldExecutive.role },
    sections: FE_MENU_SECTIONS,
    onSignOut: signOut,
  });

  const router = createRouter({
    shell,
    drawer,
    findMenuItem: findMenuItemByRoute,
    defaultRoute: DEFAULT_ROUTE,
    appName: 'FullScan Field Executive',
    pageContext: { fieldExecutive },
  });

  await router.start();
}

startPortal();
