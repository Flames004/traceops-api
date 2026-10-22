import dns from "node:dns/promises";
import net from "node:net";

/**
 * Checks if an IPv4 address falls within private, loopback, link-local,
 * or reserved address spaces (RFC 1918, RFC 3927, RFC 5735).
 */
export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) {
    return true; // Malformed IPs are rejected
  }

  const [p0, p1] = parts;

  // 0.0.0.0/8 (Current network)
  if (p0 === 0) return true;

  // 10.0.0.0/8 (Private network)
  if (p0 === 10) return true;

  // 100.64.0.0/10 (Shared address space / Carrier-grade NAT)
  if (p0 === 100 && p1 >= 64 && p1 <= 127) return true;

  // 127.0.0.0/8 (Loopback)
  if (p0 === 127) return true;

  // 169.254.0.0/16 (Link-local, including Cloud Metadata 169.254.169.254)
  if (p0 === 169 && p1 === 254) return true;

  // 172.16.0.0/12 (Private network: 172.16.0.0 – 172.31.255.255)
  if (p0 === 172 && p1 >= 16 && p1 <= 31) return true;

  // 192.0.0.0/24 (IETF Protocol Assignments)
  // 192.0.2.0/24 (TEST-NET-1)
  if (p0 === 192 && p1 === 0) return true;

  // 192.168.0.0/16 (Private network)
  if (p0 === 192 && p1 === 168) return true;

  // 198.18.0.0/15 (Network benchmark tests)
  if (p0 === 198 && (p1 === 18 || p1 === 19)) return true;

  // 198.51.100.0/24 (TEST-NET-2)
  if (p0 === 198 && p1 === 51) return true;

  // 203.0.113.0/24 (TEST-NET-3)
  if (p0 === 203 && p1 === 0) return true;

  // 224.0.0.0/4 (Multicast)
  if (p0 >= 224 && p0 <= 239) return true;

  // 240.0.0.0/4 (Reserved / Future Use)
  if (p0 >= 240) return true;

  return false;
}

/**
 * Checks if an IPv6 address falls within private, loopback, or link-local spaces.
 */
export function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // Loopback (::1) or Unspecified (::)
  if (normalized === "::1" || normalized === "::") return true;

  // IPv4-mapped IPv6 address (::ffff:x.x.x.x)
  if (normalized.startsWith("::ffff:")) {
    const ipv4Part = normalized.slice(7);
    if (net.isIPv4(ipv4Part)) {
      return isPrivateIPv4(ipv4Part);
    }
  }

  // Unique Local Addresses (fc00::/7, which includes fc00:: and fd00::)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;

  // Link-Local Addresses (fe80::/10)
  if (
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true;
  }

  // Multicast (ff00::/8)
  if (normalized.startsWith("ff")) return true;

  return false;
}

export function isPrivateIP(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true; // Not a valid IP -> unsafe
}

export interface SSRFValidationResult {
  isValid: boolean;
  error?: string;
  resolvedIps?: string[];
}

/**
 * Validates an upstream URL against SSRF attacks:
 * 1. Verifies protocol is strictly http: or https:
 * 2. Checks host is not localhost or loopback name
 * 3. Resolves all DNS records and ensures NONE are private/link-local/internal
 */
export async function validateUpstreamUrl(
  urlString: string,
  allowLocal = false
): Promise<SSRFValidationResult> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { isValid: false, error: "Invalid URL format" };
  }

  // 1. Strict protocol enforcement
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      isValid: false,
      error: `Unsupported protocol: '${url.protocol}'. Only 'http:' and 'https:' are permitted.`,
    };
  }

  const hostname = url.hostname.toLowerCase();

  // 2. Reject credentials in URLs (e.g., http://user:pass@host)
  if (url.username || url.password) {
    return {
      isValid: false,
      error: "URLs with embedded user credentials are prohibited.",
    };
  }

  // 3. Reject prohibited hostnames immediately
  if (!allowLocal) {
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      return {
        isValid: false,
        error: `Prohibited destination hostname: '${hostname}' resolves to internal/local network.`,
      };
    }
  }

  // 4. If hostname is directly an IP, validate it immediately
  if (net.isIP(hostname)) {
    if (!allowLocal && isPrivateIP(hostname)) {
      return {
        isValid: false,
        error: `Prohibited IP address: '${hostname}' is a private, loopback, or link-local address.`,
        resolvedIps: [hostname],
      };
    }
    return { isValid: true, resolvedIps: [hostname] };
  }

  // 5. DNS Resolution: Resolve all A and AAAA records to protect against multi-homed or rebinding attacks
  try {
    const lookupResults = await dns.lookup(hostname, { all: true });
    if (!lookupResults || lookupResults.length === 0) {
      return { isValid: false, error: `Could not resolve hostname '${hostname}'.` };
    }

    const resolvedIps = lookupResults.map((record) => record.address);

    if (!allowLocal) {
      for (const record of lookupResults) {
        if (isPrivateIP(record.address)) {
          return {
            isValid: false,
            error: `Destination '${hostname}' resolved to prohibited address ${record.address}.`,
            resolvedIps,
          };
        }
      }
    }

    return { isValid: true, resolvedIps };
  } catch (err: any) {
    return {
      isValid: false,
      error: `DNS resolution failed for '${hostname}': ${err.message}`,
    };
  }
}
