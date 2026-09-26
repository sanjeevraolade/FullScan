const WALL_CLOCK_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/;

/**
 * Parses a server wall-clock timestamp (`YYYY-MM-DD HH:MM[:SS]`) as local time. A TAT
 * deadline is a time on the clock, not an instant, so it must not be re-zoned —
 * the same reasoning as the Admin Portal's `formatWallClockTimestamp`.
 */
export function parseWallClock(value: string): Date | null {
  const parts = WALL_CLOCK_PATTERN.exec(value);
  if (!parts) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = parts;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour ?? 0),
    Number(minute ?? 0),
    Number(second ?? 0),
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const TIME_ZONE_SUFFIX = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;

/** Parses a `datetime('now')` audit stamp, which SQLite writes in UTC. */
export function parseUtcTimestamp(value: string): Date | null {
  const isoValue = value.replace(' ', 'T');
  const parsed = new Date(TIME_ZONE_SUFFIX.test(isoValue) ? isoValue : `${isoValue}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };

export function formatWallClock(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  return parseWallClock(value)?.toLocaleString(undefined, DATE_TIME_FORMAT) ?? value;
}

export function formatUtcTimestamp(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  return parseUtcTimestamp(value)?.toLocaleString(undefined, DATE_TIME_FORMAT) ?? value;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ADDRESS_TYPE_LABELS: Readonly<Record<string, string>> = {
  present: 'Present address',
  permanent: 'Permanent address',
  previous: 'Previous address',
};

const RESIDENCE_TYPE_LABELS: Readonly<Record<string, string>> = {
  owned: 'Owned',
  rented: 'Rented',
  hostel: 'Hostel',
  paying_guest: 'Paying guest',
  company_quarters: 'Company quarters',
  relative_owned: 'Relative owned',
};

export function formatAddressType(addressType: string | null): string | null {
  return addressType ? (ADDRESS_TYPE_LABELS[addressType] ?? addressType) : null;
}

export function formatResidenceType(residenceType: string | null): string {
  return residenceType ? (RESIDENCE_TYPE_LABELS[residenceType] ?? residenceType) : '—';
}

export function toInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  return initials || '?';
}
