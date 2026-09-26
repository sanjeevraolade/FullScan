import { v4 as uuidv4 } from 'uuid';
import * as deviceChangeDao from '../db/device-change.dao.js';
import * as fieldExecutiveDao from '../db/field-executive.dao.js';
import * as mobileAppSettingDao from '../db/mobile-app-setting.dao.js';
import { AppError } from '../utils/app-error.js';
import { parseDeviceDetails } from '../utils/device-details.js';
import type { DeviceView } from '../types/device.types.js';
import type { FieldExecutiveRow } from '../types/field-executive.types.js';
import type {
  AdminDeviceChangeRequest,
  AdminDeviceChangeRequestList,
  AdminFieldExecutiveDeviceRecords,
  DeviceChangeEligibility,
  DeviceChangePolicy,
  DeviceChangeRequestDetailRow,
  DeviceChangeRequestFilter,
  DeviceChangeRequestView,
  DeviceHistoryEntry,
  FieldExecutiveDeviceChangeOverview,
  FieldExecutiveDeviceRow,
} from '../types/device-change.types.js';

/**
 * Device change requests: a field executive asks to move their account to another
 * phone, an admin approves or rejects, and approval releases the device binding so
 * the next mobile login (on any phone, the old one included) binds again.
 *
 * Every request and every binding is kept — nothing here deletes a document.
 */

/** Mobile app settings keys for the request limit (part of the initial seed). */
export const DEVICE_CHANGE_SETTING_KEYS = {
  maxRequests: 'device_change_max_requests',
  windowDays: 'device_change_window_days',
} as const;

/** Used only if a setting row is missing or unreadable. Matches the seeded defaults. */
const DEFAULT_POLICY: DeviceChangePolicy = { maxRequests: 2, windowDays: 30 };

const REASON_MAX_LENGTH = 500;

async function readWholeNumberSetting(key: string, fallback: number): Promise<number> {
  const row = await mobileAppSettingDao.findMobileAppSettingByKey(key);
  const value = row ? Math.floor(Number(row.setting_value)) : Number.NaN;
  return Number.isFinite(value) && value >= 1 ? value : fallback;
}

export async function getDeviceChangePolicy(): Promise<DeviceChangePolicy> {
  return {
    maxRequests: await readWholeNumberSetting(DEVICE_CHANGE_SETTING_KEYS.maxRequests, DEFAULT_POLICY.maxRequests),
    windowDays: await readWholeNumberSetting(DEVICE_CHANGE_SETTING_KEYS.windowDays, DEFAULT_POLICY.windowDays),
  };
}

/** Stored timestamps are UTC `YYYY-MM-DD HH:MM:SS` without a zone marker; the result keeps that format. */
function addDaysToTimestamp(timestamp: string, days: number): string {
  const date = new Date(`${timestamp.replace(' ', 'T')}Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/* ---------------------------------------------------------------- mapping */

function toDevice(deviceId: string, deviceDetails: string | null): DeviceView {
  return { deviceId, ...parseDeviceDetails(deviceDetails, { deviceId }) };
}

function toRequestView(row: DeviceChangeRequestDetailRow): DeviceChangeRequestView {
  return {
    id: row.id,
    status: row.status,
    reason: row.reason,
    requestedAt: row.requested_at,
    deviceAtRequest: toDevice(row.device_id, row.device_details),
    decidedAt: row.decided_at,
    decisionNote: row.decision_note,
    newDevice: row.new_device_id
      ? {
          ...toDevice(row.new_device_id, row.new_device_details),
          boundAt: row.new_bound_at,
          lastLoginAt: row.new_last_login_at,
        }
      : null,
  };
}

function toAdminRequest(row: DeviceChangeRequestDetailRow): AdminDeviceChangeRequest {
  return {
    ...toRequestView(row),
    fieldExecutive: { id: row.field_executive_id, name: row.fe_name, username: row.fe_username },
    decidedBy: row.decided_by ? { id: row.decided_by, name: row.decided_by_name ?? row.decided_by } : null,
  };
}

function toHistoryEntry(row: FieldExecutiveDeviceRow): DeviceHistoryEntry {
  return {
    id: row.id,
    device: toDevice(row.device_id, row.device_details),
    boundAt: row.bound_at,
    lastLoginAt: row.last_login_at,
    releasedAt: row.released_at,
    releaseReason: row.release_reason,
    releasedByRequestId: row.released_by_request_id,
    boundAfterRequestId: row.bound_after_request_id,
    isCurrent: row.released_at === null,
  };
}

/* ------------------------------------------------------------ eligibility */

async function findFieldExecutive(fieldExecutiveId: string): Promise<FieldExecutiveRow> {
  const row = await fieldExecutiveDao.findFieldExecutiveById(fieldExecutiveId);
  if (!row) {
    throw new AppError(404, 'Field executive not found');
  }
  return row;
}

async function evaluateEligibility(fieldExecutive: FieldExecutiveRow): Promise<DeviceChangeEligibility> {
  const policy = await getDeviceChangePolicy();
  const requestTimes = await deviceChangeDao.findRequestTimesInWindow(fieldExecutive.id, policy.windowDays);
  const isLimitReached = requestTimes.length >= policy.maxRequests;

  let blockedReason: DeviceChangeEligibility['blockedReason'] = null;
  if (!fieldExecutive.device_id) {
    blockedReason = 'no_device';
  } else if (await deviceChangeDao.findPendingDeviceChangeRequestId(fieldExecutive.id)) {
    blockedReason = 'pending_request';
  } else if (isLimitReached) {
    blockedReason = 'limit_reached';
  }

  // A slot frees up when the window drops to one below the limit, i.e. when the
  // request at index (count - max) — oldest first — ages out. Handles a limit that
  // was lowered below the number already made.
  const nextRequestAllowedAt = isLimitReached
    ? addDaysToTimestamp(requestTimes[requestTimes.length - policy.maxRequests], policy.windowDays)
    : null;

  return {
    policy,
    requestsInWindow: requestTimes.length,
    canRequest: blockedReason === null,
    blockedReason,
    nextRequestAllowedAt,
  };
}

/* ------------------------------------------------------ field executive */

export async function getDeviceChangeOverviewForFieldExecutive(
  fieldExecutiveId: string,
): Promise<FieldExecutiveDeviceChangeOverview> {
  const fieldExecutive = await findFieldExecutive(fieldExecutiveId);

  return {
    eligibility: await evaluateEligibility(fieldExecutive),
    requests: (await deviceChangeDao.findDeviceChangeRequestsForFieldExecutive(fieldExecutiveId)).map(toRequestView),
    deviceHistory: (await deviceChangeDao.findDeviceHistoryForFieldExecutive(fieldExecutiveId)).map(toHistoryEntry),
  };
}

/**
 * Submits a device change request for the executive's currently bound phone.
 * Checked and inserted in one transaction, so two quick submissions cannot both
 * slip past the pending/limit checks (and the one-pending-per-executive unique index
 * backs that up).
 */
export async function requestDeviceChange(
  fieldExecutiveId: string,
  reason: string | undefined,
): Promise<FieldExecutiveDeviceChangeOverview> {
  const trimmedReason = reason?.trim() || null;

  if (trimmedReason && trimmedReason.length > REASON_MAX_LENGTH) {
    throw new AppError(400, `The reason must be ${REASON_MAX_LENGTH} characters or fewer`);
  }

  await deviceChangeDao.runInTransaction(async () => {
    const fieldExecutive = await findFieldExecutive(fieldExecutiveId);
    const eligibility = await evaluateEligibility(fieldExecutive);

    if (eligibility.blockedReason === 'no_device' || !fieldExecutive.device_id) {
      throw new AppError(
        409,
        'Your account is not linked to a phone yet, so there is no device to change. Sign in to the FullScan app on the phone you want to use.',
      );
    }

    if (eligibility.blockedReason === 'pending_request') {
      throw new AppError(409, 'You already have a device change request waiting for admin approval.');
    }

    if (eligibility.blockedReason === 'limit_reached') {
      const { maxRequests, windowDays } = eligibility.policy;
      throw new AppError(
        429,
        `You can request a device change at most ${pluralize(maxRequests, 'time')} every ${pluralize(windowDays, 'day')}. You can request again after ${eligibility.nextRequestAllowedAt} UTC.`,
      );
    }

    await deviceChangeDao.insertDeviceChangeRequest({
      id: `device-change-${uuidv4()}`,
      fieldExecutiveId: fieldExecutive.id,
      reason: trimmedReason,
      deviceId: fieldExecutive.device_id,
      deviceDetails: fieldExecutive.device_details ?? null,
    });
  });

  return getDeviceChangeOverviewForFieldExecutive(fieldExecutiveId);
}

/* ------------------------------------------------------------------ admin */

export async function listDeviceChangeRequestsForAdmin(
  filter: DeviceChangeRequestFilter,
): Promise<AdminDeviceChangeRequestList> {
  const counts = { pending: 0, approved: 0, rejected: 0, all: 0 };

  for (const { status, total } of await deviceChangeDao.countDeviceChangeRequestsByStatus(filter.fieldExecutiveId)) {
    counts[status] = total;
    counts.all += total;
  }

  return {
    items: (await deviceChangeDao.listDeviceChangeRequests(filter)).map(toAdminRequest),
    counts,
  };
}

async function findRequest(requestId: string): Promise<DeviceChangeRequestDetailRow> {
  const row = await deviceChangeDao.findDeviceChangeRequestById(requestId);
  if (!row) {
    throw new AppError(404, 'Device change request not found');
  }
  return row;
}

async function findPendingRequest(requestId: string): Promise<DeviceChangeRequestDetailRow> {
  const row = await findRequest(requestId);
  if (row.status !== 'pending') {
    throw new AppError(409, `This device change request has already been ${row.status}.`);
  }
  return row;
}

function normalizeNote(note: string | undefined): string | null {
  return note?.trim() || null;
}

/**
 * Approves a request: records the decision, closes the current binding in the
 * device history, and clears the account's binding so the executive can sign in to
 * the mobile app on any phone — the one they had included.
 */
export async function approveDeviceChangeRequest(
  requestId: string,
  adminUserId: string,
  note: string | undefined,
): Promise<AdminDeviceChangeRequest> {
  await deviceChangeDao.runInTransaction(async () => {
    const request = await findPendingRequest(requestId);

    if (!(await deviceChangeDao.decideDeviceChangeRequest(requestId, 'approved', adminUserId, normalizeNote(note)))) {
      throw new AppError(409, 'This device change request has already been decided.');
    }

    const fieldExecutive = await findFieldExecutive(request.field_executive_id);
    const openBinding = await deviceChangeDao.findOpenDeviceBinding(fieldExecutive.id);

    if (openBinding) {
      await deviceChangeDao.releaseDeviceBinding(openBinding.id, 'device_change_approved', requestId);
    } else if (fieldExecutive.device_id) {
      // A binding with no history row (made before history existed and missed by the
      // backfill): record it, then close it, so the history still shows what was released.
      const legacyBindingId = `device-binding-${uuidv4()}`;
      await deviceChangeDao.insertDeviceBinding({
        id: legacyBindingId,
        fieldExecutiveId: fieldExecutive.id,
        deviceId: fieldExecutive.device_id,
        deviceDetails: fieldExecutive.device_details ?? null,
        isFirstLogin: false,
        boundAfterRequestId: null,
      });
      await deviceChangeDao.releaseDeviceBinding(legacyBindingId, 'device_change_approved', requestId);
    }

    await deviceChangeDao.clearFieldExecutiveDeviceBinding(fieldExecutive.id);
  });

  return toAdminRequest(await findRequest(requestId));
}

/** Rejects a request. The executive's binding is untouched. */
export async function rejectDeviceChangeRequest(
  requestId: string,
  adminUserId: string,
  note: string | undefined,
): Promise<AdminDeviceChangeRequest> {
  await deviceChangeDao.runInTransaction(async () => {
    await findPendingRequest(requestId);

    if (!(await deviceChangeDao.decideDeviceChangeRequest(requestId, 'rejected', adminUserId, normalizeNote(note)))) {
      throw new AppError(409, 'This device change request has already been decided.');
    }
  });

  return toAdminRequest(await findRequest(requestId));
}

export async function getDeviceRecordsForAdmin(fieldExecutiveId: string): Promise<AdminFieldExecutiveDeviceRecords> {
  return {
    deviceHistory: (await deviceChangeDao.findDeviceHistoryForFieldExecutive(fieldExecutiveId)).map(toHistoryEntry),
    deviceChangeRequests: (await deviceChangeDao.findDeviceChangeRequestsForFieldExecutive(fieldExecutiveId)).map(
      toAdminRequest,
    ),
  };
}

/* ----------------------------------------------------------- mobile login */

/**
 * Called by the mobile login once credentials and device checks have passed.
 *
 * - Account not bound: bind this handset and open a history row, linked to the
 *   approved device change request it follows (if any) — "the new device".
 * - Account bound to this handset: stamp the login on its open history row.
 *
 * (A login from a *different* handset than the bound one never reaches here — the
 * login refuses it first.)
 */
export async function recordMobileDeviceLogin(
  fieldExecutive: FieldExecutiveRow,
  deviceId: string,
  deviceDetails: string,
): Promise<void> {
  await deviceChangeDao.runInTransaction(async () => {
    const openBinding = await deviceChangeDao.findOpenDeviceBinding(fieldExecutive.id);

    if (fieldExecutive.device_id === deviceId) {
      if (openBinding) {
        await deviceChangeDao.touchDeviceBindingLogin(openBinding.id);
        return;
      }

      // Bound before history existed and missed by the backfill: start its history now.
      await deviceChangeDao.insertDeviceBinding({
        id: `device-binding-${uuidv4()}`,
        fieldExecutiveId: fieldExecutive.id,
        deviceId,
        deviceDetails: fieldExecutive.device_details ?? deviceDetails,
        isFirstLogin: false,
        boundAfterRequestId: null,
      });
      const created = await deviceChangeDao.findOpenDeviceBinding(fieldExecutive.id);
      if (created) {
        await deviceChangeDao.touchDeviceBindingLogin(created.id);
      }
      return;
    }

    // The account's binding was cleared some other way than an approved request
    // (e.g. directly in the database) while a history row was still open: close it.
    if (openBinding) {
      await deviceChangeDao.releaseDeviceBinding(openBinding.id, 'binding_replaced', null);
    }

    await fieldExecutiveDao.updateFieldExecutiveDeviceBinding(fieldExecutive.id, deviceId, deviceDetails);
    await deviceChangeDao.insertDeviceBinding({
      id: `device-binding-${uuidv4()}`,
      fieldExecutiveId: fieldExecutive.id,
      deviceId,
      deviceDetails,
      isFirstLogin: true,
      boundAfterRequestId: (await deviceChangeDao.findUnfollowedApprovedRequestId(fieldExecutive.id)) ?? null,
    });
  });
}
