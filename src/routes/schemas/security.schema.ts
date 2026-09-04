import { z } from 'zod';

/**
 * A mock-location report is fraud evidence, so validation is deliberately
 * permissive about *content* and strict about *shape*: coordinates from a fake
 * provider may be nonsensical and must still be recorded, but the envelope has
 * to be well formed for the row to be attributable.
 */
export const reportMockLocationSchema = z.object({
  body: z.object({
    /** Device-generated id; makes an offline retry idempotent. */
    clientEventId: z.string().min(1).max(100),
    detectionStage: z.enum(['post_login', 'app_resume', 'manual_recheck', 'photo_capture']),
    /** Device clock — may itself be tampered with, which is why the server stamps its own. */
    detectedAt: z.string().min(1).max(40),
    fix: z
      .object({
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
        accuracyMeters: z.number().min(0).max(1_000_000).optional(),
        capturedAt: z.string().max(40).optional(),
        source: z.enum(['fresh', 'lastKnown']).optional(),
      })
      .optional(),
    caseId: z.string().max(100).optional(),
    device: z
      .object({
        deviceId: z.string().max(500).optional(),
        deviceName: z.string().max(255).optional(),
        model: z.string().max(255).optional(),
        brand: z.string().max(255).optional(),
        manufacturer: z.string().max(255).optional(),
        deviceType: z.string().max(64).optional(),
        systemName: z.string().max(255).optional(),
        osVersion: z.string().max(255).optional(),
        appVersion: z.string().max(64).optional(),
        appBuildNumber: z.string().max(64).optional(),
        installerPackageName: z.string().max(255).optional(),
        isEmulator: z.boolean().optional(),
        timeZone: z.string().max(100).optional(),
      })
      .optional(),
  }),
  params: z.object({}).strict().optional(),
  query: z.object({}).strict().optional(),
});
