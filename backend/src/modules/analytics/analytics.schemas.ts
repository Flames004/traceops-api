import { z } from "zod";

export const analyticsOverviewQuerySchema = z.object({
  timeRange: z.enum(["1h", "24h", "7d", "30d"]).default("24h"),
  serviceId: z.string().uuid("Invalid service ID format").optional(),
});

export const analyticsLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  serviceId: z.string().uuid("Invalid service ID format").optional(),
  statusCode: z.coerce.number().int().optional(),
  failureCategory: z.string().optional(),
});

export type AnalyticsOverviewQuery = z.infer<typeof analyticsOverviewQuerySchema>;
export type AnalyticsLogsQuery = z.infer<typeof analyticsLogsQuerySchema>;
