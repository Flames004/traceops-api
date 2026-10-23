"use client";

import React, { useState, useEffect } from "react";
import { Server, Plus, ShieldAlert, Check, Copy, Trash2, Power, ExternalLink } from "lucide-react";
import { ApiClient } from "../lib/api";
import { Service } from "../types";

interface ServicesTabProps {
  onSelectServiceForKeys: (serviceId: string) => void;
  onRefreshCount: () => void;
}

export function ServicesTab({ onSelectServiceForKeys, onRefreshCount }: ServicesTabProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [upstreamUrl, setUpstreamUrl] = useState("");
  const [routePrefix, setRoutePrefix] = useState("");
  const [timeoutMs, setTimeoutMs] = useState("5000");
  const [rateLimitMax, setRateLimitMax] = useState("60");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const res = await ApiClient.getServices();
      setServices(res.services);
      onRefreshCount();
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      await ApiClient.createService({
        name,
        slug,
        upstreamUrl,
        routePrefix: routePrefix.trim() || undefined,
        timeoutMs: parseInt(timeoutMs, 10),
        rateLimitMax: parseInt(rateLimitMax, 10),
      });

      setModalOpen(false);
      setName("");
      setSlug("");
      setUpstreamUrl("");
      setRoutePrefix("");
      fetchServices();
    } catch (err: any) {
      setFormError(err.message || "Failed to register service");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (service: Service) => {
    try {
      await ApiClient.toggleService(service.id, !service.isActive);
      fetchServices();
    } catch (err: any) {
      alert(`Error toggling service: ${err.message}`);
    }
  };

  const handleDelete = async (serviceId: string, serviceName: string) => {
    if (!confirm(`Are you sure you want to delete '${serviceName}'? All associated API keys and logs will also be permanently deleted.`)) {
      return;
    }
    try {
      await ApiClient.deleteService(serviceId);
      fetchServices();
    } catch (err: any) {
      alert(`Error deleting service: ${err.message}`);
    }
  };

  const copyGatewayRoute = (slugText: string) => {
    const route = `http://localhost:4000/gateway/${slugText}/`;
    navigator.clipboard.writeText(route);
    setCopiedSlug(slugText);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2>Upstream Service Registry</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "2px" }}>
            Register and manage destination backend APIs shielded by the TraceOps reverse proxy.
          </p>
        </div>

        <button
          onClick={() => {
            setFormError(null);
            setModalOpen(true);
          }}
          className="btn-primary"
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <Plus size={16} />
          <span>Register Upstream Service</span>
        </button>
      </div>

      {/* Services List Grid */}
      {services.length === 0 && !loading ? (
        <div
          className="glass-panel"
          style={{
            padding: "60px 20px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <Server size={36} color="var(--text-muted)" />
          <h3>No Upstream Services Configured</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px", maxWidth: "420px" }}>
            Get started by registering an existing API endpoint. TraceOpsAPI will generate a secure gateway route and start monitoring requests.
          </p>
          <button onClick={() => setModalOpen(true)} className="btn-primary" style={{ marginTop: "8px" }}>
            Register First Service
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
          {services.map((service) => (
            <div
              key={service.id}
              className="glass-panel"
              style={{
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                borderLeft: service.isActive ? "4px solid var(--accent-cyan)" : "4px solid var(--text-muted)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <h3 style={{ fontSize: "17px" }}>{service.name}</h3>
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontWeight: 600,
                        background: service.isActive ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.05)",
                        color: service.isActive ? "#34d399" : "var(--text-muted)",
                        border: service.isActive ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid var(--border-subtle)",
                      }}
                    >
                      {service.isActive ? "ACTIVE" : "DISABLED"}
                    </span>
                  </div>

                  {/* Gateway URL bar */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginTop: "8px",
                      background: "rgba(0,0,0,0.4)",
                      padding: "6px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                      fontSize: "12px",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>Gateway Route:</span>
                    <span style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>
                      http://localhost:4000/gateway/{service.slug}/
                    </span>
                    <button
                      onClick={() => copyGatewayRoute(service.slug)}
                      style={{ background: "transparent", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px", marginLeft: "auto", fontSize: "11px" }}
                      title="Copy gateway route"
                    >
                      {copiedSlug === service.slug ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                      <span>{copiedSlug === service.slug ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    onClick={() => onSelectServiceForKeys(service.id)}
                    className="btn-secondary"
                    style={{ fontSize: "12px", padding: "6px 12px" }}
                  >
                    Manage API Keys ({service._count?.apiKeys ?? 0})
                  </button>

                  <button
                    onClick={() => handleToggle(service)}
                    className="btn-secondary"
                    style={{
                      fontSize: "12px",
                      padding: "6px 12px",
                      color: service.isActive ? "#fb7185" : "#34d399",
                    }}
                    title={service.isActive ? "Disable service" : "Enable service"}
                  >
                    <Power size={14} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                    {service.isActive ? "Disable" : "Enable"}
                  </button>

                  <button
                    onClick={() => handleDelete(service.id, service.name)}
                    className="btn-danger"
                    title="Delete service"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Service Specs Details */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "12px",
                  paddingTop: "12px",
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                  fontSize: "12px",
                }}
              >
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Upstream Destination:</span>
                  <div style={{ color: "var(--text-primary)", fontWeight: 500, wordBreak: "break-all" }}>
                    {service.upstreamUrl}
                    {service.routePrefix && <span style={{ color: "var(--accent-indigo)" }}>{service.routePrefix}</span>}
                  </div>
                </div>

                <div>
                  <span style={{ color: "var(--text-muted)" }}>Socket Timeout:</span>
                  <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                    {service.timeoutMs} ms (HTTP 504 on breach)
                  </div>
                </div>

                <div>
                  <span style={{ color: "var(--text-muted)" }}>Default Rate Limit:</span>
                  <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                    {service.rateLimitMax} reqs / {Math.round(service.rateLimitWindowMs / 1000)}s
                  </div>
                </div>

                <div>
                  <span style={{ color: "var(--text-muted)" }}>Allowed Methods:</span>
                  <div style={{ display: "flex", gap: "4px", marginTop: "2px" }}>
                    {service.allowedMethods.slice(0, 4).map((m) => (
                      <span key={m} className={`method-badge method-${m.toLowerCase()}`}>
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Register Service Modal */}
      {modalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: "100%",
              maxWidth: "540px",
              padding: "28px",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>Register Upstream Service</h3>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: "transparent", color: "var(--text-muted)", fontSize: "18px" }}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(244, 63, 94, 0.15)",
                  border: "1px solid rgba(244, 63, 94, 0.3)",
                  color: "#fb7185",
                  fontSize: "12px",
                }}
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateService} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                  Service Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. GitHub REST API or Billing Service"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slug) {
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
                    }
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                  Gateway Route Slug
                </label>
                <input
                  type="text"
                  placeholder="e.g. billing-service"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, ""))}
                  required
                />
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  Route will be: /gateway/{slug || "slug"}/*
                </span>
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                  Upstream Base URL
                </label>
                <input
                  type="url"
                  placeholder="https://api.github.com or http://mock-upstream:8080"
                  value={upstreamUrl}
                  onChange={(e) => setUpstreamUrl(e.target.value)}
                  required
                />

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginTop: "6px",
                    fontSize: "11px",
                    color: "var(--accent-amber)",
                    background: "rgba(245, 158, 11, 0.1)",
                    padding: "6px 10px",
                    borderRadius: "6px",
                  }}
                >
                  <ShieldAlert size={14} />
                  <span>SSRF Guard active: Loopback, AWS metadata (169.254.x), & private IP ranges are blocked.</span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                    Upstream Path Prefix (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. /v1 or /api"
                    value={routePrefix}
                    onChange={(e) => setRoutePrefix(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                    Timeout (ms)
                  </label>
                  <input
                    type="number"
                    value={timeoutMs}
                    onChange={(e) => setTimeoutMs(e.target.value)}
                    min="100"
                    max="60000"
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                  Default Rate Limit (Requests per minute)
                </label>
                <input
                  type="number"
                  value={rateLimitMax}
                  onChange={(e) => setRateLimitMax(e.target.value)}
                  min="1"
                  max="10000"
                  required
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? "Validating & Creating..." : "Register Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
