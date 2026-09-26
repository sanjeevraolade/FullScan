/**
 * Device change rendering shared by the Admin Portal (Device Change Requests page,
 * Field Executive History) and the Field Executive web portal (Profile).
 *
 * Device values are whatever a handset reported, and reasons/notes are typed by
 * people — every value is escaped at interpolation.
 */

import { escapeHtml, formatTimestamp } from './dom.js';

export const REQUEST_STATUS_META = {
  pending: { label: 'Pending', badge: 'pending' },
  approved: { label: 'Approved', badge: 'completed' },
  rejected: { label: 'Rejected', badge: 'alert' },
};

const RELEASE_REASON_LABELS = {
  device_change_approved: 'after an approved device change',
  binding_replaced: 'replaced by a new phone link',
};

function formatWhen(value, fallback = '—') {
  return formatTimestamp(value) || fallback;
}

/** Handsets report brands in lower case (`samsung`, `google`) — tidy the first letter only. */
export function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/** `{ title: 'Galaxy S25', details: 'Samsung SM-S931B · Android 16 · app 1.0' }` */
export function describeDevice(device) {
  const hardware = [capitalize(device.brand), device.model].filter(Boolean).join(' ');
  const operatingSystem = [device.systemName, device.osVersion].filter(Boolean).join(' ');

  return {
    title: device.deviceName || hardware || 'Unknown phone',
    details: [
      device.deviceName ? hardware : '',
      operatingSystem,
      device.appVersion ? `app ${device.appVersion}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

export function renderRequestStatusBadge(status) {
  const meta = REQUEST_STATUS_META[status] || { label: status, badge: 'inactive' };
  return `<span class="badge badge--${escapeHtml(meta.badge)}">${escapeHtml(meta.label)}</span>`;
}

/** Table cell content for a device: name, hardware/OS line, device ID. */
export function renderDeviceCell(device) {
  const { title, details } = describeDevice(device);

  return `
    <span class="cell__strong">${escapeHtml(title)}</span>
    ${details ? `<span class="cell__muted">${escapeHtml(details)}</span>` : ''}
    <span class="cell__muted">ID ${escapeHtml(device.deviceId)}</span>`;
}

/** Status line under the badge: waiting, or decided when (and by whom), plus the note. */
export function renderDecision(request, { showDecidedBy = false } = {}) {
  if (request.status === 'pending') {
    return '<span class="cell__muted">Waiting for admin</span>';
  }

  const verb = request.status === 'approved' ? 'Approved' : 'Rejected';
  const by = showDecidedBy && request.decidedBy ? ` by ${request.decidedBy.name}` : '';

  return `
    <span class="cell__muted">${escapeHtml(`${verb} ${formatWhen(request.decidedAt)}${by}`)}</span>
    ${request.decisionNote ? `<span class="cell__muted">Note: ${escapeHtml(request.decisionNote)}</span>` : ''}`;
}

/** The phone signed in on after an approval, or why there is none. */
export function renderNewDeviceCell(request) {
  if (request.newDevice) {
    return `
      ${renderDeviceCell(request.newDevice)}
      <span class="cell__muted">First sign-in ${escapeHtml(formatWhen(request.newDevice.boundAt))}</span>`;
  }

  if (request.status === 'approved') {
    return '<span class="cell__muted">Not signed in on a phone yet</span>';
  }

  return '<span class="cell__muted">—</span>';
}

/** Requests, newest first: when, the phone given up, reason, outcome, the phone that followed. */
export function renderRequestHistoryTable(requests, { showDecidedBy = false } = {}) {
  const rows = requests
    .map(
      (request) => `
        <tr>
          <td><span class="cell__muted">${escapeHtml(formatWhen(request.requestedAt))}</span></td>
          <td>${renderDeviceCell(request.deviceAtRequest)}</td>
          <td class="cell__wrap">${request.reason ? escapeHtml(request.reason) : '<span class="cell__muted">—</span>'}</td>
          <td>${renderRequestStatusBadge(request.status)}${renderDecision(request, { showDecidedBy })}</td>
          <td>${renderNewDeviceCell(request)}</td>
        </tr>`,
    )
    .join('');

  return `
    <div class="table-wrap">
      <table class="table table--static">
        <thead>
          <tr>
            <th scope="col">Requested</th>
            <th scope="col">Phone at request</th>
            <th scope="col">Reason</th>
            <th scope="col">Status</th>
            <th scope="col">New phone</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/** Every phone ever linked to the account, newest first. */
export function renderDeviceHistoryTable(entries) {
  const rows = entries
    .map((entry) => {
      const status = entry.isCurrent
        ? '<span class="badge badge--completed">Current</span>'
        : `<span class="cell__muted">${escapeHtml(
            `Unlinked ${formatWhen(entry.releasedAt)} ${RELEASE_REASON_LABELS[entry.releaseReason] || ''}`.trim(),
          )}</span>`;

      return `
        <tr>
          <td>${renderDeviceCell(entry.device)}</td>
          <td><span class="cell__muted">${escapeHtml(formatWhen(entry.boundAt, 'Before device history was kept'))}</span></td>
          <td><span class="cell__muted">${escapeHtml(formatWhen(entry.lastLoginAt))}</span></td>
          <td>${status}</td>
        </tr>`;
    })
    .join('');

  return `
    <div class="table-wrap">
      <table class="table table--static">
        <thead>
          <tr>
            <th scope="col">Phone</th>
            <th scope="col">Linked (first app sign-in)</th>
            <th scope="col">Last app sign-in</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}
