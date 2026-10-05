/**
 * Why a local file could not be read.
 *
 * - `unreadable` — the platform could not open the file at all: it does not
 *   exist (e.g. purged from the OS temp/cache directory) or is not accessible.
 * - `readFailed` — the file opened but its bytes could not be read/encoded.
 * - `emptyFile` — the file holds no bytes.
 * - `unexpectedResult` — the platform reader returned something that is not a
 *   base64 data URL.
 */
export type FileReadFailureReason = 'unreadable' | 'readFailed' | 'emptyFile' | 'unexpectedResult';
