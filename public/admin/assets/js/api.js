/**
 * Admin API client.
 *
 * Every call goes to /api/v1/admin/* and authenticates with the httpOnly session
 * cookie (`credentials: 'same-origin'`) — the portal never holds the token in
 * JavaScript, so there is nothing for an XSS bug to steal.
 *
 * The server always answers with a `{ success, data }` / `{ success, error }`
 * envelope, so unwrapping happens in one place instead of at every call site.
 */

const API_BASE = '/api/v1/admin';
export const LOGIN_PATH = '/admin/login';

/** An API call that came back with a non-2xx status. */
export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details || null;
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
 * Performs an admin API request and returns the unwrapped `data`.
 *
 * A 401 means the session has expired or been revoked: the browser is sent back
 * to the login page rather than the caller having to handle it. Pass
 * `redirectOnUnauthorized: false` to opt out (used by sign-out, which is
 * navigating anyway).
 */
export async function apiRequest(path, options = {}) {
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
    throw new ApiError(response.status, message, envelope && envelope.details);
  }

  return envelope.data;
}

/** Builds `?a=1&b=2` from an object, skipping empty/undefined entries. */
function toQueryString(params) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  }

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

export const adminApi = {
  /** Signs in. Not routed through apiRequest's 401 redirect — the form shows the error. */
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

  async getCurrentAdmin() {
    return apiRequest('/auth/me');
  },

  async getMobileAppSettings() {
    return apiRequest('/mobile-app-settings');
  },

  async updateMobileAppSettings(settings) {
    return apiRequest('/mobile-app-settings', { method: 'PUT', body: { settings } });
  },

  /**
   * Case components, filtered and paged. `filter` accepts `bucket`, `search`,
   * `fieldExecutiveId`, `limit` and `offset`; blank entries are dropped so the
   * query string only ever carries filters that are actually set.
   */
  async listCases(filter = {}) {
    return apiRequest(`/cases${toQueryString(filter)}`);
  },

  /** Status vocabularies the case editor's selects are built from. */
  async getCaseFormOptions() {
    return apiRequest('/cases/form-options');
  },

  /** One case with every component beneath it — note this id is a case id, not a component id. */
  async getCase(caseId) {
    return apiRequest(`/cases/${encodeURIComponent(caseId)}`);
  },

  async createCase(payload) {
    return apiRequest('/cases', { method: 'POST', body: payload });
  },

  async updateCase(caseId, payload) {
    return apiRequest(`/cases/${encodeURIComponent(caseId)}`, { method: 'PUT', body: payload });
  },

  /** The field executive roster, with assignment and detection counts. */
  async listFieldExecutives(search) {
    return apiRequest(`/field-executives${toQueryString({ search })}`);
  },

  /** One executive's case-wise history, including every mock-location detection. */
  async getFieldExecutiveHistory(fieldExecutiveId) {
    return apiRequest(`/field-executives/${encodeURIComponent(fieldExecutiveId)}/history`);
  },

  /** Every admin account. Super admin only — an admin gets 403. */
  async listAdminUsers() {
    return apiRequest('/admin-users');
  },

  /** Adds an admin by email; resolves to `{ adminUser, temporaryPassword }`. Super admin only. */
  async createAdminUser({ name, email, role }) {
    return apiRequest('/admin-users', { method: 'POST', body: { name, email, role } });
  },

  /** Promote/demote (`role`) and/or deactivate/reactivate (`isActive`) another admin. Super admin only. */
  async updateAdminUser(adminUserId, changes) {
    return apiRequest(`/admin-users/${encodeURIComponent(adminUserId)}`, {
      method: 'PATCH',
      body: changes,
    });
  },

  /** Permanently deletes another admin; refused (409) when the account has audit history. Super admin only. */
  async deleteAdminUser(adminUserId) {
    return apiRequest(`/admin-users/${encodeURIComponent(adminUserId)}`, { method: 'DELETE' });
  },
};
