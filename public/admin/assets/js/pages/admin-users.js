/**
 * Add New Admin page — super admin only (menu `roles` + `requireAdminRole` on the API).
 *
 * Adding: a super admin enters a name, an email address and a role. The server
 * creates the account with the email as its sign-in and returns a one-time temporary
 * password, shown here exactly once — it is stored only as a bcrypt hash.
 *
 * Managing: every admin account is listed below the form, and each one other than
 * the signed-in super admin can be promoted/demoted, deactivated/reactivated or
 * deleted. The server refuses self-changes, and refuses to delete an account that
 * the audit trail points at (deactivate it instead).
 *
 * Actions repaint only the table, so anything typed into the form survives them.
 */

import { adminApi } from '../api.js';
import { escapeHtml, formatTimestamp } from '../dom.js';

const ROLE_OPTIONS = [
  {
    value: 'admin',
    label: 'Admin',
    access: 'Cases, Field Executive History and Add New Case.',
  },
  {
    value: 'super_admin',
    label: 'Super admin',
    access: 'Everything an admin can do, plus Mobile App Settings and managing admins.',
  },
];

/** Deliberately loose — the server's zod `email()` check is the authority. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createInitialState() {
  return {
    container: null,
    setStatus: () => {},
    currentAdminId: null,
    adminUsers: [],
    /** `{ adminUser, temporaryPassword }` from the last create, until dismissed. */
    created: null,
    isSaving: false,
    /** Id of the account an action is running on, so its buttons stay disabled. */
    busyAdminId: null,
  };
}

let state = createInitialState();

function roleLabel(role) {
  const option = ROLE_OPTIONS.find((candidate) => candidate.value === role);
  return option ? option.label : role;
}

function findAdmin(adminUserId) {
  return state.adminUsers.find((adminUser) => adminUser.id === adminUserId);
}

/* ---------------------------------------------------------------- markup */

function renderForm() {
  const roleOptions = ROLE_OPTIONS.map(
    (option) =>
      `<option value="${escapeHtml(option.value)}"${option.value === 'admin' ? ' selected' : ''}>${escapeHtml(
        option.label,
      )}</option>`,
  ).join('');

  const roleHints = ROLE_OPTIONS.map(
    (option) => `<strong>${escapeHtml(option.label)}:</strong> ${escapeHtml(option.access)}`,
  ).join('<br />');

  return `
    <form class="card" data-admin-form novalidate>
      <header class="card__header">
        <h2 class="card__title">New admin</h2>
        <p class="card__subtitle">Their email address becomes their sign-in. A temporary password is generated for you to share with them.</p>
      </header>
      <div class="card__body form-grid">
        <div class="field">
          <label class="field__label" for="admin-name">Full name</label>
          <input class="field__control" id="admin-name" name="name" type="text"
            autocomplete="off" maxlength="100" required data-admin-field="name" />
        </div>
        <div class="field">
          <label class="field__label" for="admin-email">Email address</label>
          <input class="field__control" id="admin-email" name="email" type="email"
            autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="254" required
            data-admin-field="email" />
        </div>
        <div class="field field--wide">
          <label class="field__label" for="admin-role">Role</label>
          <select class="field__control" id="admin-role" name="role" data-admin-field="role"
            aria-describedby="admin-role-hint">${roleOptions}</select>
          <p class="field__hint" id="admin-role-hint">${roleHints}</p>
        </div>
      </div>
      <footer class="card__footer">
        <button class="btn btn--primary" type="submit" data-save>Add admin</button>
      </footer>
    </form>`;
}

function renderCredentials() {
  const { created } = state;
  if (!created) {
    return '';
  }

  const { adminUser, temporaryPassword } = created;

  return `
    <section class="card card--success" data-credentials aria-labelledby="credentials-title">
      <header class="card__header">
        <h2 class="card__title" id="credentials-title">Sign-in details for ${escapeHtml(adminUser.name)}</h2>
        <p class="card__subtitle">Share these with them securely. <strong>The temporary password is shown only this once</strong> — it is stored encrypted and cannot be displayed again.</p>
      </header>
      <div class="card__body">
        <dl class="event__details credential__list">
          <div>
            <dt class="detail__label">Portal address</dt>
            <dd class="detail__value">${escapeHtml(`${window.location.origin}/admin/login`)}</dd>
          </div>
          <div>
            <dt class="detail__label">Sign-in email</dt>
            <dd class="detail__value">${escapeHtml(adminUser.email)}</dd>
          </div>
          <div>
            <dt class="detail__label">Role</dt>
            <dd class="detail__value">${escapeHtml(roleLabel(adminUser.role))}</dd>
          </div>
          <div>
            <dt class="detail__label">Temporary password</dt>
            <dd class="detail__value"><code class="credential__secret" data-temporary-password>${escapeHtml(
              temporaryPassword,
            )}</code></dd>
          </div>
        </dl>
      </div>
      <footer class="card__footer">
        <span class="actionbar__status" data-copy-status aria-live="polite"></span>
        <button class="btn" type="button" data-copy-password>Copy password</button>
        <button class="btn btn--primary" type="button" data-dismiss-credentials>Done</button>
      </footer>
    </section>`;
}

function renderActionButton(adminUser, action, label, { variant = '', value = '' } = {}) {
  const isBusy = state.busyAdminId === adminUser.id;

  return `<button class="btn btn--sm${variant ? ` ${variant}` : ''}" type="button"
    data-action="${action}" data-admin-id="${escapeHtml(adminUser.id)}" data-value="${escapeHtml(value)}"
    aria-label="${escapeHtml(`${label} — ${adminUser.name}`)}"${isBusy ? ' disabled' : ''}>${escapeHtml(label)}</button>`;
}

function renderActions(adminUser) {
  // The server refuses self-changes too; hiding them here just avoids offering one.
  if (adminUser.id === state.currentAdminId) {
    return '<span class="cell__muted">You</span>';
  }

  const isSuperAdmin = adminUser.role === 'super_admin';

  return `
    <div class="row-actions">
      ${renderActionButton(adminUser, 'role', isSuperAdmin ? 'Make admin' : 'Make super admin', {
        value: isSuperAdmin ? 'admin' : 'super_admin',
      })}
      ${renderActionButton(adminUser, 'status', adminUser.isActive ? 'Deactivate' : 'Reactivate', {
        value: adminUser.isActive ? 'false' : 'true',
      })}
      ${renderActionButton(adminUser, 'delete', 'Delete', { variant: 'btn--danger-ghost' })}
    </div>`;
}

function renderAdminRow(adminUser) {
  const lastLogin = formatTimestamp(adminUser.lastLoginAt);
  const createdAt = formatTimestamp(adminUser.createdAt);

  return `
    <tr>
      <td><span class="cell__strong">${escapeHtml(adminUser.name)}</span>
        ${adminUser.username !== adminUser.email ? `<span class="cell__muted">${escapeHtml(adminUser.username)}</span>` : ''}
      </td>
      <td>${escapeHtml(adminUser.email)}</td>
      <td><span class="badge badge--${escapeHtml(adminUser.role)}">${escapeHtml(roleLabel(adminUser.role))}</span></td>
      <td><span class="badge ${adminUser.isActive ? 'badge--completed' : 'badge--inactive'}">${
        adminUser.isActive ? 'Active' : 'Deactivated'
      }</span></td>
      <td><span class="cell__muted">${escapeHtml(lastLogin || 'Never')}</span></td>
      <td><span class="cell__muted">${escapeHtml(createdAt || '—')}</span></td>
      <td>${renderActions(adminUser)}</td>
    </tr>`;
}

function renderAdminTable() {
  const { adminUsers } = state;

  return `
    <header class="card__header">
      <h2 class="card__title" id="admin-list-title" tabindex="-1">Admin accounts</h2>
      <p class="card__subtitle">${adminUsers.length} account${adminUsers.length === 1 ? '' : 's'}. Role and status changes apply on the admin’s next action — no sign-out needed.</p>
    </header>
    <div class="table-wrap table-wrap--flush">
      <table class="table table--static table--actions">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Email</th>
            <th scope="col">Role</th>
            <th scope="col">Status</th>
            <th scope="col">Last sign-in</th>
            <th scope="col">Added</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>${adminUsers.map(renderAdminRow).join('')}</tbody>
      </table>
    </div>`;
}

function paint() {
  state.container.innerHTML = `
    ${renderCredentials()}
    ${renderForm()}
    <section class="card" data-admin-table aria-labelledby="admin-list-title">${renderAdminTable()}</section>`;
}

/** Repaints only the account table, leaving the form and credentials card as they are. */
function paintTable() {
  const table = state.container.querySelector('[data-admin-table]');
  if (table) {
    table.innerHTML = renderAdminTable();
  }
}

/* -------------------------------------------------------- adding an admin */

function readForm() {
  const read = (field) => {
    const input = state.container.querySelector(`[data-admin-field="${field}"]`);
    return input ? input.value.trim() : '';
  };

  return { name: read('name'), email: read('email'), role: read('role') || 'admin' };
}

function markInvalid(field) {
  const input = state.container.querySelector(`[data-admin-field="${field}"]`);
  if (input) {
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  }
}

function findFirstProblem({ name, email }) {
  if (name.length < 2) {
    return { field: 'name', message: 'Enter the new admin’s full name.' };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { field: 'email', message: 'Enter a valid email address.' };
  }
  return null;
}

async function createAdmin() {
  if (state.isSaving) {
    return;
  }

  for (const input of state.container.querySelectorAll('[data-admin-field]')) {
    input.removeAttribute('aria-invalid');
  }

  const payload = readForm();
  const problem = findFirstProblem(payload);

  if (problem) {
    state.setStatus({ variant: 'error', message: problem.message });
    markInvalid(problem.field);
    return;
  }

  const saveButton = state.container.querySelector('[data-save]');
  state.isSaving = true;
  saveButton.disabled = true;
  saveButton.textContent = 'Adding…';
  state.setStatus(null);

  try {
    const created = await adminApi.createAdminUser(payload);
    state.created = created;
    state.adminUsers = await adminApi.listAdminUsers();
    paint();
    state.setStatus({
      variant: 'success',
      message: `${created.adminUser.name} was added as ${roleLabel(created.adminUser.role).toLowerCase()}.`,
    });
    state.container.querySelector('[data-copy-password]')?.focus();
  } catch (error) {
    // The form is left as typed so a duplicate email can simply be corrected.
    state.setStatus({ variant: 'error', message: error.message });
    if (error.status === 409) {
      markInvalid('email');
    }
    saveButton.disabled = false;
    saveButton.textContent = 'Add admin';
  } finally {
    state.isSaving = false;
  }
}

async function copyTemporaryPassword() {
  const status = state.container.querySelector('[data-copy-status]');
  const secret = state.container.querySelector('[data-temporary-password]');

  try {
    await navigator.clipboard.writeText(state.created.temporaryPassword);
    status.textContent = 'Password copied.';
  } catch {
    // Clipboard access can be refused (permissions, insecure origin) — select it instead.
    const range = document.createRange();
    range.selectNodeContents(secret);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    status.textContent = 'Copy blocked by the browser — the password is selected, press Ctrl/Cmd+C.';
  }
}

/* ------------------------------------------------------ managing an admin */

/**
 * What each action asks before it runs, what it sends, and what it reports.
 * Reactivating restores access someone already had, so it is the one action that
 * does not ask first.
 */
function describeAction(action, value, adminUser) {
  const { name } = adminUser;

  if (action === 'role' && value === 'super_admin') {
    return {
      confirm: `Make ${name} a super admin?\n\nThey will be able to change Mobile App Settings and add, promote, deactivate or delete admins — including you.`,
      run: () => adminApi.updateAdminUser(adminUser.id, { role: 'super_admin' }),
      success: `${name} is now a super admin.`,
    };
  }

  if (action === 'role') {
    return {
      confirm: `Make ${name} an admin?\n\nThey lose access to Mobile App Settings and Add New Admin on their next action.`,
      run: () => adminApi.updateAdminUser(adminUser.id, { role: 'admin' }),
      success: `${name} is now an admin.`,
    };
  }

  if (action === 'status' && value === 'false') {
    return {
      confirm: `Deactivate ${name}?\n\nThey are signed out on their next action and cannot sign in until reactivated. Their history is kept.`,
      run: () => adminApi.updateAdminUser(adminUser.id, { isActive: false }),
      success: `${name} was deactivated.`,
    };
  }

  if (action === 'status') {
    return {
      confirm: null,
      run: () => adminApi.updateAdminUser(adminUser.id, { isActive: true }),
      success: `${name} was reactivated and can sign in again.`,
    };
  }

  return {
    confirm: `Permanently delete ${name} (${adminUser.email})?\n\nThis cannot be undone. To remove their access but keep their history, deactivate the account instead.`,
    run: () => adminApi.deleteAdminUser(adminUser.id),
    success: `${name} was deleted.`,
  };
}

/** Puts focus back on the same control after the table is rebuilt, or on its heading. */
function restoreFocus(adminUserId, action) {
  const button = state.container.querySelector(
    `[data-admin-id="${CSS.escape(adminUserId)}"][data-action="${action}"]`,
  );
  (button || state.container.querySelector('#admin-list-title'))?.focus();
}

async function runAdminAction(button) {
  const { action, adminId, value } = button.dataset;
  const adminUser = findAdmin(adminId);

  if (!adminUser || state.busyAdminId) {
    return;
  }

  const plan = describeAction(action, value, adminUser);
  if (plan.confirm && !window.confirm(plan.confirm)) {
    return;
  }

  state.busyAdminId = adminId;
  paintTable();
  state.setStatus(null);

  try {
    await plan.run();

    if (action === 'delete' && state.created?.adminUser.id === adminId) {
      state.created = null;
      state.container.querySelector('[data-credentials]')?.remove();
    }

    state.setStatus({ variant: 'success', message: plan.success });
  } catch (error) {
    state.setStatus({ variant: 'error', message: error.message });
  } finally {
    // Reload either way: after a failure the list may still have moved on (for
    // example another super admin already deleted the account).
    state.busyAdminId = null;
    try {
      state.adminUsers = await adminApi.listAdminUsers();
    } catch {
      // Keep the last known list; the alert above already says what went wrong.
    }
    paintTable();
    restoreFocus(adminId, action);
  }
}

/* ------------------------------------------------------------- listeners */

function onClick(event) {
  const actionButton = event.target.closest('[data-action]');
  if (actionButton) {
    runAdminAction(actionButton);
    return;
  }

  if (event.target.closest('[data-copy-password]')) {
    copyTemporaryPassword();
    return;
  }

  if (event.target.closest('[data-dismiss-credentials]')) {
    // Only the credentials card goes; anything typed into the form stays.
    state.created = null;
    state.container.querySelector('[data-credentials]')?.remove();
    state.setStatus(null);
  }
}

function onSubmit(event) {
  if (!event.target.closest('[data-admin-form]')) {
    return;
  }
  event.preventDefault();
  createAdmin();
}

/* ----------------------------------------------------------- page module */

export async function render(container, { adminUser, setStatus }) {
  state = createInitialState();
  state.container = container;
  state.setStatus = setStatus;
  state.currentAdminId = adminUser.id;

  state.adminUsers = await adminApi.listAdminUsers();

  container.addEventListener('click', onClick);
  container.addEventListener('submit', onSubmit);

  paint();
}

export function destroy() {
  // Drops the temporary password from memory as soon as the admin leaves the page.
  state = createInitialState();
}
