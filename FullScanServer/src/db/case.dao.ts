import { ObjectId, type Document } from 'mongodb';
import { getCollection, sessionOption } from './connection.js';
import { EXPOSE_ID, JOIN_PARENT_CASE } from './documents.js';
import { nowTimestamp } from './timestamp.js';
import type { CaseBucket, CaseComponentRow, VerificationOutcomeInput } from '../types/case.types.js';

/** Ties on a timestamp come back in the order the components were written, as SQLite's did. */
export const COMPONENTS_NEWEST_FIRST = { updated_at: -1, insert_order: 1 } as const;

/** `case_components` joined with the parent case — the `SELECT cc.*, c.…` the queries share. */
async function findComponentRows(stages: readonly Document[]): Promise<CaseComponentRow[]> {
  return getCollection('case_components')
    .aggregate<CaseComponentRow>([...stages, ...JOIN_PARENT_CASE, ...EXPOSE_ID], sessionOption())
    .toArray();
}

export function findComponentsByFieldExecutive(fieldExecutiveId: string): Promise<CaseComponentRow[]> {
  return findComponentRows([
    { $match: { assigned_field_executive_id: fieldExecutiveId } },
    { $sort: COMPONENTS_NEWEST_FIRST },
  ]);
}

/**
 * A position in `COMPONENTS_NEWEST_FIRST` order — the sort key of one component. A
 * page that starts after it holds the rows strictly after that component.
 */
export interface ComponentPageKey {
  readonly updatedAt: string;
  /** The component's `insert_order` ObjectId, as its 24-character hex string. */
  readonly insertOrder: string;
}

export interface ComponentPageEntry {
  readonly row: CaseComponentRow;
  readonly key: ComponentPageKey;
}

/** The hex form `ComponentPageKey.insertOrder` must have. */
export function isInsertOrderKey(value: string): boolean {
  return /^[0-9a-f]{24}$/.test(value);
}

/**
 * One keyset page of the components assigned to this executive in one bucket, newest
 * first (`COMPONENTS_NEWEST_FIRST`), starting strictly after `after` (or at the top).
 * Keyset rather than offset, so a component leaving the bucket mid-scroll cannot make
 * the next page skip one. Served by the `assigned_bucket_newest_first` index.
 */
export async function findComponentsPageByFieldExecutive(
  fieldExecutiveId: string,
  bucket: CaseBucket,
  after: ComponentPageKey | null,
  limit: number,
): Promise<ComponentPageEntry[]> {
  const match: Document = { assigned_field_executive_id: fieldExecutiveId, bucket };

  if (after) {
    const insertOrder = new ObjectId(after.insertOrder);
    match.$or = [
      { updated_at: { $lt: after.updatedAt } },
      { updated_at: after.updatedAt, insert_order: { $gt: insertOrder } },
    ];
  }

  // Unlike `findComponentRows`, keep `insert_order`: it is half of the next page's key.
  const documents = await getCollection('case_components')
    .aggregate<CaseComponentRow & { readonly insert_order: ObjectId }>(
      [
        { $match: match },
        { $sort: COMPONENTS_NEWEST_FIRST },
        { $limit: limit },
        ...JOIN_PARENT_CASE,
        { $set: { id: '$_id' } },
        { $unset: '_id' },
      ],
      sessionOption(),
    )
    .toArray();

  return documents.map(({ insert_order: insertOrder, ...row }) => ({
    row,
    key: { updatedAt: row.updated_at, insertOrder: insertOrder.toHexString() },
  }));
}

/** How many components this executive holds in each of `buckets`; a bucket with none is absent. */
export async function countComponentsByFieldExecutive(
  fieldExecutiveId: string,
  buckets: readonly CaseBucket[],
): Promise<ReadonlyMap<CaseBucket, number>> {
  const groups = await getCollection('case_components')
    .aggregate<{ readonly _id: CaseBucket; readonly count: number }>(
      [
        { $match: { assigned_field_executive_id: fieldExecutiveId, bucket: { $in: [...buckets] } } },
        { $group: { _id: '$bucket', count: { $sum: 1 } } },
      ],
      sessionOption(),
    )
    .toArray();

  return new Map(groups.map((group) => [group._id, group.count]));
}

/** Size of the whole 'new' bucket pool `findRandomNewComponents` draws from. */
export function countNewComponents(): Promise<number> {
  return getCollection('case_components').countDocuments({ bucket: 'new' }, sessionOption());
}

export async function findComponentById(componentId: string): Promise<CaseComponentRow | undefined> {
  const [row] = await findComponentRows([{ $match: { _id: componentId } }]);
  return row;
}

export function findSiblingComponents(caseId: string, excludingComponentId: string): Promise<CaseComponentRow[]> {
  return findComponentRows([
    { $match: { case_id: caseId, _id: { $ne: excludingComponentId } } },
    { $sort: { created_at: 1, insert_order: 1 } },
  ]);
}

/** Random draw from the whole 'new' bucket pool, simulating a live incoming-case feed. */
export function findRandomNewComponents(limit: number): Promise<CaseComponentRow[]> {
  return findComponentRows([{ $match: { bucket: 'new' } }, { $sample: { size: limit } }]);
}

export async function updateComponentBucket(
  componentId: string,
  bucket: CaseBucket,
  fieldExecutiveId?: string,
): Promise<CaseComponentRow> {
  await getCollection('case_components').updateOne(
    { _id: componentId },
    {
      $set: {
        bucket,
        ...(fieldExecutiveId ? { assigned_field_executive_id: fieldExecutiveId } : {}),
        updated_at: nowTimestamp(),
      },
    },
    sessionOption(),
  );
  return (await findComponentById(componentId))!;
}

/**
 * Records the field executive's verification outcome, every field as sent, and moves the
 * component to Completed. The back-office `address_type` / `residence_type` are never
 * written here: what the executive observed goes into `observed_*`.
 */
export async function updateComponentVerificationOutcome(
  componentId: string,
  outcome: VerificationOutcomeInput,
): Promise<CaseComponentRow> {
  const now = nowTimestamp();

  await getCollection('case_components').updateOne(
    { _id: componentId },
    {
      $set: {
        bucket: 'completed',
        selected_verification_status: outcome.verificationStatus,
        respondent_name: outcome.respondent?.name ?? null,
        respondent_relation: outcome.respondent?.relation ?? null,
        utv_reason: outcome.utvReason,
        utv_remarks: outcome.utvRemarks,
        insufficient_reason: outcome.insufficientReason,
        insufficient_remarks: outcome.insufficientRemarks,
        observed_residence_type: outcome.residenceType,
        observed_address_type: outcome.addressType,
        is_signature_captured: outcome.isSignatureCaptured,
        submitted_latitude: outcome.currentLatitude,
        submitted_longitude: outcome.currentLongitude,
        submitted_distance_meters: outcome.distanceToCaseMeters,
        is_force_proceed: outcome.forceProceed,
        outcome_submitted_at: now,
        updated_at: now,
      },
    },
    sessionOption(),
  );
  return (await findComponentById(componentId))!;
}
