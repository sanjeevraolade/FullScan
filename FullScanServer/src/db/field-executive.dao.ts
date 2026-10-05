import type { Filter } from 'mongodb';
import { getCollection, sessionOption } from './connection.js';
import { fromDocument, type StoredDocument } from './documents.js';
import type { FieldExecutiveRow } from '../types/field-executive.types.js';

type FieldExecutiveDocument = StoredDocument<FieldExecutiveRow>;

function fieldExecutives() {
  return getCollection<FieldExecutiveDocument>('field_executives');
}

async function findOne(filter: Partial<FieldExecutiveDocument>): Promise<FieldExecutiveRow | undefined> {
  const document = await fieldExecutives().findOne(filter, sessionOption());
  return document ? fromDocument<FieldExecutiveRow>(document) : undefined;
}

export function findFieldExecutiveById(id: string): Promise<FieldExecutiveRow | undefined> {
  return findOne({ _id: id });
}

export function findFieldExecutiveByUsername(username: string): Promise<FieldExecutiveRow | undefined> {
  return findOne({ username });
}

export function findFieldExecutiveByDeviceId(deviceId: string): Promise<FieldExecutiveRow | undefined> {
  return findOne({ device_id: deviceId });
}

/**
 * Moves the account's mobile session version on by one (an absent version counts as 0)
 * and returns the new value, or undefined if there is no such account. A single atomic
 * update, so concurrent logins each get a distinct version and only the last one holds.
 */
export async function incrementMobileSessionVersion(id: string): Promise<number | undefined> {
  const document = await fieldExecutives().findOneAndUpdate(
    { _id: id },
    { $inc: { mobile_session_version: 1 } },
    { returnDocument: 'after', projection: { mobile_session_version: 1 }, ...sessionOption() },
  );
  return document?.mobile_session_version;
}

/**
 * Moves the account's mobile session version on by one, but only while it still equals
 * `expectedVersion` (an absent version counts as 0). Returns whether it did: false when
 * the account is gone or the version has already moved on (a newer login, or another
 * logout of the same session).
 */
export async function incrementMobileSessionVersionIfCurrent(id: string, expectedVersion: number): Promise<boolean> {
  const versionFilter: Filter<FieldExecutiveDocument> =
    expectedVersion === 0
      ? { $or: [{ mobile_session_version: 0 }, { mobile_session_version: { $exists: false } }] }
      : { mobile_session_version: expectedVersion };

  const result = await fieldExecutives().updateOne(
    { _id: id, ...versionFilter },
    { $inc: { mobile_session_version: 1 } },
    sessionOption(),
  );
  return result.modifiedCount === 1;
}

export async function updateFieldExecutiveDeviceBinding(
  id: string,
  deviceId: string,
  deviceDetails: string,
): Promise<void> {
  await fieldExecutives().updateOne(
    { _id: id },
    { $set: { device_id: deviceId, device_details: deviceDetails } },
    sessionOption(),
  );
}
