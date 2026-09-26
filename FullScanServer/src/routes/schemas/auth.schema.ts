import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    username: z.string().min(1).max(100),
    password: z.string().min(1).max(200),
    deviceId: z.string().min(1).max(500),
    deviceDetails: z.object({
      deviceName: z.string().max(255),
      model: z.string().max(255),
      brand: z.string().max(255),
      osVersion: z.string().max(255),
      appVersion: z.string().max(255),
      systemName: z.string().max(255),
      uniqueId: z.string().max(500),
    }),
  }),
  params: z.object({}).strict().optional(),
  query: z.object({}).strict().optional(),
});

/** Field executive web portal sign-in — same credentials as mobile, no device fields. */
export const feWebLoginSchema = z.object({
  body: z.object({
    username: z.string().min(1).max(100),
    password: z.string().min(1).max(200),
  }),
  params: z.object({}).strict().optional(),
  query: z.object({}).strict().optional(),
});
