import bcrypt from 'bcryptjs';

/**
 * Compared against when the account does not exist (or has no password set), so a
 * missing account costs the same time as a wrong password and cannot be probed for
 * user enumeration. (bcrypt hash of a value no one can submit.)
 */
const DUMMY_PASSWORD_HASH = '$2a$10$UDK0XJ6Bd3vhv7ScA0iiwuZ.tG3zuUmiq73Vx5DnscZo7lKQlymua';

/**
 * Timing-equalised password check. Always runs one bcrypt comparison, whether or not
 * a hash was found — callers must still reject a missing account themselves.
 */
export function verifyPassword(password: string, passwordHash: string | undefined): boolean {
  return bcrypt.compareSync(password, passwordHash || DUMMY_PASSWORD_HASH);
}
