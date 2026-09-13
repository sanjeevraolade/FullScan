import * as fieldExecutiveDao from '../db/field-executive.dao.js';
import { AppError } from '../utils/app-error.js';
import type { FieldExecutive, FieldExecutiveRow } from '../types/field-executive.types.js';

/** Public profile shape — never carries the password hash or device binding. */
export function toFieldExecutive(row: FieldExecutiveRow): FieldExecutive {
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

export function getCurrentFieldExecutive(fieldExecutiveId: string): FieldExecutive {
  const row = fieldExecutiveDao.findFieldExecutiveById(fieldExecutiveId);

  if (!row) {
    throw new AppError(404, 'No field executive session found');
  }

  return toFieldExecutive(row);
}
