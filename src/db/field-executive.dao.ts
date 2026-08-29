import { getDb } from './connection.js';
import type { FieldExecutiveRow } from '../types/field-executive.types.js';

export function findFieldExecutiveById(id: string): FieldExecutiveRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM field_executives WHERE id = ?').get(id) as
    | FieldExecutiveRow
    | undefined;
}

export function findFieldExecutiveByUsername(username: string): FieldExecutiveRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM field_executives WHERE username = ?').get(username) as
    | FieldExecutiveRow
    | undefined;
}
