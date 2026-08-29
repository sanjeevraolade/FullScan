import * as fieldExecutiveDao from '../db/field-executive.dao.js';
import { AppError } from '../utils/app-error.js';
import type { FieldExecutive } from '../types/field-executive.types.js';

export function getCurrentFieldExecutive(fieldExecutiveId: string): FieldExecutive {
  const row = fieldExecutiveDao.findFieldExecutiveById(fieldExecutiveId);

  if (!row) {
    throw new AppError(404, 'No field executive session found');
  }

  return { id: row.id, name: row.name, email: row.email, role: row.role };
}
