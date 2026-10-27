import { describe, it, expect } from "vitest";
import { isPrivateIP, isPrivateIPv4, isPrivateIPv6, validateUpstreamUrl } from "./ssrf.js";

describe("SSRF Protection Module", () => {
  describe("isPrivateIPv4", () => {
    it("should identify loopback addresses as private", () => {
      expect(isPrivateIPv4("127.0.0.1")).toBe(true);
      expect(isPrivateIPv4("127.255.255.254")).toBe(true);
    });

    it("should identify RFC 1918 private ranges", () => {
      expect(isPrivateIPv4("10.0.0.1")).toBe(true);
      expect(isPrivateIPv4("10.255.255.255")).toBe(true);
      expect(isPrivateIPv4("172.16.0.1")).toBe(true);
      expect(isPrivateIPv4("172.31.255.255")).toBe(true);
      expect(isPrivateIPv4("192.168.0.1")).toBe(true);
      expect(isPrivateIPv4("192.168.255.255")).toBe(true);
    });

    it("should identify AWS/Cloud metadata (169.254.169.254) as private link-local", () => {
      expect(isPrivateIPv4("169.254.169.254")).toBe(true);
      expect(isPrivateIPv4("169.254.1.1")).toBe(true);
    });

    it("should identify public IPv4 as not private", () => {
      expect(isPrivateIPv4("8.8.8.8")).toBe(false);
      expect(isPrivateIPv4("1.1.1.1")).toBe(false);
      expect(isPrivateIPv4("142.250.190.46")).toBe(false);
    });
  });

  describe("isPrivateIPv6", () => {
    it("should identify IPv6 loopback as private", () => {
      expect(isPrivateIPv6("::1")).toBe(true);
      expect(isPrivateIPv6("::")).toBe(true);
    });

    it("should identify IPv6 ULA (fc00::/7) and link-local (fe80::/10)", () => {
      expect(isPrivateIPv6("fc00::1")).toBe(true);
      expect(isPrivateIPv6("fd12:3456:789a::1")).toBe(true);
      expect(isPrivateIPv6("fe80::1")).toBe(true);
    });

    it("should identify IPv4-mapped IPv6 loopback (::ffff:127.0.0.1)", () => {
      expect(isPrivateIPv6("::ffff:127.0.0.1")).toBe(true);
      expect(isPrivateIPv6("::ffff:169.254.169.254")).toBe(true);
    });

    it("should identify public IPv6 as not private", () => {
      expect(isPrivateIPv6("2606:4700:4700::1111")).toBe(false);
    });
  });

  describe("validateUpstreamUrl", () => {
    it("should reject non-HTTP(S) schemes", async () => {
      const ftp = await validateUpstreamUrl("ftp://example.com/api");
      expect(ftp.isValid).toBe(false);
      expect(ftp.error).toContain("Unsupported protocol");

      const file = await validateUpstreamUrl("file:///etc/passwd");
      expect(file.isValid).toBe(false);
    });

    it("should reject URLs with credentials", async () => {
      const creds = await validateUpstreamUrl("https://admin:secret@api.example.com");
      expect(creds.isValid).toBe(false);
      expect(creds.error).toContain("user credentials");
    });

    it("should block loopback and cloud metadata by default", async () => {
      const metadata = await validateUpstreamUrl("http://169.254.169.254/latest/meta-data");
      expect(metadata.isValid).toBe(false);
      expect(metadata.error?.toLowerCase()).toContain("prohibited");

      const loopback = await validateUpstreamUrl("http://127.0.0.1:8080");
      expect(loopback.isValid).toBe(false);

      const localhost = await validateUpstreamUrl("http://localhost:3000");
      expect(localhost.isValid).toBe(false);
    });

    it("should allow local destinations when allowLocal is true", async () => {
      const local = await validateUpstreamUrl("http://127.0.0.1:8080", true);
      expect(local.isValid).toBe(true);
    });

    it("should accept valid public URLs", async () => {
      const publicUrl = await validateUpstreamUrl("https://api.github.com");
      expect(publicUrl.isValid).toBe(true);
      expect(publicUrl.resolvedIps?.length).toBeGreaterThan(0);
    }, 15000);
  });
});
