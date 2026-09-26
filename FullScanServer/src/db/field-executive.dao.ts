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
