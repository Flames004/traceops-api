const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export class ApiClient {
  private static getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("traceops_token");
  }

  public static setToken(token: string): void {
    if (typeof window !== "undefined") {
      localStorage.setItem("traceops_token", token);
    }
  }

  public static removeToken(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem("traceops_token");
    }
  }

  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data.error || data.message || `Request failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data as T;
  }

  // Auth APIs
  static async login(credentials: { email: string; password: string }) {
    const res = await this.request<{ user: any; token: string }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    this.setToken(res.token);
    return res;
  }

  static async register(data: { email: string; password: string; name: string }) {
    const res = await this.request<{ user: any; token: string }>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
    this.setToken(res.token);
    return res;
  }

  static async getProfile() {
    return this.request<{ user: any }>("/api/v1/auth/me");
  }

  // Service Management APIs
  static async getServices() {
    return this.request<{ services: any[]; count: number }>("/api/v1/services");
  }

  static async createService(serviceData: any) {
    return this.request<{ message: string; service: any }>("/api/v1/services", {
      method: "POST",
      body: JSON.stringify(serviceData),
    });
  }

  static async toggleService(serviceId: string, isActive: boolean) {
    return this.request<{ message: string; service: any }>(`/api/v1/services/${serviceId}/toggle`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    });
  }

  static async deleteService(serviceId: string) {
    return this.request<{ message: string }>(`/api/v1/services/${serviceId}`, {
      method: "DELETE",
    });
  }

  // API Key Management APIs
  static async getApiKeys(serviceId: string) {
    return this.request<{ keys: any[]; count: number }>(`/api/v1/services/${serviceId}/keys`);
  }

  static async createApiKey(serviceId: string, keyData: { name: string; rateLimitMax?: number; rateLimitWindowMs?: number }) {
    return this.request<{ message: string; rawKey: string; key: any }>(`/api/v1/services/${serviceId}/keys`, {
      method: "POST",
      body: JSON.stringify(keyData),
    });
  }

  static async revokeApiKey(serviceId: string, keyId: string) {
    return this.request<{ message: string; key: any }>(`/api/v1/services/${serviceId}/keys/${keyId}/revoke`, {
      method: "PATCH",
    });
  }

  static async deleteApiKey(serviceId: string, keyId: string) {
    return this.request<{ message: string }>(`/api/v1/services/${serviceId}/keys/${keyId}`, {
      method: "DELETE",
    });
  }

  // Analytics APIs
  static async getOverview(timeRange = "24h", serviceId?: string) {
    const params = new URLSearchParams({ timeRange });
    if (serviceId) params.append("serviceId", serviceId);
    return this.request<any>(`/api/v1/analytics/overview?${params.toString()}`);
  }

  static async getLogs(query: { page?: number; limit?: number; serviceId?: string; statusCode?: number }) {
    const params = new URLSearchParams();
    if (query.page) params.append("page", query.page.toString());
    if (query.limit) params.append("limit", query.limit.toString());
    if (query.serviceId) params.append("serviceId", query.serviceId);
    if (query.statusCode) params.append("statusCode", query.statusCode.toString());
    return this.request<{ logs: any[]; pagination: any }>(`/api/v1/analytics/logs?${params.toString()}`);
  }

  // Gateway Live Testing API
  static async testGateway(serviceSlug: string, subPath: string, method = "GET", apiKey?: string, body?: any) {
    const cleanSubPath = subPath.startsWith("/") ? subPath : `/${subPath}`;
    const url = `${API_BASE}/gateway/${serviceSlug}${cleanSubPath}`;

    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }
    if (body && ["POST", "PUT", "PATCH"].includes(method)) {
      headers["Content-Type"] = "application/json";
    }

    const startTime = performance.now();
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body && ["POST", "PUT", "PATCH"].includes(method) ? JSON.stringify(body) : undefined,
      });

      const latencyMs = Math.round(performance.now() - startTime);
      const text = await res.text();
      let parsedBody: any;
      try {
        parsedBody = JSON.parse(text);
      } catch {
        parsedBody = text;
      }

      const resHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        resHeaders[key] = value;
      });

      return {
        status: res.status,
        statusText: res.statusText,
        headers: resHeaders,
        body: parsedBody,
        latencyMs,
      };
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        status: 0,
        statusText: "Network Error",
        headers: {},
        body: { error: err.message },
        latencyMs,
      };
    }
  }
}
