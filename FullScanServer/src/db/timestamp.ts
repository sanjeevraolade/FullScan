/**
 * Timestamps are stored as UTC text in `YYYY-MM-DD HH:MM:SS` — the format SQLite's
 * `datetime('now')` produced before the move to MongoDB. Every API response, both web
 * apps and the mobile app already read that shape, and it sorts correctly as a string,
 * so the documents keep it rather than switching to BSON dates.
 */

/**
 * `date` in the stored timestamp format — also used to store a client-supplied ISO 8601
 * time. Sub-second precision is truncated, not rounded.
 */
export function formatTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

/** Now, in the stored timestamp format. */
export function nowTimestamp(): string {
  return formatTimestamp(new Date());
}

/** `days` ago, in the stored timestamp format — SQLite's `datetime('now', '-N days')`. */
export function timestampDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return formatTimestamp(date);
}

/**
 * Now, as ISO 8601 UTC with milliseconds (`2026-10-04T09:15:02.481Z`). The one
 * deliberate exception to the format above: the master-data version
 * (`app_metadata.master_data.updated_at`) is compared for equality by the mobile app,
 * and at second resolution two admin saves within the same second would leave it
 * unchanged — see the monorepo's docs/api-contracts/master-data-sync.md.
 */
export function nowIsoTimestamp(): string {
  return new Date().toISOString();
}
