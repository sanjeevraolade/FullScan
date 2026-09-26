/**
 * Timestamps are stored as UTC text in `YYYY-MM-DD HH:MM:SS` — the format SQLite's
 * `datetime('now')` produced before the move to MongoDB. Every API response, both web
 * apps and the mobile app already read that shape, and it sorts correctly as a string,
 * so the documents keep it rather than switching to BSON dates.
 */
function formatTimestamp(date: Date): string {
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
