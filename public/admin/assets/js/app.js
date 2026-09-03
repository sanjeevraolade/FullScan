/**
 * Admin Portal shell bootstrap.
 *
 * The page itself is already gated server-side (`authenticateAdminPage`), so
 * reaching this script means a valid session existed when the HTML was served.
 * `GET /auth/me` re-confirms it client-side and supplies the drawer's account
 * details; a 401 here means the session expired between page load and now, and
 * the API layer redirects to the login page.
 */

import { adminApi, ApiError, LOGIN_PATH } from './api.js';
import { createDrawer } from './drawer.js';
import { createRouter } from './router.js';
import { renderAlert } from './dom.js';

const shell = document.querySelector('[data-shell]');
const bootAlert = shell.querySelector('[data-boot-alert]');

async function signOut(event) {
  const button = event.currentTarget;
  button.disabled = true;

  try {
    await adminApi.logout();
  } catch {
    // The cookie is cleared by the server; if the call itself failed there is
    // nothing useful to show — leaving the portal is still the right outcome.
  }

  window.location.replace(LOGIN_PATH);
}

async function startPortal() {
  let adminUser;

  try {
    adminUser = await adminApi.getCurrentAdmin();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return; // api.js is already navigating to the login page.
    }
    renderAlert(bootAlert, {
      variant: 'error',
      message: error.message || 'The portal could not be loaded.',
    });
    return;
  }

  const drawer = createDrawer({ shell, adminUser, onSignOut: signOut });
  const router = createRouter({ shell, adminUser, drawer });

  await router.start();
}

startPortal();
