import { db } from "../../lib/db.js";
import { AppError } from "../../middleware/errorHandler.js";
import { AnalyticsOverviewQuery, AnalyticsLogsQuery } from "./analytics.schemas.js";

function calculateSinceDate(timeRange: string): Date {
  const now = Date.now();
  switch (timeRange) {
    case "1h":
      return new Date(now - 60 * 60 * 1000);
    case "7d":
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case "24h":
    default:
      return new Date(now - 24 * 60 * 60 * 1000);
  }
}

export async function getOverviewStats(userId: string, query: AnalyticsOverviewQuery) {
  const since = calculateSinceDate(query.timeRange);

  // 1. Fetch user's services to guarantee multi-tenant data isolation
  const userServices = await db.service.findMany({
    where: { userId },
    select: { id: true, name: true, slug: true },
  });

  if (userServices.length === 0) {
    return {
      timeRange: query.timeRange,
      totalRequests: 0,
      successfulRequests: 0,
      errorRequests: 0,
      errorRate: 0,
      latency: { avg: 0, min: 0, max: 0 },
      statusBreakdown: [],
      failureBreakdown: [],
      topServices: [],
      timeSeries: [],
    };
  }

  const serviceMap = new Map(userServices.map((s) => [s.id, s]));

  let allowedServiceIds = userServices.map((s) => s.id);
  if (query.serviceId) {
    if (!serviceMap.has(query.serviceId)) {
      throw new AppError("Service not found or unauthorized.", 404);
    }
    allowedServiceIds = [query.serviceId];
  }

  const baseWhere = {
    serviceId: { in: allowedServiceIds },
    timestamp: { gte: since },
  };

  // 2. High-performance aggregations leveraging composite index [serviceId, timestamp]
  const [totalRequests, errorRequests, latencyStats, statusCounts, failureCounts, serviceCounts, logsForBuckets] =
    await Promise.all([
      db.requestLog.count({ where: baseWhere }),
      db.requestLog.count({
        where: {
          ...baseWhere,
          statusCode: { gte: 400 },
        },
      }),
      db.requestLog.aggregate({
        where: baseWhere,
        _avg: { latencyMs: true },
        _min: { latencyMs: true },
        _max: { latencyMs: true },
      }),
      db.requestLog.groupBy({
        by: ["statusCode"],
        where: baseWhere,
        _count: { statusCode: true },
        orderBy: { _count: { statusCode: "desc" } },
      }),
      db.requestLog.groupBy({
        by: ["failureCategory"],
        where: {
          ...baseWhere,
          failureCategory: { not: null },
        },
        _count: { failureCategory: true },
        orderBy: { _count: { failureCategory: "desc" } },
      }),
      db.requestLog.groupBy({
        by: ["serviceId"],
        where: baseWhere,
        _count: { serviceId: true },
        orderBy: { _count: { serviceId: "desc" } },
        take: 5,
      }),
      // Fetch light timestamps to construct time-series histogram
      db.requestLog.findMany({
        where: baseWhere,
        select: {
          timestamp: true,
          statusCode: true,
          latencyMs: true,
        },
        orderBy: { timestamp: "asc" },
      }),
    ]);

  const successfulRequests = totalRequests - errorRequests;
  const errorRate = totalRequests > 0 ? Number(((errorRequests / totalRequests) * 100).toFixed(2)) : 0;

  // 3. Construct clean time-series buckets for frontend charting
  const bucketCount = query.timeRange === "1h" ? 12 : 24;
  const intervalMs = (Date.now() - since.getTime()) / bucketCount;

  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const bucketStart = new Date(since.getTime() + i * intervalMs);
    const bucketEnd = new Date(since.getTime() + (i + 1) * intervalMs);
    return {
      timestamp: bucketStart.toISOString(),
      label:
        query.timeRange === "1h"
          ? bucketStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : bucketStart.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit" }),
      totalRequests: 0,
      errorRequests: 0,
      latencyTotal: 0,
      avgLatencyMs: 0,
      bucketStart: bucketStart.getTime(),
      bucketEnd: bucketEnd.getTime(),
    };
  });

  for (const log of logsForBuckets) {
    const logTime = log.timestamp.getTime();
    const bucket = buckets.find((b) => logTime >= b.bucketStart && logTime < b.bucketEnd);
    if (bucket) {
      bucket.totalRequests++;
      if (log.statusCode >= 400) {
        bucket.errorRequests++;
      }
      bucket.latencyTotal += log.latencyMs;
    }
  }

  const timeSeries = buckets.map(({ timestamp, label, totalRequests, errorRequests, latencyTotal }) => ({
    timestamp,
    label,
    totalRequests,
    errorRequests,
    avgLatencyMs: totalRequests > 0 ? Math.round(latencyTotal / totalRequests) : 0,
  }));

  // 4. Enrich top services with names
  const topServices = serviceCounts.map((sc) => {
    const s = serviceMap.get(sc.serviceId);
    return {
      serviceId: sc.serviceId,
      name: s?.name || "Unknown",
      slug: s?.slug || "unknown",
      requestCount: sc._count.serviceId,
    };
  });

  return {
    timeRange: query.timeRange,
    totalRequests,
    successfulRequests,
    errorRequests,
    errorRate,
    latency: {
      avg: latencyStats._avg.latencyMs ? Math.round(latencyStats._avg.latencyMs) : 0,
      min: latencyStats._min.latencyMs ?? 0,
      max: latencyStats._max.latencyMs ?? 0,
    },
    statusBreakdown: statusCounts.map((sc) => ({
      statusCode: sc.statusCode,
      count: sc._count.statusCode,
    })),
    failureBreakdown: failureCounts.map((fc) => ({
      category: fc.failureCategory,
      count: fc._count.failureCategory,
    })),
    topServices,
    timeSeries,
  };
}

export async function getRequestLogs(userId: string, query: AnalyticsLogsQuery) {
  const userServices = await db.service.findMany({
    where: { userId },
    select: { id: true },
  });

  const allowedServiceIds = userServices.map((s) => s.id);
  if (query.serviceId && !allowedServiceIds.includes(query.serviceId)) {
    throw new AppError("Service not found or unauthorized.", 404);
  }

  const where: any = {
    serviceId: query.serviceId ? query.serviceId : { in: allowedServiceIds },
  };

  if (query.statusCode) {
    where.statusCode = query.statusCode;
  }

  if (query.failureCategory) {
    where.failureCategory = query.failureCategory;
  }

  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const [totalLogs, logs] = await Promise.all([
    db.requestLog.count({ where }),
    db.requestLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        method: true,
        path: true,
        statusCode: true,
        latencyMs: true,
        clientIp: true,
        userAgent: true,
        failureCategory: true,
        errorMessage: true,
        timestamp: true,
        service: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        apiKey: {
          select: {
            id: true,
            name: true,
            keyPrefix: true,
          },
        },
      },
    }),
  ]);

  return {
    logs,
    pagination: {
      total: totalLogs,
      page,
      limit,
      totalPages: Math.ceil(totalLogs / limit),
    },
  };
}
