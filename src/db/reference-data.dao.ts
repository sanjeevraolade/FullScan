import { getDb } from './connection.js';
import type { DropdownCategory, DropdownOptionRow } from '../types/reference-data.types.js';

export function findDropdownOptionsByCategory(category: DropdownCategory): DropdownOptionRow[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM dropdown_options WHERE category = ? ORDER BY sort_order');
  return stmt.all(category) as DropdownOptionRow[];
}
