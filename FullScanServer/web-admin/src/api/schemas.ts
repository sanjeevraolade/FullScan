import { z } from 'zod';
import type { AdminUser, LoginResult } from '../types/auth';
import type {
  AdminCaseDetail,
  AdminCaseEvidenceList,
  AdminCaseListResult,
  CaseFormOptions,
} from '../types/cases';
import type { AdminDeviceChangeRequest, AdminDeviceChangeRequestList, DeviceHistoryEntry } from '../types/device-change';
import type { AdminFieldExecutiveListItem, FieldExecutiveHistory } from '../types/field-executives';
import type { MobileAppSetting } from '../types/settings';
import type { AdminUserSummary, CreateAdminUserResult } from '../types/admin-users';

/**
 * Runtime checks for every response the app consumes, each pinned to its interface
 * so the two cannot drift apart silently.
 */

const nullableString = z.string().nullable();

export const adminUserSchema: z.ZodType<AdminUser> = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['admin', 'super_admin']),
  lastLoginAt: nullableString,
});

/** The login body also carries `token` for Bearer clients — deliberately not read here. */
export const loginResultSchema: z.ZodType<LoginResult> = z.object({
  expiresInSeconds: z.number(),
  adminUser: adminUserSchema,
});

export const signOutResultSchema = z.object({ signedOut: z.literal(true) });

/* ------------------------------------------------------------------ cases */

const bucketSchema = z.enum(['new', 'pending', 'beyond_tat', 'completed']);
const dropdownOptionSchema = z.object({ code: z.string(), label: z.string() });

export const caseFormOptionsSchema: z.ZodType<CaseFormOptions> = z.object({
  buckets: z.array(z.string()),
  addressTypes: z.array(z.string()),
  residenceTypes: z.array(z.string()),
  componentStatuses: z.array(dropdownOptionSchema),
  actionStatuses: z.array(dropdownOptionSchema),
  profileStatuses: z.array(dropdownOptionSchema),
});

export const caseListResultSchema: z.ZodType<AdminCaseListResult> = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      caseId: z.string(),
      caseRef: z.string(),
      clientName: z.string(),
      candidateName: z.string(),
      bucket: bucketSchema,
      verificationType: z.string(),
      addressType: nullableString,
      address: z.string(),
      componentStatus: z.string(),
      actionStatus: nullableString,
      profileStatus: z.string(),
      assignedFieldExecutiveId: nullableString,
      assignedFieldExecutiveName: nullableString,
      assignedToName: z.string(),
      tatDueAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
  total: z.number().int().nonnegative(),
  categories: z.array(z.object({ bucket: bucketSchema, count: z.number().int().nonnegative() })),
  limit: z.number().int(),
  offset: z.number().int(),
});

export const caseDetailSchema: z.ZodType<AdminCaseDetail> = z.object({
  id: z.string(),
  caseRef: z.string(),
  clientName: z.string(),
  candidateName: z.string(),
  fatherOrSpouseName: z.string(),
  employerName: z.string(),
  primaryContactNumber: z.string(),
  secondaryContactNumber: z.string(),
  profileStatus: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  components: z.array(
    z.object({
      id: z.string(),
      bucket: bucketSchema,
      componentStatus: z.string(),
      actionStatus: nullableString,
      verificationType: z.string(),
      addressType: nullableString,
      residenceType: nullableString,
      address: z.string(),
      location: z.string(),
      remarks: z.string(),
      additionalVerificationInstructions: z.string(),
      additionalVerificationRemarks: z.string(),
      assignedFieldExecutiveId: nullableString,
      assignedFieldExecutiveName: nullableString,
      assignedToName: z.string(),
      tatDueAt: z.string(),
      targetLatitude: z.number(),
      targetLongitude: z.number(),
      maskedPrimaryPhone: z.string(),
      maskedSecondaryPhone: z.string(),
      clientInstructions: z.string(),
      fieldExecutiveNotes: z.string(),
      selectedVerificationStatus: nullableString,
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
});

export const caseEvidenceListSchema: z.ZodType<AdminCaseEvidenceList> = z.object({
  caseId: z.string(),
  evidence: z.array(
    z.object({
      id: z.string(),
      componentId: z.string(),
      source: z.enum(['web_upload', 'mobile_capture']),
      fileName: z.string(),
      mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
      sizeBytes: z.number().int().positive(),
      sha256: z.string(),
      documentTypeCode: nullableString,
      latitude: z.number().nullable(),
      longitude: z.number().nullable(),
      accuracyMeters: z.number().nullable(),
      isMockLocation: z.boolean().nullable(),
      capturedAt: nullableString,
      uploadedAt: z.string(),
      uploadedBy: z.object({ id: z.string(), name: z.string(), username: z.string() }),
    }),
  ),
});

/* ---------------------------------------------------------- device change */

const deviceViewSchema = z.object({
  deviceId: z.string(),
  deviceName: nullableString,
  brand: nullableString,
  model: nullableString,
  systemName: nullableString,
  osVersion: nullableString,
  appVersion: nullableString,
});

const requestStatusSchema = z.enum(['pending', 'approved', 'rejected']);

export const deviceChangeRequestSchema: z.ZodType<AdminDeviceChangeRequest> = z.object({
  id: z.string(),
  status: requestStatusSchema,
  reason: nullableString,
  requestedAt: z.string(),
  deviceAtRequest: deviceViewSchema,
  decidedAt: nullableString,
  decisionNote: nullableString,
  newDevice: deviceViewSchema.extend({ boundAt: nullableString, lastLoginAt: nullableString }).nullable(),
  fieldExecutive: z.object({ id: z.string(), name: z.string(), username: z.string() }),
  decidedBy: z.object({ id: z.string(), name: z.string() }).nullable(),
});

export const deviceChangeRequestListSchema: z.ZodType<AdminDeviceChangeRequestList> = z.object({
  items: z.array(deviceChangeRequestSchema),
  counts: z.object({
    pending: z.number().int(),
    approved: z.number().int(),
    rejected: z.number().int(),
    all: z.number().int(),
  }),
});

const deviceHistoryEntrySchema: z.ZodType<DeviceHistoryEntry> = z.object({
  id: z.string(),
  device: deviceViewSchema,
  boundAt: nullableString,
  lastLoginAt: nullableString,
  releasedAt: nullableString,
  releaseReason: z.enum(['device_change_approved', 'binding_replaced']).nullable(),
  releasedByRequestId: nullableString,
  boundAfterRequestId: nullableString,
  isCurrent: z.boolean(),
});

/* ------------------------------------------------------ field executives */

export const fieldExecutiveListItemSchema: z.ZodType<AdminFieldExecutiveListItem> = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  username: z.string(),
  isDeviceBound: z.boolean(),
  assignedComponentCount: z.number().int(),
  mockLocationEventCount: z.number().int(),
  lastMockLocationDetectedAt: nullableString,
});

export const fieldExecutiveListSchema = z.array(fieldExecutiveListItemSchema);

const mockLocationEventSchema = z.object({
  id: z.string(),
  detectionStage: z.string(),
  detectedAt: z.string(),
  reportedAt: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  accuracyMeters: z.number().nullable(),
  fixCapturedAt: nullableString,
  fixSource: nullableString,
  device: z.object({
    deviceId: nullableString,
    deviceName: nullableString,
    model: nullableString,
    brand: nullableString,
    manufacturer: nullableString,
    deviceType: nullableString,
    osName: nullableString,
    osVersion: nullableString,
    appVersion: nullableString,
    appBuildNumber: nullableString,
    installerPackageName: nullableString,
    isEmulator: z.boolean(),
    timeZone: nullableString,
  }),
});

export const fieldExecutiveHistorySchema: z.ZodType<FieldExecutiveHistory> = z.object({
  fieldExecutive: fieldExecutiveListItemSchema,
  summary: z.object({
    assignedComponentCount: z.number().int(),
    mockLocationEventCount: z.number().int(),
    firstDetectedAt: nullableString,
    lastDetectedAt: nullableString,
    distinctDeviceCount: z.number().int(),
  }),
  caseGroups: z.array(
    z.object({
      bucket: bucketSchema,
      caseCount: z.number().int(),
      mockLocationEventCount: z.number().int(),
      cases: z.array(
        z.object({
          componentId: z.string(),
          caseId: z.string(),
          caseRef: z.string(),
          clientName: z.string(),
          candidateName: z.string(),
          verificationType: z.string(),
          addressType: nullableString,
          address: z.string(),
          bucket: bucketSchema,
          componentStatus: z.string(),
          actionStatus: nullableString,
          tatDueAt: z.string(),
          updatedAt: z.string(),
          mockLocationEvents: z.array(mockLocationEventSchema),
        }),
      ),
    }),
  ),
  unlinkedMockLocationEvents: z.array(mockLocationEventSchema),
  deviceHistory: z.array(deviceHistoryEntrySchema),
  deviceChangeRequests: z.array(deviceChangeRequestSchema),
});

/* ----------------------------------------------------------------- settings */

export const mobileAppSettingListSchema: z.ZodType<readonly MobileAppSetting[]> = z.array(
  z.object({
    key: z.string(),
    value: z.union([z.boolean(), z.number(), z.string()]),
    valueType: z.enum(['boolean', 'number', 'string', 'enum']),
    label: z.string(),
    description: nullableString,
    category: z.string(),
    options: z.array(z.string()).nullable(),
    minValue: z.number().nullable(),
    maxValue: z.number().nullable(),
    updatedAt: nullableString,
    updatedBy: nullableString,
  }),
);

/* -------------------------------------------------------------- admin users */

export const adminUserSummarySchema: z.ZodType<AdminUserSummary> = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['admin', 'super_admin']),
  lastLoginAt: nullableString,
  isActive: z.boolean(),
  createdAt: z.string(),
  createdBy: nullableString,
});

export const adminUserListSchema = z.array(adminUserSummarySchema);

export const createAdminUserResultSchema: z.ZodType<CreateAdminUserResult> = z.object({
  adminUser: adminUserSummarySchema,
  temporaryPassword: z.string(),
});

export const deleteAdminUserResultSchema = z.object({ deleted: z.literal(true), id: z.string() });
