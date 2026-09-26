import { getCollection, sessionOption } from './connection.js';
import { fromDocument, type StoredDocument } from './documents.js';
import type { DropdownCategory, DropdownOptionRow } from '../types/reference-data.types.js';

export async function findDropdownOptionsByCategory(category: DropdownCategory): Promise<DropdownOptionRow[]> {
  const documents = await getCollection<StoredDocument<DropdownOptionRow>>('dropdown_options')
    .find({ category }, { sort: { sort_order: 1 }, ...sessionOption() })
    .toArray();

  return documents.map((document) => fromDocument<DropdownOptionRow>(document));
}
