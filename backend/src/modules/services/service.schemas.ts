import { z } from "zod";

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"] as const;

export const createServiceSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long").max(100),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters long")
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens (e.g. payment-service)"),
  description: z.string().max(500).optional(),
  upstreamUrl: z.string().url("Upstream URL must be a valid URL"),
  routePrefix: z.string().default("").transform((val) => {
    if (!val) return "";
    return val.startsWith("/") ? val : `/${val}`;
  }),
  timeoutMs: z.coerce.number().int().min(100, "Timeout must be at least 100ms").max(60000, "Timeout cannot exceed 60s").default(5000),
  allowedMethods: z.array(z.enum(HTTP_METHODS)).default(["GET", "POST", "PUT", "DELETE", "PATCH"]),
  rateLimitMax: z.coerce.number().int().min(1).max(100000).default(60),
  rateLimitWindowMs: z.coerce.number().int().min(1000).max(3600000).default(60000),
});

export const updateServiceSchema = createServiceSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const serviceIdSchema = z.object({
  id: z.string().uuid("Invalid service ID format"),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
