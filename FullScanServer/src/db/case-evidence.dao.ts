import { MongoServerError, ObjectId } from 'mongodb';
import { getCollection, runInTransaction, sessionOption } from './connection.js';
import { EXPOSE_ID, fromDocument } from './documents.js';
import { MOBILE_CAPTURE_SHA256_INDEX } from './schema.js';
import { nowTimestamp } from './timestamp.js';
import type {
  CaseEvidenceRow,
  CaseEvidenceWithUploaderRow,
  MobileCaptureEvidenceRow,
  WebUploadEvidenceRow,
} from '../types/case-evidence.types.js';

export type NewWebUploadEvidenceRow = Omit<WebUploadEvidenceRow, 'uploaded_at' | 'source'>;

export type NewMobileCaptureEvidenceRow = Omit<MobileCaptureEvidenceRow, 'uploaded_at' | 'source'>;

/**
 * Thrown by `insertMobileCaptureRow` when the component already has a mobile capture
 * with the same bytes — the `MOBILE_CAPTURE_SHA256_INDEX` partial unique index refused it.
 */
export class DuplicateMobileCaptureError extends Error {
  constructor() {
    super('A mobile capture with the same content already exists for this component');
    Object.setPrototypeOf(this, DuplicateMobileCaptureError.prototype);
  }
}

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

/** The component's mobile capture with these bytes, if one was recorded. Served by `MOBILE_CAPTURE_SHA256_INDEX`. */
export async function findMobileCaptureBySha256(
  componentId: string,
  sha256: string,
): Promise<MobileCaptureEvidenceRow | undefined> {
  const document = await getCollection('case_evidence').findOne(
    { component_id: componentId, sha256, source: 'mobile_capture' },
    sessionOption(),
  );
  return document ? fromDocument<MobileCaptureEvidenceRow>(document) : undefined;
}

/** Inserts every row or none. */
export async function insertEvidenceRows(rows: readonly NewWebUploadEvidenceRow[]): Promise<void> {
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

function isDuplicateMobileCapture(err: unknown): boolean {
  return err instanceof MongoServerError && err.code === 11000 && err.message.includes(MOBILE_CAPTURE_SHA256_INDEX);
}

/**
 * Records one mobile capture and returns it as stored. A single-document insert, so it
 * needs no transaction. Throws `DuplicateMobileCaptureError` if a concurrent request
 * already recorded the same bytes for the component.
 */
export async function insertMobileCaptureRow(row: NewMobileCaptureEvidenceRow): Promise<MobileCaptureEvidenceRow> {
  const stored: MobileCaptureEvidenceRow = { ...row, source: 'mobile_capture', uploaded_at: nowTimestamp() };
  const { id, ...fields } = stored;

  try {
    await getCollection('case_evidence').insertOne({ _id: id, ...fields, insert_order: new ObjectId() }, sessionOption());
  } catch (err) {
    if (isDuplicateMobileCapture(err)) {
      throw new DuplicateMobileCaptureError();
    }
    throw err;
  }

  return stored;
}
