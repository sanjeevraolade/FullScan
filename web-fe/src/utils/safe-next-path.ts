/** Where the app is mounted — keep in step with `base` in vite.config.ts. */
export const APP_BASE_PATH = '/app';

const MAX_NEXT_LENGTH = 2048;

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * Turns a `?next=` value into an in-app route, or null when it is not safe to follow.
 *
 * The server's page guard sends the full browser path (`/app/assignments/x`), so the
 * value must sit under `/app`. Anything that could leave the app — absolute URLs,
 * protocol-relative `//host`, backslashes (which browsers read as `/`), encoded
 * slashes, control characters — is rejected, so the login page is never an open
 * redirect.
 */
export function toSafeAppRoute(next: string | null | undefined): string | null {
  if (!next || next.length > MAX_NEXT_LENGTH) {
    return null;
  }

  if (next.includes('\\') || hasControlCharacter(next) || /%(?:2f|5c)/i.test(next)) {
    return null;
  }

  if (!next.startsWith('/') || next.startsWith('//')) {
    return null;
  }

  const isAppPath =
    next === APP_BASE_PATH ||
    next.startsWith(`${APP_BASE_PATH}/`) ||
    next.startsWith(`${APP_BASE_PATH}?`) ||
    next.startsWith(`${APP_BASE_PATH}#`);

  if (!isAppPath) {
    return null;
  }

  const route = next.slice(APP_BASE_PATH.length);
  if (route.startsWith('//')) {
    return null;
  }

  const normalized = route.startsWith('/') ? route : `/${route}`;
  return normalized === '/login' || normalized.startsWith('/login?') || normalized.startsWith('/login/')
    ? '/'
    : normalized;
}
