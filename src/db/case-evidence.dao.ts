import { ObjectId } from 'mongodb';
import { getCollection, runInTransaction, sessionOption } from './connection.js';
import { EXPOSE_ID, fromDocument } from './documents.js';
import { nowTimestamp } from './timestamp.js';
import type { CaseEvidenceRow, CaseEvidenceWithUploaderRow } from '../types/fe-web-evidence.types.js';

export type NewCaseEvidenceRow = Omit<CaseEvidenceRow, 'uploaded_at' | 'source'>;

/** Newest first; `insert_order` keeps one batch (same second) in upload order. */
const NEWEST_FIRST = { uploaded_at: -1, insert_order: -1 } as const;

export async function findEvidenceByComponent(componentId: string): Promise<CaseEvidenceRow[]> {
  const documents = await getCollection('case_evidence')
    .find({ component_id: componentId }, { sort: NEWEST_FIRST, ...sessionOption() })
    .toArray();
  return documents.map((document) => fromDocument<CaseEvidenceRow>(document));
}

/** Evidence for every component of a case, with the uploading executive. */
export async function findEvidenceByCase(caseId: string): Promise<CaseEvidenceWithUploaderRow[]> {
  const componentIds = await getCollection('case_components').distinct('_id', { case_id: caseId }, sessionOption());

  return getCollection('case_evidence')
    .aggregate<CaseEvidenceWithUploaderRow>(
      [
        { $match: { component_id: { $in: componentIds } } },
        { $sort: NEWEST_FIRST },
        { $lookup: { from: 'field_executives', localField: 'field_executive_id', foreignField: '_id', as: 'uploader' } },
        { $unwind: '$uploader' },
        { $set: { field_executive_name: '$uploader.name', field_executive_username: '$uploader.username' } },
        { $unset: 'uploader' },
        ...EXPOSE_ID,
      ],
      sessionOption(),
    )
    .toArray();
}

/** Inserts every row or none. */
export async function insertEvidenceRows(rows: readonly NewCaseEvidenceRow[]): Promise<void> {
  const uploadedAt = nowTimestamp();

  await runInTransaction(async () => {
    await getCollection('case_evidence').insertMany(
      rows.map(({ id, ...fields }) => ({
        _id: id,
        ...fields,
        source: 'web_upload',
        uploaded_at: uploadedAt,
        insert_order: new ObjectId(),
      })),
      sessionOption(),
    );
  });
}
