import { ObjectId, type Document } from 'mongodb';
import { getCollection, sessionOption } from './connection.js';
import { EXPOSE_ID, fromDocument, leftJoinFields } from './documents.js';
import { nowTimestamp, timestampDaysAgo } from './timestamp.js';
import type {
  DeviceChangeRequestDetailRow,
  DeviceChangeRequestFilter,
  DeviceChangeRequestStatus,
  DeviceReleaseReason,
  FieldExecutiveDeviceRow,
} from '../types/device-change.types.js';

/**
 * Device change requests and device binding history.
 *
 * Nothing here deletes a document. Requests move from `pending` to a decision once;
 * bindings are opened and later closed — both are the audit trail.
 */

export { runInTransaction } from './connection.js';

function requests() {
  return getCollection('device_change_requests');
}

function bindings() {
  return getCollection('field_executive_devices');
}

/** Newest first; `insert_order` breaks ties between requests made in the same second. */
const NEWEST_REQUEST_FIRST = { requested_at: -1, insert_order: -1 } as const;
const NEWEST_BINDING_FIRST = { created_at: -1, insert_order: -1 } as const;

/**
 * A request with the executive's name, the deciding admin's name and the binding
 * that followed it — the old `REQUEST_SELECT` joins.
 */
const REQUEST_DETAILS: readonly Document[] = [
  { $lookup: { from: 'field_executives', localField: 'field_executive_id', foreignField: '_id', as: 'fe' } },
  { $unwind: '$fe' },
  { $set: { fe_name: '$fe.name', fe_username: '$fe.username' } },
  { $unset: 'fe' },
  ...leftJoinFields('admin_users', 'decided_by', { decided_by_name: 'name' }),
  ...leftJoinFields(
    'field_executive_devices',
    '_id',
    {
      new_device_id: 'device_id',
      new_device_details: 'device_details',
      new_bound_at: 'bound_at',
      new_last_login_at: 'last_login_at',
    },
    'bound_after_request_id',
  ),
  ...EXPOSE_ID,
];

function findRequestDetails(stages: readonly Document[]): Promise<DeviceChangeRequestDetailRow[]> {
  return requests()
    .aggregate<DeviceChangeRequestDetailRow>([...stages, ...REQUEST_DETAILS], sessionOption())
    .toArray();
}

export async function findDeviceChangeRequestById(id: string): Promise<DeviceChangeRequestDetailRow | undefined> {
  const [row] = await findRequestDetails([{ $match: { _id: id } }]);
  return row;
}

export function findDeviceChangeRequestsForFieldExecutive(
  fieldExecutiveId: string,
): Promise<DeviceChangeRequestDetailRow[]> {
  return findRequestDetails([{ $match: { field_executive_id: fieldExecutiveId } }, { $sort: NEWEST_REQUEST_FIRST }]);
}

export function listDeviceChangeRequests(filter: DeviceChangeRequestFilter): Promise<DeviceChangeRequestDetailRow[]> {
  const match: Document = {};

  if (filter.status) {
    match.status = filter.status;
  }
  if (filter.fieldExecutiveId) {
    match.field_executive_id = filter.fieldExecutiveId;
  }

  return findRequestDetails([{ $match: match }, { $sort: NEWEST_REQUEST_FIRST }]);
}

export function countDeviceChangeRequestsByStatus(
  fieldExecutiveId?: string,
): Promise<Array<{ status: DeviceChangeRequestStatus; total: number }>> {
  return requests()
    .aggregate<{ status: DeviceChangeRequestStatus; total: number }>(
      [
        { $match: fieldExecutiveId ? { field_executive_id: fieldExecutiveId } : {} },
        { $group: { _id: '$status', total: { $sum: 1 } } },
        { $project: { _id: 0, status: '$_id', total: 1 } },
      ],
      sessionOption(),
    )
    .toArray();
}

/** `requested_at` of every request inside the rolling window, oldest first. */
export async function findRequestTimesInWindow(fieldExecutiveId: string, windowDays: number): Promise<string[]> {
  const documents = await requests()
    .find(
      { field_executive_id: fieldExecutiveId, requested_at: { $gt: timestampDaysAgo(windowDays) } },
      { sort: { requested_at: 1, insert_order: 1 }, projection: { requested_at: 1 }, ...sessionOption() },
    )
    .toArray();

  return documents.map((document) => document.requested_at as string);
}

export async function findPendingDeviceChangeRequestId(fieldExecutiveId: string): Promise<string | undefined> {
  const document = await requests().findOne(
    { field_executive_id: fieldExecutiveId, status: 'pending' },
    { projection: { _id: 1 }, ...sessionOption() },
  );
  return document?._id as string | undefined;
}

export async function insertDeviceChangeRequest(input: {
  id: string;
  fieldExecutiveId: string;
  reason: string | null;
  deviceId: string;
  deviceDetails: string | null;
}): Promise<void> {
  await requests().insertOne(
    {
      _id: input.id,
      field_executive_id: input.fieldExecutiveId,
      status: 'pending',
      reason: input.reason,
      device_id: input.deviceId,
      device_details: input.deviceDetails,
      requested_at: nowTimestamp(),
      decided_at: null,
      decided_by: null,
      decision_note: null,
      insert_order: new ObjectId(),
    },
    sessionOption(),
  );
}

/** Records a decision on a still-pending request. Returns false if it was no longer pending. */
export async function decideDeviceChangeRequest(
  id: string,
  status: Exclude<DeviceChangeRequestStatus, 'pending'>,
  adminUserId: string,
  note: string | null,
): Promise<boolean> {
  const result = await requests().updateOne(
    { _id: id, status: 'pending' },
    { $set: { status, decided_by: adminUserId, decided_at: nowTimestamp(), decision_note: note } },
    sessionOption(),
  );

  return result.matchedCount === 1;
}

/* -------------------------------------------------------------- bindings */

export async function findOpenDeviceBinding(fieldExecutiveId: string): Promise<FieldExecutiveDeviceRow | undefined> {
  const document = await bindings().findOne(
    { field_executive_id: fieldExecutiveId, released_at: null },
    { sort: NEWEST_BINDING_FIRST, ...sessionOption() },
  );
  return document ? fromDocument<FieldExecutiveDeviceRow>(document) : undefined;
}

export async function findDeviceHistoryForFieldExecutive(fieldExecutiveId: string): Promise<FieldExecutiveDeviceRow[]> {
  const documents = await bindings()
    .find({ field_executive_id: fieldExecutiveId }, { sort: NEWEST_BINDING_FIRST, ...sessionOption() })
    .toArray();
  return documents.map((document) => fromDocument<FieldExecutiveDeviceRow>(document));
}

/**
 * Opens a binding history row.
 * `isFirstLogin` stamps `bound_at` and `last_login_at` with now; a backfilled row
 * for a binding that predates history leaves both null.
 */
export async function insertDeviceBinding(input: {
  id: string;
  fieldExecutiveId: string;
  deviceId: string;
  deviceDetails: string | null;
  isFirstLogin: boolean;
  boundAfterRequestId: string | null;
}): Promise<void> {
  const now = nowTimestamp();

  await bindings().insertOne(
    {
      _id: input.id,
      field_executive_id: input.fieldExecutiveId,
      device_id: input.deviceId,
      device_details: input.deviceDetails,
      bound_at: input.isFirstLogin ? now : null,
      last_login_at: input.isFirstLogin ? now : null,
      released_at: null,
      release_reason: null,
      released_by_request_id: null,
      bound_after_request_id: input.boundAfterRequestId,
      created_at: now,
      insert_order: new ObjectId(),
    },
    sessionOption(),
  );
}

export async function releaseDeviceBinding(
  bindingId: string,
  reason: DeviceReleaseReason,
  requestId: string | null,
): Promise<void> {
  await bindings().updateOne(
    { _id: bindingId, released_at: null },
    { $set: { released_at: nowTimestamp(), release_reason: reason, released_by_request_id: requestId } },
    sessionOption(),
  );
}

export async function touchDeviceBindingLogin(bindingId: string): Promise<void> {
  await bindings().updateOne({ _id: bindingId }, { $set: { last_login_at: nowTimestamp() } }, sessionOption());
}

/** The latest approved request not yet followed by a new binding. */
export async function findUnfollowedApprovedRequestId(fieldExecutiveId: string): Promise<string | undefined> {
  const [row] = await requests()
    .aggregate<{ _id: string }>(
      [
        { $match: { field_executive_id: fieldExecutiveId, status: 'approved' } },
        { $sort: { decided_at: -1, insert_order: -1 } },
        {
          $lookup: {
            from: 'field_executive_devices',
            localField: '_id',
            foreignField: 'bound_after_request_id',
            as: 'followers',
            pipeline: [{ $limit: 1 }, { $project: { _id: 1 } }],
          },
        },
        { $match: { followers: { $size: 0 } } },
        { $limit: 1 },
        { $project: { _id: 1 } },
      ],
      sessionOption(),
    )
    .toArray();

  return row?._id;
}

/** Frees the account to bind again on its next mobile login. */
export async function clearFieldExecutiveDeviceBinding(fieldExecutiveId: string): Promise<void> {
  await getCollection('field_executives').updateOne(
    { _id: fieldExecutiveId },
    { $set: { device_id: null, device_details: null } },
    sessionOption(),
  );
}
