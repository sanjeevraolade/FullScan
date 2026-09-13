/**
 * Navigation drawer.
 *
 * Docked permanently at >=1024px and off-canvas below that (CSS decides which);
 * this module only owns the open/closed state, the markup built from the menu
 * sections it is given, and the pinned Logout action at the bottom.
 *
 * Shared by both browser portals: the Admin Portal and the Field Executive web
 * portal each pass their own account details and menu sections.
 */

import { renderIcon } from './icons.js';
import { escapeHtml } from './dom.js';

const MOBILE_BREAKPOINT = '(max-width: 1023px)';

/** Initials for the account avatar — first letters of the first two words. */
function toInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

/** `sections` is `[{ label: string | null, items: [{ route, icon, label }] }]`. */
function renderMenuMarkup(sections) {
  return sections
    .map((section) => {
      const label = section.label
        ? `<p class="drawer__section-label">${escapeHtml(section.label)}</p>`
        : '';

      const items = section.items
        .map(
          (item) => `
            <li class="drawer__item">
              <a class="drawer__link" href="#/${item.route}" data-route="${item.route}">
                ${renderIcon(item.icon)}
                <span>${escapeHtml(item.label)}</span>
              </a>
            </li>`,
        )
        .join('');

      return `${label}<ul class="drawer__list">${items}</ul>`;
    })
    .join('');
}

/**
 * @param {object} options
 * @param {HTMLElement} options.shell
 * @param {{ name: string, subtitle: string }} options.account  Drawer header account block.
 * @param {Array} options.sections  Menu sections to render, in order.
 * @param {(event: Event) => void} options.onSignOut
 */
export function createDrawer({ shell, account, sections, onSignOut }) {
  const drawer = shell.querySelector('[data-drawer]');
  const nav = shell.querySelector('[data-drawer-nav]');
  const scrim = shell.querySelector('[data-scrim]');
  const toggleButton = shell.querySelector('[data-drawer-toggle]');
  const closeButton = shell.querySelector('[data-drawer-close]');
  const logoutButton = shell.querySelector('[data-logout]');
  const mobileQuery = window.matchMedia(MOBILE_BREAKPOINT);

  shell.querySelector('[data-account-avatar]').textContent = toInitials(account.name);
  shell.querySelector('[data-account-name]').textContent = account.name;
  shell.querySelector('[data-account-role]').textContent = account.subtitle;

  nav.innerHTML = renderMenuMarkup(sections);
  logoutButton.insertAdjacentHTML('afterbegin', renderIcon('logout'));
  toggleButton.innerHTML = renderIcon('menu', 20);
  closeButton.innerHTML = renderIcon('close', 20);

  function isOpen() {
    return shell.classList.contains('is-drawer-open');
  }

  function setOpen(open) {
    shell.classList.toggle('is-drawer-open', open);
    toggleButton.setAttribute('aria-expanded', String(open));
    // Hidden off-canvas content must be out of the tab order too.
    drawer.toggleAttribute('inert', mobileQuery.matches && !open);
  }

  function close() {
    setOpen(false);
  }

  toggleButton.addEventListener('click', () => setOpen(!isOpen()));
  closeButton.addEventListener('click', close);
  scrim.addEventListener('click', close);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      close();
      toggleButton.focus();
    }
  });

  // Following a menu link on a narrow screen should reveal the page, not leave
  // the drawer covering it.
  nav.addEventListener('click', (event) => {
    if (event.target.closest('.drawer__link') && mobileQuery.matches) {
      close();
    }
  });

  logoutButton.addEventListener('click', onSignOut);

  // Crossing the breakpoint resets state: docked drawers are never "closed".
  mobileQuery.addEventListener('change', () => setOpen(false));
  setOpen(false);

  return {
    close,
    /** Marks the drawer link for `route` as the current page. */
    setActiveRoute(route) {
      for (const link of nav.querySelectorAll('.drawer__link')) {
        if (link.dataset.route === route) {
          link.setAttribute('aria-current', 'page');
        } else {
          link.removeAttribute('aria-current');
        }
      }
    },
  };
}
