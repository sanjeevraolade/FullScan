import type { Document } from 'mongodb';

/**
 * Helpers shared by the DAOs. Documents keep the SQLite column names; only the
 * primary key moves, from `id` to `_id`. The DAOs still hand the services the same
 * `*Row` shapes they had under SQLite.
 */

/** A stored document for a `*Row` type: `id` lives in `_id`. */
export type StoredDocument<Row extends { readonly id: string }> = Omit<Row, 'id'> & { _id: string };

/** Stored document → `*Row`. Drops the internal `insert_order` tie-breaker. */
export function fromDocument<Row extends { readonly id: string }>(document: Document): Row {
  const { _id, insert_order: _insertOrder, ...fields } = document;
  return { id: _id, ...fields } as Row;
}

/** Last stages of a pipeline whose output should be `*Row`-shaped. */
export const EXPOSE_ID: readonly Document[] = [{ $set: { id: '$_id' } }, { $unset: ['_id', 'insert_order'] }];

/** Parent-case columns a component row carries — the `c.*` half of the old `JOIN cases c`. */
const PARENT_CASE_FIELDS = [
  'case_ref',
  'client_name',
  'candidate_name',
  'primary_contact_number',
  'secondary_contact_number',
  'profile_status',
  'father_or_spouse_name',
  'employer_name',
] as const;

/** `JOIN cases c ON c.id = cc.case_id` — an inner join that copies the case columns onto the component. */
export const JOIN_PARENT_CASE: readonly Document[] = [
  { $lookup: { from: 'cases', localField: 'case_id', foreignField: '_id', as: 'parent_case' } },
  { $unwind: '$parent_case' },
  { $set: Object.fromEntries(PARENT_CASE_FIELDS.map((field) => [field, `$parent_case.${field}`])) },
  { $unset: 'parent_case' },
];

/**
 * `LEFT JOIN <from> x ON x.id = <localField>`, copying `fields` (as `{ outputName: sourceField }`)
 * onto the document — null when there is no match, as SQL's left join returns.
 */
export function leftJoinFields(
  from: string,
  localField: string,
  fields: Readonly<Record<string, string>>,
  foreignField = '_id',
): Document[] {
  const joined = `joined_${from}`;

  return [
    {
      $lookup: {
        from,
        localField,
        foreignField,
        as: joined,
        pipeline: [{ $limit: 1 }],
      },
    },
    {
      $set: Object.fromEntries(
        Object.entries(fields).map(([output, source]) => [
          output,
          { $ifNull: [{ $first: `$${joined}.${source}` }, null] },
        ]),
      ),
    },
    { $unset: joined },
  ];
}

/** SQL `LIKE '%term%'`: a case-insensitive substring match, with the term taken literally. */
export function containsText(term: string): { $regex: string; $options: string } {
  return { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
}
