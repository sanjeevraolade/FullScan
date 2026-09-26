/** Small DOM helpers shared by the portal's views. */

/**
 * Escapes a value for interpolation into an HTML template string.
 *
 * Settings labels, descriptions and values are admin-authored data coming back
 * from the API — they are inserted through `innerHTML` templates, so they must be
 * escaped at every interpolation point.
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Renders a dismiss-free inline alert into `container`; pass null to clear it. */
export function renderAlert(container, alert) {
  if (!alert) {
    container.innerHTML = '';
    container.hidden = true;
    return;
  }

  container.hidden = false;
  container.innerHTML = `<div class="alert alert--${alert.variant}" role="${
    alert.variant === 'error' ? 'alert' : 'status'
  }">${escapeHtml(alert.message)}</div>`;
}

/**
 * Formats a stored **wall-clock** timestamp for display, without shifting it
 * between time zones.
 *
 * `formatTimestamp` reads its input as UTC, which is right for `datetime('now')`
 * audit stamps. A TAT deadline is not an instant, though — "27 Aug 18:00" is a
 * commitment on the clock on the wall, and re-zoning it to 23:30 would be
 * telling the admin something untrue. So the parts are read out and rebuilt in
 * the local zone, which renders the same clock face everywhere.
 */
export function formatWallClockTimestamp(value) {
  if (!value) {
    return null;
  }

  const parts = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(value);

  if (!parts) {
    return value;
  }

  const [, year, month, day, hour, minute] = parts;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour ?? 0),
    Number(minute ?? 0),
  );

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    dateStyle: 'medium',
    ...(hour === undefined ? {} : { timeStyle: 'short' }),
  });
}

/** Formats an ISO/SQLite timestamp for display, falling back to the raw value. */
export function formatTimestamp(value) {
  if (!value) {
    return null;
  }

  // SQLite's datetime('now') yields "YYYY-MM-DD HH:MM:SS" in UTC.
  const isoish = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const parsed = new Date(isoish);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
