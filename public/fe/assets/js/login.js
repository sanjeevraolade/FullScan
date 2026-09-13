/**
 * Field executive web login form.
 *
 * On success the server has already set the httpOnly session cookie, so all this
 * has to do is navigate — there is no token for the page to store.
 */

import { feWebApi } from './api.js';
import { renderAlert } from '/admin/assets/js/dom.js';

const DEFAULT_DESTINATION = '/fe';

const form = document.querySelector('[data-login-form]');
const usernameInput = form.querySelector('#username');
const passwordInput = form.querySelector('#password');
const submitButton = form.querySelector('[data-submit]');
const alertContainer = document.querySelector('[data-alert]');

/**
 * Resolves the post-login destination from `?next=`. Only paths inside this portal
 * (`/fe`, `/fe/…`, `/fe#…`) are honoured — anything else is an open redirect.
 */
function resolveDestination() {
  const next = new URLSearchParams(window.location.search).get('next');

  if (!next || next.includes('\\')) {
    return DEFAULT_DESTINATION;
  }

  const isInsidePortal = next === '/fe' || next.startsWith('/fe/') || next.startsWith('/fe#');
  return isInsidePortal ? next : DEFAULT_DESTINATION;
}

function setFieldValidity(isValid) {
  for (const input of [usernameInput, passwordInput]) {
    input.setAttribute('aria-invalid', String(!isValid));
  }
}

function setBusy(isBusy) {
  submitButton.disabled = isBusy;
  submitButton.textContent = isBusy ? 'Signing in…' : 'Sign in';
  usernameInput.disabled = isBusy;
  passwordInput.disabled = isBusy;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  renderAlert(alertContainer, null);
  setFieldValidity(true);

  if (!username || !password) {
    setFieldValidity(false);
    renderAlert(alertContainer, {
      variant: 'error',
      message: 'Enter both your username and your password.',
    });
    (username ? passwordInput : usernameInput).focus();
    return;
  }

  setBusy(true);

  try {
    await feWebApi.login(username, password);
    // replace() so Back does not return to the login form on a live session.
    window.location.replace(resolveDestination());
  } catch (error) {
    setBusy(false);
    setFieldValidity(false);
    renderAlert(alertContainer, { variant: 'error', message: error.message });
    passwordInput.value = '';
    passwordInput.focus();
  }
});

usernameInput.focus();
