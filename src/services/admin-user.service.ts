import { randomInt } from 'crypto';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import * as adminUserDao from '../db/admin-user.dao.js';
import { toAdminUser } from './admin-auth.service.js';
import { AppError } from '../utils/app-error.js';
import type {
  AdminUserRow,
  AdminUserSummary,
  CreateAdminUserInput,
  CreateAdminUserResult,
  UpdateAdminUserInput,
} from '../types/admin.types.js';

const BCRYPT_COST = 10;
const TEMPORARY_PASSWORD_LENGTH = 16;

/** No 0/O, 1/l/I — the password is read off a screen and typed in by hand. */
const PASSWORD_ALPHABETS = {
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lower: 'abcdefghijkmnopqrstuvwxyz',
  digit: '23456789',
  symbol: '@#$%&*!?',
} as const;

function pickRandom(alphabet: string): string {
  return alphabet[randomInt(alphabet.length)];
}

/**
 * A strong one-time password from a CSPRNG, guaranteed to contain every character
 * class so it also satisfies any complexity rule added later.
 */
export function generateTemporaryPassword(): string {
  const everyCharacter = Object.values(PASSWORD_ALPHABETS).join('');
  const characters = Object.values(PASSWORD_ALPHABETS).map(pickRandom);

  while (characters.length < TEMPORARY_PASSWORD_LENGTH) {
    characters.push(pickRandom(everyCharacter));
  }

  // Fisher–Yates, so the guaranteed classes do not always sit at the front.
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1);
    [characters[index], characters[swap]] = [characters[swap], characters[index]];
  }

  return characters.join('');
}

function toAdminUserSummary(row: AdminUserRow): AdminUserSummary {
  return {
    ...toAdminUser(row),
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

/** Every admin account, for the super admin's list. Never carries a password hash. */
export function listAdminUsers(): AdminUserSummary[] {
  return adminUserDao.listAdminUsers().map(toAdminUserSummary);
}

/**
 * Adds an admin by email. The email (lower-cased) doubles as the username, and a
 * temporary password is generated and returned once for the super admin to hand over.
 */
export function createAdminUser(
  input: CreateAdminUserInput,
  createdByAdminUserId: string,
): CreateAdminUserResult {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  // Checked against usernames too: the new username *is* this email, and seeded
  // usernames live in the same sign-in namespace.
  if (adminUserDao.isAdminIdentifierTaken(email)) {
    throw new AppError(409, 'An admin with this email already exists');
  }

  const temporaryPassword = generateTemporaryPassword();
  const id = `admin-${uuidv4()}`;

  adminUserDao.insertAdminUser({
    id,
    username: email,
    name,
    email,
    passwordHash: bcrypt.hashSync(temporaryPassword, BCRYPT_COST),
    role: input.role,
    createdBy: createdByAdminUserId,
  });

  const row = adminUserDao.findAdminUserById(id);
  if (!row) {
    throw new AppError(500, 'The admin account could not be created');
  }

  return { adminUser: toAdminUserSummary(row), temporaryPassword };
}

/**
 * Loads the admin a super admin wants to change and refuses self-targeting.
 *
 * Refusing self-changes is also what guarantees the portal always keeps an active
 * super admin: the caller is one (the route requires it), and they can never demote,
 * deactivate or delete themselves — so whatever they do to others, they remain.
 */
function findManageableAdmin(targetAdminUserId: string, actingAdminUserId: string): AdminUserRow {
  const row = adminUserDao.findAdminUserById(targetAdminUserId);

  if (!row) {
    throw new AppError(404, 'Admin user not found');
  }

  if (row.id === actingAdminUserId) {
    throw new AppError(
      409,
      'You cannot change your own role, deactivate or delete your own account. Ask another super admin.',
    );
  }

  return row;
}

/**
 * Promotes/demotes and deactivates/reactivates another admin. Takes effect on that
 * admin's next request — `verifyAdminToken` reads role and status from the row.
 */
export function updateAdminUser(
  targetAdminUserId: string,
  changes: UpdateAdminUserInput,
  actingAdminUserId: string,
): AdminUserSummary {
  findManageableAdmin(targetAdminUserId, actingAdminUserId);

  adminUserDao.updateAdminUser(targetAdminUserId, changes);

  const updated = adminUserDao.findAdminUserById(targetAdminUserId);
  if (!updated) {
    throw new AppError(404, 'Admin user not found');
  }

  return toAdminUserSummary(updated);
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * Permanently deletes another admin.
 *
 * An admin referenced by the audit trail — the latest change to a mobile app
 * setting, or an admin account they added — is refused with 409: deleting them
 * would erase who did what. Deactivation removes their access and keeps the record.
 */
export function deleteAdminUser(targetAdminUserId: string, actingAdminUserId: string): void {
  const row = findManageableAdmin(targetAdminUserId, actingAdminUserId);
  const { settingsChanged, adminsAdded } = adminUserDao.countAdminAuditReferences(row.id);

  if (settingsChanged > 0 || adminsAdded > 0) {
    const history = [
      settingsChanged > 0 ? `last changed ${pluralize(settingsChanged, 'mobile app setting')}` : null,
      adminsAdded > 0 ? `added ${pluralize(adminsAdded, 'admin')}` : null,
    ]
      .filter(Boolean)
      .join(' and ');

    throw new AppError(
      409,
      `${row.name} ${history}, so deleting the account would erase that audit history. Deactivate it instead.`,
    );
  }

  adminUserDao.deleteAdminUser(row.id);
}
