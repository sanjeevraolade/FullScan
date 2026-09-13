/**
 * Field executive web API client.
 *
 * Every call goes to /api/v1/fe-web/* and authenticates with the httpOnly session
 * cookie (`credentials: 'same-origin'`) — the page never holds the token.
 *
 * The server always answers with a `{ success, data }` / `{ success, error }`
 * envelope, so unwrapping happens here instead of at every call site.
 */

const API_BASE = '/api/v1/fe-web';
export const LOGIN_PATH = '/fe/login';

/** An API call that came back with a non-2xx status. */
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Sends the browser to the login page, remembering where it was. */
export function redirectToLogin() {
  const next = `${window.location.pathname}${window.location.hash}`;
  window.location.replace(`${LOGIN_PATH}?next=${encodeURIComponent(next)}`);
}

async function readEnvelope(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Performs a request and returns the unwrapped `data`. A 401 sends the browser to
 * the login page unless `redirectOnUnauthorized: false` is passed.
 */
async function apiRequest(path, options = {}) {
  const { method = 'GET', body, redirectOnUnauthorized = true } = options;

  const init = {
    method,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  };

  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }

  const envelope = await readEnvelope(response);

  if (response.status === 401 && redirectOnUnauthorized) {
    redirectToLogin();
    throw new ApiError(401, 'Your session has expired. Please sign in again.');
  }

  if (!response.ok || !envelope || envelope.success !== true) {
    const message =
      (envelope && envelope.error) || `Request failed (${response.status}). Please try again.`;
    throw new ApiError(response.status, message);
  }

  return envelope.data;
}

export const feWebApi = {
  /** Signs in. Not routed through the 401 redirect — the form shows the error. */
  async login(username, password) {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: { username, password },
      redirectOnUnauthorized: false,
    });
  },

  async logout() {
    return apiRequest('/auth/logout', { method: 'POST', redirectOnUnauthorized: false });
  },

  async getCurrentFieldExecutive() {
    return apiRequest('/auth/me');
  },

  /** `{ fieldExecutive, mobileDevice }` — `mobileDevice` is null until the FE signs in to the app. */
  async getProfile() {
    return apiRequest('/profile');
  },

  /** `{ eligibility, requests, deviceHistory }` for the device change section. */
  async getDeviceChange() {
    return apiRequest('/device-change');
  },

  /** Submits a device change request; resolves to the refreshed `{ eligibility, requests, deviceHistory }`. */
  async requestDeviceChange(reason) {
    return apiRequest('/device-change/requests', {
      method: 'POST',
      body: reason ? { reason } : {},
    });
  },

  /** `{ caseGroups }` — Pending, Beyond TAT and Completed, in that order. */
  async getMyCases() {
    return apiRequest('/cases');
  },
};
