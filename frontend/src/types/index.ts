export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

export interface Service {
  id: string;
  name: string;
  slug: string;
  description?: string;
  upstreamUrl: string;
  routePrefix: string;
  isActive: boolean;
  timeoutMs: number;
  allowedMethods: string[];
  rateLimitMax: number;
  rateLimitWindowMs: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    apiKeys: number;
    requestLogs: number;
  };
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  rateLimitMax?: number | null;
  rateLimitWindowMs?: number | null;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
}

export interface RequestLog {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  latencyMs: number;
  clientIp: string;
  userAgent?: string | null;
  failureCategory?: string | null;
  errorMessage?: string | null;
  timestamp: string;
  service?: {
    id: string;
    name: string;
    slug: string;
  };
  apiKey?: {
    id: string;
    name: string;
    keyPrefix: string;
  } | null;
}

export interface TimeSeriesPoint {
  timestamp: string;
  label: string;
  totalRequests: number;
  errorRequests: number;
  avgLatencyMs: number;
}

export interface AnalyticsOverview {
  timeRange: string;
  totalRequests: number;
  successfulRequests: number;
  errorRequests: number;
  errorRate: number;
  latency: {
    avg: number;
    min: number;
    max: number;
  };
  statusBreakdown: Array<{ statusCode: number; count: number }>;
  failureBreakdown: Array<{ category: string; count: number }>;
  topServices: Array<{
    serviceId: string;
    name: string;
    slug: string;
    requestCount: number;
  }>;
  timeSeries: TimeSeriesPoint[];
}
