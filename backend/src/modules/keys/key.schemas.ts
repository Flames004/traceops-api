import { z } from "zod";

export const createApiKeySchema = z.object({
  name: z.string().min(2, "Key name must be at least 2 characters long").max(100),
  rateLimitMax: z.coerce.number().int().min(1).max(100000).optional(),
  rateLimitWindowMs: z.coerce.number().int().min(1000).max(3600000).optional(),
  expiresAt: z.string().datetime().optional().transform((val) => (val ? new Date(val) : undefined)),
});

export const serviceKeyParamsSchema = z.object({
  serviceId: z.string().uuid("Invalid service ID format"),
  keyId: z.string().uuid("Invalid key ID format").optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
