/**
 * Admin login form.
 *
 * On success the server has already set the httpOnly session cookie, so all this
 * has to do is navigate — there is no token for the page to store.
 */

import { adminApi } from './api.js';
import { renderAlert } from './dom.js';

const DEFAULT_DESTINATION = '/admin';

const form = document.querySelector('[data-login-form]');
const usernameInput = form.querySelector('#username');
const passwordInput = form.querySelector('#password');
const submitButton = form.querySelector('[data-submit]');
const alertContainer = document.querySelector('[data-alert]');

/**
 * Resolves the post-login destination from `?next=`.
 *
 * Only same-origin paths under /admin are honoured — anything else (an absolute
 * URL, a protocol-relative `//evil.test`, a path outside the portal) is an open
 * redirect and is discarded in favour of the portal root.
 */
function resolveDestination() {
  const next = new URLSearchParams(window.location.search).get('next');

  if (!next || !next.startsWith('/admin') || next.startsWith('//')) {
    return DEFAULT_DESTINATION;
  }

  return next;
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
      message: 'Enter both your username or email and your password.',
    });
    (username ? passwordInput : usernameInput).focus();
    return;
  }

  setBusy(true);

  try {
    await adminApi.login(username, password);
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
