/**
 * Field Executive History page.
 *
 * Answers one back-office question: what has this executive been working on,
 * and did anything look fraudulent while they did it? Mock-location detections
 * are the only per-executive audit trail the platform keeps today, and each one
 * carries the case component that was open when the faked fix was seen — so the
 * history reads **case-wise**, with the detections folded into the case they
 * happened on rather than shown as a separate flat log.
 *
 * Cases are split into one headed list per workflow category — Pending, Beyond
 * TAT, Completed. New cases are not shown: that bucket is the unclaimed shared
 * pool the app re-draws at random, not work this executive has done.
 */

import { adminApi } from '../api.js';
import { escapeHtml, formatTimestamp, formatWallClockTimestamp } from '../dom.js';
import { renderIcon } from '../icons.js';
import { renderDeviceHistoryTable, renderRequestHistoryTable } from '../device-change.js';

const SEARCH_DEBOUNCE_MS = 300;

const BUCKET_LABELS = {
  new: 'New',
  pending: 'Pending',
  beyond_tat: 'Beyond TAT',
  completed: 'Completed',
};

/** Heading and empty-state copy for each category's list. */
const GROUP_META = {
  pending: {
    title: 'Pending',
    empty: 'No pending cases assigned.',
  },
  beyond_tat: {
    title: 'Beyond TAT',
    empty: 'No cases past their TAT.',
  },
  completed: {
    title: 'Completed',
    empty: 'No completed cases.',
  },
  new: {
    title: 'New (unclaimed)',
    empty: 'No unclaimed cases.',
  },
};

function getGroupMeta(bucket) {
  return GROUP_META[bucket] || { title: BUCKET_LABELS[bucket] || bucket, empty: 'No cases.' };
}

/** Where in the app's lifecycle the mocked fix was noticed (see mock_location_events). */
const DETECTION_STAGE_LABELS = {
  post_login: 'Right after login',
  app_resume: 'On app resume',
  manual_recheck: 'On a manual recheck',
  photo_capture: 'While capturing evidence',
};

function createInitialState() {
  return {
    container: null,
    setStatus: () => {},
    fieldExecutives: [],
    componentStatuses: [],
    selectedId: '',
    history: null,
    search: '',
    searchTimer: null,
    /** Component ids whose detection row is open — kept across re-renders. */
    expandedCases: new Set(),
  };
}

let state = createInitialState();

/* ------------------------------------------------------------------ helpers */

/**
 * Component status codes come back as codes; their labels live in
 * `dropdown_options`, the same rows the mobile app reads. An unknown code falls
 * back to itself rather than rendering blank.
 */
function labelForComponentStatus(code) {
  if (!code) {
    return '—';
  }

  const match = state.componentStatuses.find((option) => option.code === code);
  return match ? match.label : code;
}

function formatCoordinates(event) {
  if (event.latitude === null || event.longitude === null) {
    return 'No coordinates reported';
  }

  const accuracy =
    event.accuracyMeters === null ? '' : ` · ±${Math.round(event.accuracyMeters)} m`;

  return `${event.latitude.toFixed(6)}, ${event.longitude.toFixed(6)}${accuracy}`;
}

function describeDevice(device) {
  const parts = [device.manufacturer || device.brand, device.model].filter(Boolean);
  const os = [device.osName, device.osVersion].filter(Boolean).join(' ');

  return [parts.join(' '), os].filter(Boolean).join(' · ') || 'Device details not reported';
}

/** A value the device never reported reads as an em dash, never as a blank row. */
function renderDetailRow(label, value) {
  return `
    <div class="detail">
      <dt class="detail__label">${escapeHtml(label)}</dt>
      <dd class="detail__value">${escapeHtml(value || '—')}</dd>
    </div>`;
}

/* ------------------------------------------------------------------ markup */

function renderEvent(event) {
  const { device } = event;

  return `
    <li class="event">
      <div class="event__head">
        <span class="badge badge--alert">Mock location</span>
        <span class="event__when">${escapeHtml(formatTimestamp(event.detectedAt) || event.detectedAt)}</span>
        <span class="event__stage">${escapeHtml(
          DETECTION_STAGE_LABELS[event.detectionStage] || event.detectionStage,
        )}</span>
      </div>
      <dl class="event__details">
        ${renderDetailRow('Mock enabled at (device clock)', formatTimestamp(event.detectedAt) || event.detectedAt)}
        ${renderDetailRow('Reported to server at', formatTimestamp(event.reportedAt) || event.reportedAt)}
        ${renderDetailRow('Claimed coordinates', formatCoordinates(event))}
        ${renderDetailRow('Fix source', event.fixSource === 'lastKnown' ? 'Last known' : event.fixSource)}
        ${renderDetailRow('Fix captured at', formatTimestamp(event.fixCapturedAt) || '—')}
        ${renderDetailRow('Handset', describeDevice(device))}
        ${renderDetailRow('Device id', device.deviceId)}
        ${renderDetailRow('Device name', device.deviceName)}
        ${renderDetailRow('App version', [device.appVersion, device.appBuildNumber && `(${device.appBuildNumber})`]
          .filter(Boolean)
          .join(' '))}
        ${renderDetailRow('Installed from', device.installerPackageName)}
        ${renderDetailRow('Emulator', device.isEmulator ? 'Yes' : 'No')}
        ${renderDetailRow('Device time zone', device.timeZone)}
      </dl>
    </li>`;
}

/** Columns in a category table — the detail row spans all of them. */
const CASE_TABLE_COLUMNS = 7;

const ADDRESS_TYPE_LABELS = {
  present: 'Present',
  permanent: 'Permanent',
  previous: 'Previous',
};

/**
 * One case as a table row, plus — for a case that has detections — a second row
 * holding them, collapsed until the admin opens it. Keeping the evidence in a
 * real `<tr>` rather than a floating panel lets the table stay one scannable
 * list while the detail is still one click away.
 */
function renderCaseRow(entry) {
  const hasEvents = entry.mockLocationEvents.length > 0;
  const isExpanded = state.expandedCases.has(entry.componentId);
  const addressType = entry.addressType
    ? ADDRESS_TYPE_LABELS[entry.addressType] || entry.addressType
    : '';

  const toggle = hasEvents
    ? `<button
         class="row-toggle${isExpanded ? ' row-toggle--open' : ''}"
         type="button"
         data-toggle-detections="${escapeHtml(entry.componentId)}"
         aria-expanded="${isExpanded}"
       >${renderIcon('chevron', 14)}<span class="visually-hidden">Detections for ${escapeHtml(
         entry.caseRef,
       )}</span></button>`
    : '<span class="row-toggle row-toggle--empty" aria-hidden="true"></span>';

  const detections = hasEvents
    ? `<span class="badge badge--alert">${entry.mockLocationEvents.length}</span>`
    : '<span class="cell__muted">—</span>';

  const detailRow = hasEvents
    ? `
      <tr class="detections-row"${isExpanded ? '' : ' hidden'} data-detections-for="${escapeHtml(
        entry.componentId,
      )}">
        <td colspan="${CASE_TABLE_COLUMNS}">
          <ul class="event-list">${entry.mockLocationEvents.map(renderEvent).join('')}</ul>
        </td>
      </tr>`
    : '';

  return `
    <tr class="case-row${hasEvents ? ' case-row--flagged' : ''}">
      <td class="cell__toggle">
        ${toggle}
        <span class="cell__strong">${escapeHtml(entry.caseRef)}</span>
        <span class="cell__muted">${escapeHtml(entry.clientName)}</span>
      </td>
      <td>${escapeHtml(entry.candidateName)}</td>
      <td>
        <span>${escapeHtml(entry.verificationType)}</span>
        ${addressType ? `<span class="cell__muted">${escapeHtml(addressType)}</span>` : ''}
      </td>
      <td class="cell__wrap">${escapeHtml(entry.address || '—')}</td>
      <td>${escapeHtml(labelForComponentStatus(entry.componentStatus))}</td>
      <td><span class="cell__muted">${escapeHtml(formatWallClockTimestamp(entry.tatDueAt) || '—')}</span></td>
      <td>${detections}</td>
    </tr>
    ${detailRow}`;
}

function renderCaseTable(cases) {
  return `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">Case</th>
            <th scope="col">Candidate</th>
            <th scope="col">Component</th>
            <th scope="col">Address</th>
            <th scope="col">Status</th>
            <th scope="col">TAT due</th>
            <th scope="col">Detections</th>
          </tr>
        </thead>
        <tbody>${cases.map(renderCaseRow).join('')}</tbody>
      </table>
    </div>`;
}

/**
 * One category's list: a heading carrying its counts, then its table — or a
 * single muted line when it has none, so an empty Pending list still reads as an
 * answer rather than a missing section.
 */
function renderGroup(group) {
  const meta = getGroupMeta(group.bucket);

  const detections =
    group.mockLocationEventCount > 0
      ? `<span class="badge badge--alert">${group.mockLocationEventCount} detection${
          group.mockLocationEventCount === 1 ? '' : 's'
        }</span>`
      : '';

  const body =
    group.caseCount === 0
      ? `<p class="case-group__empty">${escapeHtml(meta.empty)}</p>`
      : renderCaseTable(group.cases);

  return `
    <section class="case-group">
      <header class="case-group__header">
        <h2 class="case-group__title">${escapeHtml(meta.title)}</h2>
        <span class="case-group__count">${group.caseCount} case${
          group.caseCount === 1 ? '' : 's'
        }</span>
        ${detections}
      </header>
      ${body}
    </section>`;
}

function renderSummary(history) {
  const { summary } = history;

  const tiles = [
    { label: 'Cases assigned', value: String(summary.assignedComponentCount) },
    { label: 'Mock-location detections', value: String(summary.mockLocationEventCount) },
    { label: 'Handsets involved', value: String(summary.distinctDeviceCount) },
    { label: 'First detected', value: formatTimestamp(summary.firstDetectedAt) || 'Never' },
    { label: 'Last detected', value: formatTimestamp(summary.lastDetectedAt) || 'Never' },
  ];

  return `
    <div class="tiles">
      ${tiles
        .map(
          (tile) => `
            <div class="tile${
              tile.label === 'Mock-location detections' && summary.mockLocationEventCount > 0
                ? ' tile--alert'
                : ''
            }">
              <span class="tile__value">${escapeHtml(tile.value)}</span>
              <span class="tile__label">${escapeHtml(tile.label)}</span>
            </div>`,
        )
        .join('')}
    </div>`;
}

function renderHistory(history) {
  const executive = history.fieldExecutive;

  const unlinked =
    history.unlinkedMockLocationEvents.length === 0
      ? ''
      : `
        <section class="card card--flagged">
          <header class="card__header">
            <h2 class="card__title">Detections not tied to a case</h2>
            <p class="card__subtitle">
              Reported at login or on resume, or against a case component that no longer exists.
            </p>
          </header>
          <div class="card__body">
            <ul class="event-list">${history.unlinkedMockLocationEvents.map(renderEvent).join('')}</ul>
          </div>
        </section>`;

  return `
    <section class="card">
      <header class="card__header">
        <h2 class="card__title">${escapeHtml(executive.name)}</h2>
        <p class="card__subtitle">
          ${escapeHtml(executive.username)} · ${escapeHtml(executive.email)} ·
          ${executive.isDeviceBound ? 'Device bound' : 'No device bound'}
        </p>
      </header>
      <div class="card__body">${renderSummary(history)}</div>
    </section>

    ${renderDeviceRecords(history)}
    ${history.caseGroups.map(renderGroup).join('')}
    ${unlinked}`;
}

/** Every phone the account was bound to, and every device change request with its outcome. */
function renderDeviceRecords(history) {
  const phones =
    history.deviceHistory.length === 0
      ? '<p class="case-group__empty">No phone has been linked to this account yet.</p>'
      : renderDeviceHistoryTable(history.deviceHistory);

  const requests =
    history.deviceChangeRequests.length === 0
      ? '<p class="case-group__empty">No device change requests.</p>'
      : renderRequestHistoryTable(history.deviceChangeRequests, { showDecidedBy: true });

  return `
    <section class="case-group">
      <header class="case-group__header">
        <h2 class="case-group__title">Linked phones</h2>
        <span class="case-group__count">${history.deviceHistory.length} phone link${
          history.deviceHistory.length === 1 ? '' : 's'
        }</span>
      </header>
      ${phones}
    </section>
    <section class="case-group">
      <header class="case-group__header">
        <h2 class="case-group__title">Device change requests</h2>
        <span class="case-group__count">${history.deviceChangeRequests.length} request${
          history.deviceChangeRequests.length === 1 ? '' : 's'
        }</span>
      </header>
      ${requests}
    </section>`;
}

function executiveOptionLabel(executive) {
  const detections =
    executive.mockLocationEventCount > 0 ? ` — ${executive.mockLocationEventCount} detection${
      executive.mockLocationEventCount === 1 ? '' : 's'
    }` : '';

  return `${executive.name} (${executive.username})${detections}`;
}

/**
 * Re-rendering replaces the search box, which would drop focus mid-typing — the
 * debounced roster reload fires while the admin is still at the keyboard.
 */
function captureSearchFocus() {
  const active = document.activeElement;

  if (!active || !active.closest || !active.closest('[data-search]')) {
    return null;
  }

  return { start: active.selectionStart, end: active.selectionEnd };
}

function restoreSearchFocus(caret) {
  if (!caret) {
    return;
  }

  const input = state.container.querySelector('[data-search]');
  if (!input) {
    return;
  }

  input.focus();
  input.setSelectionRange(caret.start, caret.end);
}

function renderPage(bodyMarkup) {
  const caret = captureSearchFocus();

  state.container.innerHTML = `
    <div class="toolbar">
      <div class="toolbar__search">
        <label class="visually-hidden" for="history-search">Search field executives</label>
        <input
          class="field__control"
          id="history-search"
          type="search"
          placeholder="Search by name, username or email"
          value="${escapeHtml(state.search)}"
          data-search
        />
      </div>
      <div class="toolbar__filter toolbar__filter--wide">
        <label class="visually-hidden" for="history-executive">Field executive</label>
        <select class="field__control" id="history-executive" data-executive>
          <option value=""${state.selectedId ? '' : ' selected'}>Select a field executive</option>
          ${state.fieldExecutives
            .map(
              (executive) =>
                `<option value="${escapeHtml(executive.id)}"${
                  executive.id === state.selectedId ? ' selected' : ''
                }>${escapeHtml(executiveOptionLabel(executive))}</option>`,
            )
            .join('')}
        </select>
      </div>
    </div>
    <div data-history>${bodyMarkup}</div>`;

  restoreSearchFocus(caret);
}

/* ----------------------------------------------------------------- actions */

const EMPTY_PROMPT =
  '<div class="state">Choose a field executive to see their case-wise history.</div>';

async function loadHistory() {
  if (!state.selectedId) {
    state.history = null;
    renderPage(EMPTY_PROMPT);
    return;
  }

  renderPage('<div class="state"><span class="spinner"></span></div>');

  try {
    state.history = await adminApi.getFieldExecutiveHistory(state.selectedId);
    renderPage(renderHistory(state.history));
  } catch (error) {
    state.history = null;
    renderPage('<div class="state">This history could not be loaded.</div>');
    state.setStatus({ variant: 'error', message: error.message });
  }
}

async function reloadRoster() {
  try {
    state.fieldExecutives = await adminApi.listFieldExecutives(state.search || undefined);

    // A search that excludes the current selection clears it rather than leaving
    // the select showing a name that is no longer in the list.
    if (state.selectedId && !state.fieldExecutives.some((one) => one.id === state.selectedId)) {
      state.selectedId = '';
      state.history = null;
    }

    renderPage(state.history ? renderHistory(state.history) : EMPTY_PROMPT);
  } catch (error) {
    state.setStatus({ variant: 'error', message: error.message });
  }
}

/* --------------------------------------------------------------- listeners */

function onInput(event) {
  if (!event.target.closest('[data-search]')) {
    return;
  }

  const { value } = event.target;
  window.clearTimeout(state.searchTimer);
  state.searchTimer = window.setTimeout(() => {
    state.search = value.trim();
    reloadRoster();
  }, SEARCH_DEBOUNCE_MS);
}

function onClick(event) {
  const toggle = event.target.closest('[data-toggle-detections]');

  if (!toggle) {
    return;
  }

  const componentId = toggle.dataset.toggleDetections;
  const row = state.container.querySelector(
    `[data-detections-for="${CSS.escape(componentId)}"]`,
  );

  if (!row) {
    return;
  }

  const isOpening = row.hidden;
  row.hidden = !isOpening;
  toggle.setAttribute('aria-expanded', String(isOpening));
  toggle.classList.toggle('row-toggle--open', isOpening);

  if (isOpening) {
    state.expandedCases.add(componentId);
  } else {
    state.expandedCases.delete(componentId);
  }
}

function onChange(event) {
  if (!event.target.closest('[data-executive]')) {
    return;
  }

  state.selectedId = event.target.value;
  state.setStatus(null);
  loadHistory();
}

/* -------------------------------------------------------------- page module */

export async function render(container, { setStatus }) {
  state = createInitialState();
  state.container = container;
  state.setStatus = setStatus;

  // Form options supply the component-status labels the table renders.
  const [fieldExecutives, formOptions] = await Promise.all([
    adminApi.listFieldExecutives(),
    adminApi.getCaseFormOptions(),
  ]);

  state.fieldExecutives = fieldExecutives;
  state.componentStatuses = formOptions.componentStatuses;

  container.addEventListener('click', onClick);
  container.addEventListener('input', onInput);
  container.addEventListener('change', onChange);

  renderPage(EMPTY_PROMPT);
}

export function destroy() {
  window.clearTimeout(state.searchTimer);
  state = createInitialState();
}
