const SENSITIVE_KEYS = new Set([
  "authorization",
  "x-api-key",
  "cookie",
  "set-cookie",
  "password",
  "token",
  "secret",
  "jwt",
]);

export function redactHeaders(headers: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export const logger = {
  info: (message: string, meta?: Record<string, any>) => {
    console.log(JSON.stringify({ level: "INFO", message, ...meta, timestamp: new Date().toISOString() }));
  },
  warn: (message: string, meta?: Record<string, any>) => {
    console.warn(JSON.stringify({ level: "WARN", message, ...meta, timestamp: new Date().toISOString() }));
  },
  error: (message: string, error?: any, meta?: Record<string, any>) => {
    console.error(
      JSON.stringify({
        level: "ERROR",
        message,
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        ...meta,
        timestamp: new Date().toISOString(),
      })
    );
  },
};
