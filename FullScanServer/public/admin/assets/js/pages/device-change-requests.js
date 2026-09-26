/**
 * Device Change Requests page — both admin roles.
 *
 * Field executives request a device change from the web portal. Approving one
 * releases their device binding, so they can sign in to the FullScan app on any
 * phone (their current one included) and that phone becomes bound. Rejecting leaves
 * the binding as it is. Nothing is deleted: every request, decision and the phone
 * that followed stays listed.
 */

import { adminApi } from '../api.js';
import { escapeHtml, formatTimestamp } from '../dom.js';
import {
  describeDevice,
  renderDecision,
  renderDeviceCell,
  renderNewDeviceCell,
  renderRequestStatusBadge,
} from '../device-change.js';

const TABS = [
  { status: 'pending', label: 'Pending', countKey: 'pending' },
  { status: 'approved', label: 'Approved', countKey: 'approved' },
  { status: 'rejected', label: 'Rejected', countKey: 'rejected' },
  { status: '', label: 'All', countKey: 'all' },
];

const EMPTY_MESSAGES = {
  pending: 'No device change requests are waiting for a decision.',
  approved: 'No approved device change requests.',
  rejected: 'No rejected device change requests.',
  '': 'No device change requests yet.',
};

const NOTE_MAX_LENGTH = 500;

function createInitialState() {
  return {
    container: null,
    setStatus: () => {},
    status: 'pending',
    list: null,
    /** Id of the request an action is running on — all action buttons wait for it. */
    busyRequestId: null,
  };
}

let state = createInitialState();

/* ---------------------------------------------------------------- markup */

function renderTabs() {
  const { counts } = state.list;

  return `
    <div class="tabs" role="tablist">
      ${TABS.map(
        (tab) => `
          <button
            class="tab${tab.status === state.status ? ' tab--active' : ''}"
            type="button"
            role="tab"
            aria-selected="${tab.status === state.status}"
            data-status-tab="${escapeHtml(tab.status)}"
          >
            ${escapeHtml(tab.label)}<span class="tab__count">${counts[tab.countKey]}</span>
          </button>`,
      ).join('')}
    </div>`;
}

function renderActions(item) {
  if (item.status !== 'pending') {
    return '<span class="cell__muted">—</span>';
  }

  const disabled = state.busyRequestId ? ' disabled' : '';

  return `
    <div class="row-actions">
      <button class="btn btn--primary btn--sm" type="button" data-approve="${escapeHtml(item.id)}"${disabled}>Approve</button>
      <button class="btn btn--danger-ghost btn--sm" type="button" data-reject="${escapeHtml(item.id)}"${disabled}>Reject</button>
    </div>`;
}

function renderRow(item) {
  return `
    <tr>
      <td>
        <span class="cell__strong">${escapeHtml(item.fieldExecutive.name)}</span>
        <span class="cell__muted">${escapeHtml(item.fieldExecutive.username)}</span>
      </td>
      <td>${renderDeviceCell(item.deviceAtRequest)}</td>
      <td class="cell__wrap">${item.reason ? escapeHtml(item.reason) : '<span class="cell__muted">—</span>'}</td>
      <td><span class="cell__muted">${escapeHtml(formatTimestamp(item.requestedAt) || '—')}</span></td>
      <td>${renderRequestStatusBadge(item.status)}${renderDecision(item, { showDecidedBy: true })}</td>
      <td>${renderNewDeviceCell(item)}</td>
      <td>${renderActions(item)}</td>
    </tr>`;
}

function paint() {
  const { items } = state.list;

  const body =
    items.length === 0
      ? `<div class="state">${escapeHtml(EMPTY_MESSAGES[state.status])}</div>`
      : `
        <div class="table-wrap">
          <table class="table table--static">
            <thead>
              <tr>
                <th scope="col">Field executive</th>
                <th scope="col">Phone at request</th>
                <th scope="col">Reason</th>
                <th scope="col">Requested</th>
                <th scope="col">Status</th>
                <th scope="col">New phone</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>${items.map(renderRow).join('')}</tbody>
          </table>
        </div>`;

  state.container.innerHTML = `${renderTabs()}${body}`;
}

/* ----------------------------------------------------------------- actions */

async function load() {
  state.list = await adminApi.listDeviceChangeRequests({ status: state.status });
  paint();
}

async function reloadQuietly() {
  try {
    await load();
  } catch (error) {
    state.setStatus({ variant: 'error', message: error.message });
  }
}

function findItem(requestId) {
  return state.list.items.find((item) => item.id === requestId);
}

async function runDecision(requestId, decide, successMessage) {
  state.busyRequestId = requestId;
  state.setStatus(null);
  paint();

  try {
    await decide();
    state.setStatus({ variant: 'success', message: successMessage });
  } catch (error) {
    state.setStatus({ variant: 'error', message: error.message });
  } finally {
    state.busyRequestId = null;
    await reloadQuietly();
  }
}

function approve(item) {
  const phone = describeDevice(item.deviceAtRequest).title;
  const isConfirmed = window.confirm(
    `Approve the device change for ${item.fieldExecutive.name}?\n\n` +
      `Their account will be unlinked from ${phone}. They can then sign in to the FullScan app on any phone, including ${phone}, and that phone becomes linked.`,
  );

  if (!isConfirmed) {
    return;
  }

  runDecision(
    item.id,
    () => adminApi.approveDeviceChangeRequest(item.id),
    `Approved. ${item.fieldExecutive.name} can now sign in to the FullScan app on any phone.`,
  );
}

function reject(item) {
  const note = window.prompt(
    `Reject the device change for ${item.fieldExecutive.name}?\n\nAdd a note for them (optional). Their current phone stays linked.`,
    '',
  );

  if (note === null) {
    return;
  }

  if (note.trim().length > NOTE_MAX_LENGTH) {
    state.setStatus({ variant: 'error', message: `The note must be ${NOTE_MAX_LENGTH} characters or fewer.` });
    return;
  }

  runDecision(
    item.id,
    () => adminApi.rejectDeviceChangeRequest(item.id, note.trim()),
    `Rejected. ${item.fieldExecutive.name}'s current phone stays linked.`,
  );
}

function onClick(event) {
  const tab = event.target.closest('[data-status-tab]');
  if (tab) {
    state.status = tab.dataset.statusTab;
    state.setStatus(null);
    reloadQuietly();
    return;
  }

  const approveButton = event.target.closest('[data-approve]');
  if (approveButton && !state.busyRequestId) {
    const item = findItem(approveButton.dataset.approve);
    if (item) {
      approve(item);
    }
    return;
  }

  const rejectButton = event.target.closest('[data-reject]');
  if (rejectButton && !state.busyRequestId) {
    const item = findItem(rejectButton.dataset.reject);
    if (item) {
      reject(item);
    }
  }
}

/* -------------------------------------------------------------- page module */

export async function render(container, { setStatus }) {
  state = createInitialState();
  state.container = container;
  state.setStatus = setStatus;

  container.addEventListener('click', onClick);
  await load();
}

export function destroy() {
  state = createInitialState();
}
