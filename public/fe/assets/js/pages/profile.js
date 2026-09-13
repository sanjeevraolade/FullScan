/**
 * Profile page — the signed-in field executive's account details, the mobile device
 * their account is bound to, device change requests, and their device history.
 *
 * Fetched fresh on every visit: the binding changes when the FE signs in on a phone
 * or an admin approves a device change, and the page should show that without a
 * reload. A load failure is thrown to the router, which shows it as the page alert.
 */

import { feWebApi } from '../api.js';
import { escapeHtml, formatTimestamp } from '/admin/assets/js/dom.js';
import {
  capitalize,
  renderDeviceHistoryTable,
  renderRequestHistoryTable,
} from '/admin/assets/js/device-change.js';

const REASON_MAX_LENGTH = 500;

function createInitialState() {
  return {
    container: null,
    setStatus: () => {},
    profile: null,
    deviceChange: null,
    isFormOpen: false,
    isSubmitting: false,
    draftReason: '',
  };
}

let state = createInitialState();

/* ------------------------------------------------------------------ helpers */

function formatWhen(value) {
  return formatTimestamp(value) || '—';
}

function pluralize(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function joinParts(...parts) {
  return parts.filter(Boolean).join(' ');
}

function renderDetail(label, value) {
  return `
    <div>
      <dt class="detail__label">${escapeHtml(label)}</dt>
      <dd class="detail__value">${escapeHtml(value || '—')}</dd>
    </div>`;
}

/** The latest request was approved and the FE has not signed in on a phone since. */
function findApprovalAwaitingSignIn() {
  const [latest] = state.deviceChange.requests;
  return latest && latest.status === 'approved' && !latest.newDevice ? latest : null;
}

/* ------------------------------------------------------------------- markup */

function renderAccountCard(fieldExecutive) {
  return `
    <section class="card" aria-labelledby="profile-title">
      <div class="card__header">
        <h2 class="card__title" id="profile-title">${escapeHtml(fieldExecutive.name)}</h2>
        <p class="card__subtitle">${escapeHtml(fieldExecutive.role)}</p>
      </div>
      <div class="card__body">
        <dl class="fe-profile" data-account-details>
          ${renderDetail('Name', fieldExecutive.name)}
          ${renderDetail('Email', fieldExecutive.email)}
          ${renderDetail('Role', fieldExecutive.role)}
          ${renderDetail('Executive ID', fieldExecutive.id)}
        </dl>
      </div>
    </section>`;
}

function renderPolicyHint(eligibility) {
  const { policy, requestsInWindow } = eligibility;

  return `You can request a device change up to ${pluralize(policy.maxRequests, 'time')} every ${pluralize(
    policy.windowDays,
    'day',
  )}. Requests in the last ${pluralize(policy.windowDays, 'day')}: ${requestsInWindow}.`;
}

function renderRequestForm(eligibility) {
  const disabled = state.isSubmitting ? ' disabled' : '';

  return `
    <form data-device-change-form novalidate>
      <div class="field">
        <label class="field__label" for="device-change-reason">Reason (optional)</label>
        <textarea
          class="field__control fe-textarea"
          id="device-change-reason"
          name="reason"
          rows="3"
          maxlength="${REASON_MAX_LENGTH}"
          aria-describedby="device-change-reason-hint"
          data-device-change-reason${disabled}
        >${escapeHtml(state.draftReason)}</textarea>
        <p class="field__hint" id="device-change-reason-hint">For example: phone lost, damaged or replaced. Your admin sees this.</p>
      </div>
      <p class="fe-note">
        Once your admin approves, your account is unlinked from this phone. You can then sign in to the
        FullScan app on any phone, including this one, and that phone becomes linked.
      </p>
      <p class="fe-note">${escapeHtml(renderPolicyHint(eligibility))}</p>
      <div class="row-actions fe-actions">
        <button class="btn btn--primary btn--sm" type="submit"${disabled}>${state.isSubmitting ? 'Sending…' : 'Send request'}</button>
        <button class="btn btn--sm" type="button" data-cancel-device-change${disabled}>Cancel</button>
      </div>
    </form>`;
}

function renderDeviceChangeSection() {
  const { eligibility, requests } = state.deviceChange;
  const pending = requests.find((request) => request.status === 'pending');
  let body;

  if (eligibility.blockedReason === 'pending_request' && pending) {
    body = `
      <p class="fe-status" data-device-change-state="pending">
        <span class="badge badge--pending">Waiting for admin approval</span>
        <span>You requested a device change on ${escapeHtml(formatWhen(pending.requestedAt))}. You can keep using this phone until it is approved.</span>
      </p>`;
  } else if (eligibility.blockedReason === 'limit_reached') {
    const { maxRequests, windowDays } = eligibility.policy;
    body = `
      <p class="fe-status" data-device-change-state="limit-reached">
        <span class="badge badge--alert">Request limit reached</span>
        <span>You can request a device change up to ${escapeHtml(pluralize(maxRequests, 'time'))} every ${escapeHtml(
          pluralize(windowDays, 'day'),
        )}. You can request again after ${escapeHtml(formatWhen(eligibility.nextRequestAllowedAt))}.</span>
      </p>`;
  } else if (state.isFormOpen) {
    body = renderRequestForm(eligibility);
  } else {
    body = `
      <div class="row-actions" data-device-change-state="available">
        <button class="btn btn--sm" type="button" data-open-device-change>Request device change</button>
      </div>
      <p class="fe-note">${escapeHtml(renderPolicyHint(eligibility))}</p>`;
  }

  return `
    <div class="fe-device-change">
      <h3 class="fe-device-change__title">Change device</h3>
      ${body}
    </div>`;
}

function renderMobileDeviceCard(mobileDevice) {
  if (!mobileDevice) {
    const approval = findApprovalAwaitingSignIn();

    const subtitle = approval
      ? 'Device change approved. No phone is linked right now.'
      : 'Not signed in to the FullScan mobile app yet.';

    const note = approval
      ? `Your device change was approved on ${formatWhen(approval.decidedAt)}. Sign in to the FullScan app on any phone, including your previous one, and that phone will be linked to your account.`
      : 'When you first sign in to the FullScan app, your account is linked to that phone and its details appear here.';

    return `
      <section class="card" aria-labelledby="mobile-device-title" data-mobile-device="none">
        <div class="card__header">
          <h2 class="card__title" id="mobile-device-title">Mobile app device</h2>
          <p class="card__subtitle">${escapeHtml(subtitle)}</p>
        </div>
        <div class="card__body">
          <p class="fe-note">${escapeHtml(note)}</p>
        </div>
      </section>`;
  }

  const brandAndModel = joinParts(capitalize(mobileDevice.brand), mobileDevice.model);
  const operatingSystem = joinParts(mobileDevice.systemName, mobileDevice.osVersion);

  return `
    <section class="card" aria-labelledby="mobile-device-title" data-mobile-device="bound">
      <div class="card__header">
        <h2 class="card__title" id="mobile-device-title">Mobile app device</h2>
        <p class="card__subtitle">Your account is linked to this phone.</p>
      </div>
      <div class="card__body">
        <dl class="fe-profile">
          ${renderDetail('Device name', mobileDevice.deviceName)}
          ${renderDetail('Brand & model', brandAndModel)}
          ${renderDetail('Operating system', operatingSystem)}
          ${renderDetail('FullScan app version', mobileDevice.appVersion)}
          ${renderDetail('Device ID', mobileDevice.deviceId)}
        </dl>
        <p class="fe-note">You can only use the FullScan app on this phone.</p>
        ${renderDeviceChangeSection()}
      </div>
    </section>`;
}

function renderHistoryCards() {
  const { requests, deviceHistory } = state.deviceChange;

  const requestsCard =
    requests.length === 0
      ? ''
      : `
        <section class="card" aria-labelledby="device-change-requests-title" data-device-change-requests>
          <div class="card__header">
            <h2 class="card__title" id="device-change-requests-title">Device change requests</h2>
            <p class="card__subtitle">Every request you have made and what happened to it.</p>
          </div>
          <div class="card__body">${renderRequestHistoryTable(requests)}</div>
        </section>`;

  const devicesCard =
    deviceHistory.length === 0
      ? ''
      : `
        <section class="card" aria-labelledby="device-history-title" data-device-history>
          <div class="card__header">
            <h2 class="card__title" id="device-history-title">Phones linked to your account</h2>
            <p class="card__subtitle">Every phone your account has been linked to, newest first.</p>
          </div>
          <div class="card__body">${renderDeviceHistoryTable(deviceHistory)}</div>
        </section>`;

  return `${requestsCard}${devicesCard}`;
}

function paint() {
  state.container.innerHTML = `
    ${renderAccountCard(state.profile.fieldExecutive)}
    ${renderMobileDeviceCard(state.profile.mobileDevice)}
    ${renderHistoryCards()}`;

  if (state.isFormOpen && !state.isSubmitting) {
    state.container.querySelector('[data-device-change-reason]')?.focus();
  }
}

/* ----------------------------------------------------------------- actions */

async function refresh() {
  const [profile, deviceChange] = await Promise.all([feWebApi.getProfile(), feWebApi.getDeviceChange()]);
  state.profile = profile;
  state.deviceChange = deviceChange;
}

async function submitRequest() {
  const reason = state.draftReason.trim();

  if (reason.length > REASON_MAX_LENGTH) {
    state.setStatus({ variant: 'error', message: `The reason must be ${REASON_MAX_LENGTH} characters or fewer.` });
    return;
  }

  state.isSubmitting = true;
  state.setStatus(null);
  paint();

  try {
    state.deviceChange = await feWebApi.requestDeviceChange(reason);
    state.isFormOpen = false;
    state.draftReason = '';
    state.setStatus({ variant: 'success', message: 'Your device change request was sent to your admin.' });
  } catch (error) {
    state.setStatus({ variant: 'error', message: error.message });
    // The server said no (already pending, limit reached, no phone linked) — show why.
    try {
      await refresh();
      state.isFormOpen = state.deviceChange.eligibility.canRequest && state.isFormOpen;
    } catch {
      // Keep what is on screen; the alert already explains the failure.
    }
  } finally {
    state.isSubmitting = false;
    paint();
  }
}

function onClick(event) {
  if (event.target.closest('[data-open-device-change]')) {
    state.isFormOpen = true;
    state.setStatus(null);
    paint();
    return;
  }

  if (event.target.closest('[data-cancel-device-change]')) {
    state.isFormOpen = false;
    state.draftReason = '';
    paint();
  }
}

function onInput(event) {
  if (event.target.closest('[data-device-change-reason]')) {
    state.draftReason = event.target.value;
  }
}

function onSubmit(event) {
  if (!event.target.closest('[data-device-change-form]')) {
    return;
  }

  event.preventDefault();
  if (!state.isSubmitting) {
    submitRequest();
  }
}

/* -------------------------------------------------------------- page module */

export async function render(container, { setStatus }) {
  state = createInitialState();
  state.container = container;
  state.setStatus = setStatus;

  await refresh();

  container.addEventListener('click', onClick);
  container.addEventListener('input', onInput);
  container.addEventListener('submit', onSubmit);
  paint();
}

export function destroy() {
  state = createInitialState();
}
