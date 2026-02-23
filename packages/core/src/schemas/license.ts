import { z } from "zod";

// License enums
export const licenseTypeSchema = z.enum(["trial", "basic", "premium", "enterprise"]);
export const licenseStatusSchema = z.enum(["active", "expired", "revoked", "suspended"]);
export const licenseActivationStatusSchema = z.enum(["active", "deactivated"]);

// License schemas
export const licenseSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  licenseKey: z.string().min(1),
  licenseType: licenseTypeSchema,
  status: licenseStatusSchema,
  issuedAt: z.date(),
  expiresAt: z.date(),
  activatedAt: z.date().nullable(),
  maxActivations: z.number().int().positive().default(1),
  activationCount: z.number().int().nonnegative().default(0),
  hardwareFingerprint: z.string().nullable(),
  metadata: z.record(z.unknown()).optional(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createLicenseSchema = z.object({
  schoolId: z.string().uuid(),
  licenseType: licenseTypeSchema,
  expiresAt: z.date().refine((date) => date > new Date(), {
    message: "Expiration date must be in the future",
  }),
  maxActivations: z.number().int().positive().default(1),
  metadata: z.record(z.unknown()).optional(),
});

export const updateLicenseSchema = createLicenseSchema.partial().extend({
  status: licenseStatusSchema.optional(),
});

export const licenseActivationSchema = z.object({
  id: z.string().uuid(),
  licenseId: z.string().uuid(),
  schoolId: z.string().uuid(),
  hardwareFingerprint: z.string().min(1),
  ipAddress: z.string().ip().nullable(),
  activatedAt: z.date(),
  deactivatedAt: z.date().nullable(),
  status: licenseActivationStatusSchema,
});

export const createLicenseActivationSchema = z.object({
  licenseKey: z.string().min(1),
  hardwareFingerprint: z.string().min(1),
  ipAddress: z.string().ip().optional(),
});

export const revokeLicenseSchema = z.object({
  reason: z.string().min(1).optional(),
});

// License validation schemas
export const validateLicenseSchema = z.object({
  licenseKey: z.string().min(1),
  hardwareFingerprint: z.string().min(1),
});

export const checkLicenseValiditySchema = z.object({
  licenseKey: z.string().min(1),
  hardwareFingerprint: z.string().min(1),
});

// License filters
export const licenseFiltersSchema = z.object({
  schoolId: z.string().uuid().optional(),
  status: licenseStatusSchema.optional(),
  licenseType: licenseTypeSchema.optional(),
  search: z.string().optional(),
  expiresBefore: z.date().optional(),
  expiresAfter: z.date().optional(),
});

// License statistics
export const licenseStatsSchema = z.object({
  total: z.number().int(),
  active: z.number().int(),
  expired: z.number().int(),
  revoked: z.number().int(),
  suspended: z.number().int(),
  byType: z.record(z.number().int()),
  expiringSoon: z.number().int(), // Expires within 30 days
});
