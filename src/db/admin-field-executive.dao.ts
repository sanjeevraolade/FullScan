import type { Document } from 'mongodb';
import { getCollection, sessionOption } from './connection.js';
import { COMPONENTS_NEWEST_FIRST } from './case.dao.js';
import { containsText, fromDocument, JOIN_PARENT_CASE } from './documents.js';
import type {
  AdminFieldExecutiveRow,
  FieldExecutiveComponentRow,
} from '../types/admin-field-executive.types.js';
import type { MockLocationEventRow } from '../types/mock-location.types.js';

/**
 * Admin reads over field executives and the evidence trail behind them.
 *
 * `mock_location_events.case_id` holds a **case component** id — the app reports
 * whatever it was working on, and its unit of work is the component — so history
 * joins detections to `case_components`, not to `cases`.
 */

/** Each executive with their assignment and detection counts — the old correlated subqueries. */
const WITH_COUNTS: readonly Document[] = [
  {
    $lookup: {
      from: 'case_components',
      localField: '_id',
      foreignField: 'assigned_field_executive_id',
      as: 'assigned',
      pipeline: [{ $match: { bucket: { $ne: 'new' } } }, { $count: 'total' }],
    },
  },
  {
    $lookup: {
      from: 'mock_location_events',
      localField: '_id',
      foreignField: 'field_executive_id',
      as: 'detections',
      pipeline: [{ $group: { _id: null, total: { $sum: 1 }, last: { $max: '$detected_at' } } }],
    },
  },
  {
    $project: {
      _id: 0,
      id: '$_id',
      name: 1,
      email: 1,
      role: 1,
      username: 1,
      device_id: 1,
      assigned_component_count: { $ifNull: [{ $first: '$assigned.total' }, 0] },
      mock_location_event_count: { $ifNull: [{ $first: '$detections.total' }, 0] },
      last_mock_location_detected_at: { $ifNull: [{ $first: '$detections.last' }, null] },
    },
  },
];

/**
 * The picker list. Executives with detections are floated to the top — a fraud
 * review starts there, and the seeded roster is 51 names long.
 */
export function findFieldExecutivesForAdmin(search?: string): Promise<AdminFieldExecutiveRow[]> {
  const match: Document = {};

  if (search) {
    const term = containsText(search);
    match.$or = [{ name: term }, { username: term }, { email: term }];
  }

  return getCollection('field_executives')
    .aggregate<AdminFieldExecutiveRow>(
      [
        { $match: match },
        ...WITH_COUNTS,
        { $sort: { mock_location_event_count: -1, last_mock_location_detected_at: -1, name: 1 } },
      ],
      sessionOption(),
    )
    .toArray();
}

export async function findFieldExecutiveForAdmin(id: string): Promise<AdminFieldExecutiveRow | undefined> {
  const [row] = await getCollection('field_executives')
    .aggregate<AdminFieldExecutiveRow>([{ $match: { _id: id } }, ...WITH_COUNTS], sessionOption())
    .toArray();
  return row;
}

/** Component columns for history, joined with the parent case. */
function findHistoryComponents(stages: readonly Document[]): Promise<FieldExecutiveComponentRow[]> {
  return getCollection('case_components')
    .aggregate<FieldExecutiveComponentRow>(
      [
        ...stages,
        ...JOIN_PARENT_CASE,
        {
          $project: {
            _id: 0,
            id: '$_id',
            case_id: 1,
            verification_type: 1,
            address_type: 1,
            address: 1,
            bucket: 1,
            component_status: 1,
            action_status: 1,
            tat_due_at: 1,
            updated_at: 1,
            case_ref: 1,
            client_name: 1,
            candidate_name: 1,
          },
        },
      ],
      sessionOption(),
    )
    .toArray();
}

/**
 * Components this executive actually holds, newest activity first.
 *
 * The `new` bucket is excluded: it is the shared pool of unclaimed work, which
 * the mobile app re-draws at random on every request, so a New row says nothing
 * about what this executive has done. Accepting a case is what claims it, and
 * that moves it to `pending`.
 */
export function findComponentsAssignedToFieldExecutive(
  fieldExecutiveId: string,
): Promise<FieldExecutiveComponentRow[]> {
  return findHistoryComponents([
    { $match: { assigned_field_executive_id: fieldExecutiveId, bucket: { $ne: 'new' } } },
    { $sort: COMPONENTS_NEWEST_FIRST },
  ]);
}

/** Every detection recorded against this executive, most recent first. */
export async function findMockLocationEventsForFieldExecutive(
  fieldExecutiveId: string,
): Promise<MockLocationEventRow[]> {
  const documents = await getCollection('mock_location_events')
    .find({ field_executive_id: fieldExecutiveId }, { sort: { detected_at: -1 }, ...sessionOption() })
    .toArray();
  return documents.map((document) => fromDocument<MockLocationEventRow>(document));
}

/**
 * Components a detection points at that the executive is no longer assigned —
 * reassignment must not hide the case a detection happened on.
 */
export function findComponentsByIds(componentIds: readonly string[]): Promise<FieldExecutiveComponentRow[]> {
  if (componentIds.length === 0) {
    return Promise.resolve([]);
  }

  return findHistoryComponents([{ $match: { _id: { $in: [...componentIds] } } }]);
}

/** Distinct handsets detections came from — more than one is itself a signal. */
export async function countDistinctMockLocationDevices(fieldExecutiveId: string): Promise<number> {
  const deviceIds = await getCollection('mock_location_events').distinct(
    'device_id',
    { field_executive_id: fieldExecutiveId, device_id: { $ne: null } },
    sessionOption(),
  );
  return deviceIds.length;
}
