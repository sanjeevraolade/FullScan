import type { Document } from 'mongodb';
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

/** Records the field executive's verification outcome and moves the component to Completed. */
export async function updateComponentVerificationOutcome(
  componentId: string,
  outcome: VerificationOutcomeInput,
): Promise<CaseComponentRow> {
  await getCollection('case_components').updateOne(
    { _id: componentId },
    {
      $set: {
        bucket: 'completed',
        selected_verification_status: outcome.verificationStatus,
        respondent_name: outcome.respondent?.name ?? null,
        respondent_relation: outcome.respondent?.relation ?? null,
        updated_at: nowTimestamp(),
      },
    },
    sessionOption(),
  );
  return (await findComponentById(componentId))!;
}
