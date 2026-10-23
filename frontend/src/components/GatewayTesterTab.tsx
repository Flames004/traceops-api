"use client";

import React, { useState, useEffect } from "react";
import { Send, Play, CheckCircle2, AlertTriangle, Clock, ShieldCheck, Terminal } from "lucide-react";
import { ApiClient } from "../lib/api";
import { Service } from "../types";

export function GatewayTesterTab() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [method, setMethod] = useState<string>("GET");
  const [path, setPath] = useState<string>("/hello");
  const [jsonBody, setJsonBody] = useState<string>('{\n  "message": "Hello via Gateway!"\n}');
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<any | null>(null);

  useEffect(() => {
    async function loadServices() {
      try {
        const res = await ApiClient.getServices();
        setServices(res.services);
        if (res.services.length > 0) {
          setSelectedSlug(res.services[0].slug);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadServices();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlug) return;

    setSending(true);
    setResponse(null);

    let parsedBody = undefined;
    if (["POST", "PUT", "PATCH"].includes(method) && jsonBody.trim()) {
      try {
        parsedBody = JSON.parse(jsonBody);
      } catch (err) {
        alert("Invalid JSON body format");
        setSending(false);
        return;
      }
    }

    try {
      const result = await ApiClient.testGateway(
        selectedSlug,
        path,
        method,
        apiKey.trim() || undefined,
        parsedBody
      );
      setResponse(result);
    } catch (err: any) {
      setResponse({
        status: 0,
        statusText: "Client Exception",
        headers: {},
        body: { error: err.message },
        latencyMs: 0,
      });
    } finally {
      setSending(false);
    }
  };

  const selectedService = services.find((s) => s.slug === selectedSlug);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h2>Interactive Gateway Playground</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "2px" }}>
          Dispatch test requests directly through the reverse proxy data plane to verify routing, rate limits, and authentication.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* Request Builder Panel */}
        <div className="glass-panel" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
          <h3 style={{ fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Terminal size={18} color="var(--accent-cyan)" />
            <span>Request Builder</span>
          </h3>

          <form onSubmit={handleSend} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Service & Method */}
            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  METHOD
                </label>
                <select value={method} onChange={(e) => setMethod(e.target.value)} style={{ fontWeight: 700 }}>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  TARGET SERVICE
                </label>
                <select value={selectedSlug} onChange={(e) => setSelectedSlug(e.target.value)}>
                  {services.map((s) => (
                    <option key={s.id} value={s.slug}>
                      {s.name} (/{s.slug})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Target Path */}
            <div>
              <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                SUB-PATH & QUERY PARAMS
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "rgba(13, 18, 29, 0.8)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  padding: "0 10px",
                }}
              >
                <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                  /gateway/{selectedSlug || "service"}
                </span>
                <input
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/hello"
                  style={{ border: "none", background: "transparent", padding: "10px 8px" }}
                  required
                />
              </div>
            </div>

            {/* API Key */}
            <div>
              <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                API KEY (x-api-key)
              </label>
              <input
                type="text"
                placeholder="tr_live_... (Leave blank to test 401 Unauthorized rejection)"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{ fontFamily: "var(--font-mono)", fontSize: "13px" }}
              />
            </div>

            {/* Request Body */}
            {["POST", "PUT", "PATCH"].includes(method) && (
              <div>
                <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  JSON PAYLOAD
                </label>
                <textarea
                  rows={4}
                  value={jsonBody}
                  onChange={(e) => setJsonBody(e.target.value)}
                  style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={sending || !selectedSlug}
              className="btn-primary"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "12px",
                marginTop: "6px",
              }}
            >
              <Send size={16} />
              <span>{sending ? "Forwarding Request..." : "Send Request Through Gateway"}</span>
            </button>
          </form>

          {/* Service routing info */}
          {selectedService && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "var(--radius-md)",
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid var(--border-subtle)",
                fontSize: "12px",
                color: "var(--text-muted)",
              }}
            >
              <div>Upstream: <span style={{ color: "var(--text-primary)" }}>{selectedService.upstreamUrl}</span></div>
              <div>Rate Limit: <span style={{ color: "var(--accent-cyan)" }}>{selectedService.rateLimitMax} reqs/min</span></div>
            </div>
          )}
        </div>

        {/* Live Response Panel */}
        <div className="glass-panel" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ fontSize: "16px" }}>Gateway Response</h3>
            {response && (
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span
                  className={`badge ${
                    response.status >= 200 && response.status < 300
                      ? "badge-2xx"
                      : response.status >= 400 && response.status < 500
                      ? "badge-4xx"
                      : "badge-5xx"
                  }`}
                  style={{ fontSize: "13px", padding: "4px 10px" }}
                >
                  {response.status} {response.statusText}
                </span>

                <span style={{ fontSize: "12px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Clock size={13} color="var(--accent-indigo)" />
                  {response.latencyMs} ms
                </span>
              </div>
            )}
          </div>

          {!response && !sending ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "300px",
                color: "var(--text-muted)",
                gap: "8px",
              }}
            >
              <Play size={32} />
              <p style={{ fontSize: "13px" }}>Hit 'Send Request' to inspect proxy execution</p>
            </div>
          ) : sending ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "300px",
                color: "var(--accent-cyan)",
                gap: "12px",
              }}
            >
              <div className="spin" style={{ width: "24px", height: "24px", border: "2px solid #06b6d4", borderTopColor: "transparent", borderRadius: "50%" }} />
              <p style={{ fontSize: "13px" }}>Traversing reverse proxy pipeline...</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Telemetry Headers */}
              <div>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Gateway Response Headers
                </span>
                <div
                  style={{
                    background: "rgba(0,0,0,0.5)",
                    padding: "10px 14px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    color: "var(--text-secondary)",
                    maxHeight: "130px",
                    overflowY: "auto",
                    marginTop: "6px",
                  }}
                >
                  {Object.entries(response.headers).map(([key, val]) => (
                    <div key={key}>
                      <strong style={{ color: "var(--accent-cyan)" }}>{key}:</strong> {String(val)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Response Body */}
              <div>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Response Body
                </span>
                <pre
                  style={{
                    background: "rgba(0,0,0,0.6)",
                    padding: "14px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    color: response.status >= 400 ? "#fb7185" : "#38bdf8",
                    maxHeight: "240px",
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    marginTop: "6px",
                  }}
                >
                  {JSON.stringify(response.body, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
