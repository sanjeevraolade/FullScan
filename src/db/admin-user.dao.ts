import { getCollection, sessionOption } from './connection.js';
import { fromDocument, type StoredDocument } from './documents.js';
import { CASE_INSENSITIVE } from './schema.js';
import { nowTimestamp } from './timestamp.js';
import type { AdminRole, AdminUserRow } from '../types/admin.types.js';

type AdminUserDocument = StoredDocument<AdminUserRow>;

function adminUsers() {
  return getCollection<AdminUserDocument>('admin_users');
}

export interface AdminUserInsertValues {
  readonly id: string;
  readonly username: string;
  readonly name: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly role: AdminRole;
  readonly createdBy: string;
}

export async function findAdminUserById(id: string): Promise<AdminUserRow | undefined> {
  const document = await adminUsers().findOne({ _id: id }, sessionOption());
  return document ? fromDocument<AdminUserRow>(document) : undefined;
}

/**
 * Sign-in lookup: matches the username exactly or the email case-insensitively.
 * A username match wins, should one account's username ever equal another's email.
 */
export async function findAdminUserByLogin(identifier: string): Promise<AdminUserRow | undefined> {
  const document =
    (await adminUsers().findOne({ username: identifier }, sessionOption())) ??
    (await adminUsers().findOne({ email: identifier }, { collation: CASE_INSENSITIVE, ...sessionOption() }));

  return document ? fromDocument<AdminUserRow>(document) : undefined;
}

/** True when `value` is already taken as an email or a username by any admin. */
export async function isAdminIdentifierTaken(value: string): Promise<boolean> {
  const document = await adminUsers().findOne(
    { $or: [{ email: value }, { username: value }] },
    { collation: CASE_INSENSITIVE, projection: { _id: 1 }, ...sessionOption() },
  );
  return document !== null;
}

/** Every admin account — super admins first, then by name. */
export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const documents = await adminUsers()
    .aggregate(
      [
        { $set: { is_super_admin: { $eq: ['$role', 'super_admin'] } } },
        { $sort: { is_super_admin: -1, is_active: -1, name: 1 } },
        { $unset: 'is_super_admin' },
      ],
      { collation: CASE_INSENSITIVE, ...sessionOption() },
    )
    .toArray();

  return documents.map((document) => fromDocument<AdminUserRow>(document));
}

export async function insertAdminUser(values: AdminUserInsertValues): Promise<void> {
  const now = nowTimestamp();

  await adminUsers().insertOne(
    {
      _id: values.id,
      username: values.username,
      name: values.name,
      email: values.email,
      password_hash: values.passwordHash,
      role: values.role,
      is_active: 1,
      last_login_at: null,
      created_at: now,
      updated_at: now,
      created_by: values.createdBy,
    },
    sessionOption(),
  );
}

export interface AdminUserChanges {
  readonly role?: AdminRole;
  readonly isActive?: boolean;
}

/** Applies a role and/or active-status change; untouched fields keep their value. */
export async function updateAdminUser(id: string, changes: AdminUserChanges): Promise<void> {
  await adminUsers().updateOne(
    { _id: id },
    {
      $set: {
        ...(changes.role === undefined ? {} : { role: changes.role }),
        ...(changes.isActive === undefined ? {} : { is_active: Number(changes.isActive) }),
        updated_at: nowTimestamp(),
      },
    },
    sessionOption(),
  );
}

export interface AdminAuditReferences {
  /** Mobile app settings whose latest change this admin made. */
  readonly settingsChanged: number;
  /** Admin accounts this admin added. */
  readonly adminsAdded: number;
  /** Device change requests this admin approved or rejected. */
  readonly deviceChangesDecided: number;
}

/** Documents that point at this admin — deleting it would orphan them. */
export async function countAdminAuditReferences(id: string): Promise<AdminAuditReferences> {
  return {
    settingsChanged: await getCollection('mobile_app_settings').countDocuments({ updated_by: id }, sessionOption()),
    adminsAdded: await adminUsers().countDocuments({ created_by: id }, sessionOption()),
    deviceChangesDecided: await getCollection('device_change_requests').countDocuments(
      { decided_by: id },
      sessionOption(),
    ),
  };
}

export async function deleteAdminUser(id: string): Promise<void> {
  await adminUsers().deleteOne({ _id: id }, sessionOption());
}

export async function touchAdminUserLastLogin(id: string): Promise<void> {
  await adminUsers().updateOne({ _id: id }, { $set: { last_login_at: nowTimestamp() } }, sessionOption());
}
