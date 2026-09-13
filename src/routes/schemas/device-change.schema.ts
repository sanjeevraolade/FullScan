import { z } from 'zod';
import { DEVICE_CHANGE_REQUEST_STATUSES } from '../../types/device-change.types.js';

/** FE web: submit a device change request. The reason is optional. */
export const createDeviceChangeRequestSchema = z.object({
  body: z.object({ reason: z.string().max(500).optional() }).strict(),
  params: z.object({}).strict().optional(),
  query: z.object({}).strict().optional(),
});

/** Admin: list requests, optionally by status and/or executive. */
export const listDeviceChangeRequestsSchema = z.object({
  query: z
    .object({
      status: z.enum(DEVICE_CHANGE_REQUEST_STATUSES).optional(),
      fieldExecutiveId: z.string().min(1).max(200).optional(),
    })
    .strict(),
  params: z.object({}).strict().optional(),
});

/** Admin: approve or reject one request, with an optional note shown to the executive. */
export const decideDeviceChangeRequestSchema = z.object({
  params: z.object({ requestId: z.string().min(1).max(200) }),
  body: z.object({ note: z.string().max(500).optional() }).strict().optional(),
  query: z.object({}).strict().optional(),
});
