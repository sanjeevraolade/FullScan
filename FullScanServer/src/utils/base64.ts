/**
 * Strict standard base64 (RFC 4648 §4): `A–Z a–z 0–9 + /`, `=` padding only at the
 * end, length a multiple of 4. Node's `Buffer.from(value, 'base64')` is lenient — it
 * skips characters outside the alphabet and accepts missing padding, the URL-safe
 * alphabet and whitespace — so input is checked with this before it is decoded.
 */

/** Any character outside the standard alphabet. A single negated class: no backtracking on large inputs. */
const OUTSIDE_ALPHABET = /[^A-Za-z0-9+/]/;

function paddingLength(value: string): number {
  if (value.endsWith('==')) {
    return 2;
  }
  return value.endsWith('=') ? 1 : 0;
}

/** True for a non-empty string of strict standard base64. No `data:` prefix, whitespace or line breaks. */
export function isStrictBase64(value: string): boolean {
  if (value.length === 0 || value.length % 4 !== 0) {
    return false;
  }

  const body = value.slice(0, value.length - paddingLength(value));
  return !OUTSIDE_ALPHABET.test(body);
}

/** The decoded size of a strict base64 string, without decoding it. */
export function base64DecodedLength(value: string): number {
  return (value.length / 4) * 3 - paddingLength(value);
}
