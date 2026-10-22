export interface GatewayServiceContext {
  id: string;
  name: string;
  slug: string;
  upstreamUrl: string;
  routePrefix: string;
  timeoutMs: number;
  allowedMethods: string[];
  rateLimitMax: number;
  rateLimitWindowMs: number;
  isActive: boolean;
}

export interface GatewayKeyContext {
  id: string;
  name: string;
  keyPrefix: string;
  rateLimitMax: number | null;
  rateLimitWindowMs: number | null;
}

export interface GatewayContext {
  requestId: string;
  service: GatewayServiceContext;
  apiKey?: GatewayKeyContext;
  startTime: number;
  targetSubPath: string;
  targetUrl: string;
  clientIp: string;
}

declare global {
  namespace Express {
    interface Request {
      gatewayContext?: GatewayContext;
    }
  }
}
