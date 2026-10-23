"use client";

import React, { useState, useEffect } from "react";
import { KeyRound, Plus, Copy, Check, AlertOctagon, Trash2, Ban } from "lucide-react";
import { ApiClient } from "../lib/api";
import { Service, ApiKey } from "../types";

interface ApiKeysTabProps {
  initialServiceId?: string | null;
}

export function ApiKeysTab({ initialServiceId }: ApiKeysTabProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);

  // New Key Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [rateLimitMax, setRateLimitMax] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Display-Once Generated Key Modal
  const [newlyGeneratedKey, setNewlyGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Load Services
  useEffect(() => {
    async function loadServices() {
      try {
        const res = await ApiClient.getServices();
        setServices(res.services);
        if (initialServiceId && res.services.some((s) => s.id === initialServiceId)) {
          setSelectedServiceId(initialServiceId);
        } else if (res.services.length > 0) {
          setSelectedServiceId(res.services[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadServices();
  }, [initialServiceId]);

  // Load Keys when selected service changes
  const fetchKeys = async () => {
    if (!selectedServiceId) return;
    setLoading(true);
    try {
      const res = await ApiClient.getApiKeys(selectedServiceId);
      setKeys(res.keys);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, [selectedServiceId]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServiceId) return;
    setCreateError(null);
    setCreating(true);

    try {
      const res = await ApiClient.createApiKey(selectedServiceId, {
        name: keyName,
        rateLimitMax: rateLimitMax ? parseInt(rateLimitMax, 10) : undefined,
      });

      setCreateModalOpen(false);
      setKeyName("");
      setRateLimitMax("");
      setNewlyGeneratedKey(res.rawKey);
      setCopiedKey(false);
      fetchKeys();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!confirm("Are you sure you want to revoke this API key? Any client using it will immediately be rejected with HTTP 401.")) {
      return;
    }
    try {
      await ApiClient.revokeApiKey(selectedServiceId, keyId);
      fetchKeys();
    } catch (err: any) {
      alert(`Error revoking key: ${err.message}`);
    }
  };

  const handleDelete = async (keyId: string) => {
    if (!confirm("Delete this API key permanently from the database?")) {
      return;
    }
    try {
      await ApiClient.deleteApiKey(selectedServiceId, keyId);
      fetchKeys();
    } catch (err: any) {
      alert(`Error deleting key: ${err.message}`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const currentService = services.find((s) => s.id === selectedServiceId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2>API Key Provisioning</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "2px" }}>
            Cryptographically secure machine-to-machine tokens stored via one-way SHA-256 verifiers.
          </p>
        </div>

        <button
          onClick={() => {
            setCreateError(null);
            setCreateModalOpen(true);
          }}
          disabled={!selectedServiceId}
          className="btn-primary"
          style={{ display: "flex", alignItems: "center", gap: "8px", opacity: !selectedServiceId ? 0.5 : 1 }}
        >
          <Plus size={16} />
          <span>Provision New Key</span>
        </button>
      </div>

      {/* Service Selector Dropdown */}
      <div
        className="glass-panel"
        style={{
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>Target Service:</span>
        <select
          value={selectedServiceId}
          onChange={(e) => setSelectedServiceId(e.target.value)}
          style={{ maxWidth: "320px" }}
        >
          {services.map((svc) => (
            <option key={svc.id} value={svc.id}>
              {svc.name} (/{svc.slug})
            </option>
          ))}
        </select>

        {currentService && (
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "auto" }}>
            Default Limit: <strong style={{ color: "var(--text-primary)" }}>{currentService.rateLimitMax} reqs/min</strong>
          </div>
        )}
      </div>

      {/* Keys Table */}
      {keys.length === 0 && !loading ? (
        <div
          className="glass-panel"
          style={{
            padding: "50px 20px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <KeyRound size={32} color="var(--text-muted)" />
          <h3>No API Keys for this Service</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
            Generate a key to grant external clients access to route through this gateway service.
          </p>
        </div>
      ) : (
        <div className="glass-panel" style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "rgba(255, 255, 255, 0.02)", borderBottom: "1px solid var(--border-subtle)" }}>
                <th style={{ padding: "12px 18px", color: "var(--text-muted)", fontWeight: 600 }}>NAME</th>
                <th style={{ padding: "12px 18px", color: "var(--text-muted)", fontWeight: 600 }}>PREFIX MASK</th>
                <th style={{ padding: "12px 18px", color: "var(--text-muted)", fontWeight: 600 }}>RATE LIMIT</th>
                <th style={{ padding: "12px 18px", color: "var(--text-muted)", fontWeight: 600 }}>STATUS</th>
                <th style={{ padding: "12px 18px", color: "var(--text-muted)", fontWeight: 600 }}>LAST USED</th>
                <th style={{ padding: "12px 18px", color: "var(--text-muted)", fontWeight: 600 }}>CREATED</th>
                <th style={{ padding: "12px 18px", color: "var(--text-muted)", fontWeight: 600, textAlign: "right" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                  <td style={{ padding: "14px 18px", fontWeight: 600 }}>{key.name}</td>
                  <td style={{ padding: "14px 18px", fontFamily: "var(--font-mono)", color: "var(--accent-cyan)" }}>
                    {key.keyPrefix}••••••••••••
                  </td>
                  <td style={{ padding: "14px 18px" }}>
                    {key.rateLimitMax ? (
                      <span style={{ color: "var(--accent-indigo)", fontWeight: 500 }}>{key.rateLimitMax} reqs/min</span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>Service Default</span>
                    )}
                  </td>
                  <td style={{ padding: "14px 18px" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontWeight: 600,
                        background: key.isActive ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)",
                        color: key.isActive ? "#34d399" : "#fb7185",
                      }}
                    >
                      {key.isActive ? "ACTIVE" : "REVOKED"}
                    </span>
                  </td>
                  <td style={{ padding: "14px 18px", color: "var(--text-muted)" }}>
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "Never"}
                  </td>
                  <td style={{ padding: "14px 18px", color: "var(--text-muted)" }}>
                    {new Date(key.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "14px 18px", textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "6px" }}>
                      {key.isActive && (
                        <button
                          onClick={() => handleRevoke(key.id)}
                          className="btn-secondary"
                          style={{ fontSize: "11px", padding: "4px 8px", color: "#fb7185" }}
                          title="Revoke key immediately"
                        >
                          <Ban size={12} style={{ marginRight: "3px", verticalAlign: "middle" }} />
                          Revoke
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(key.id)}
                        className="btn-danger"
                        style={{ padding: "4px 8px" }}
                        title="Delete key"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Key Modal */}
      {createModalOpen && (
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
            style={{ width: "100%", maxWidth: "460px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>Provision API Key</h3>
              <button onClick={() => setCreateModalOpen(false)} style={{ background: "transparent", color: "var(--text-muted)", fontSize: "18px" }}>
                ✕
              </button>
            </div>

            {createError && (
              <div style={{ padding: "10px", borderRadius: "6px", background: "rgba(244, 63, 94, 0.15)", color: "#fb7185", fontSize: "12px" }}>
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateKey} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                  Key Description / Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mobile iOS Client or Customer Staging"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                  Custom Rate Limit Override (Requests per min, optional)
                </label>
                <input
                  type="number"
                  placeholder="Leave blank to use service default"
                  value={rateLimitMax}
                  onChange={(e) => setRateLimitMax(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" onClick={() => setCreateModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn-primary">
                  {creating ? "Generating..." : "Generate Key"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generated Secret Key Alert Modal (DISPLAY ONCE) */}
      {newlyGeneratedKey && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 110,
            padding: "20px",
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: "100%",
              maxWidth: "520px",
              padding: "28px",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              border: "1px solid var(--accent-cyan)",
              boxShadow: "0 0 32px rgba(6, 182, 212, 0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  background: "rgba(6, 182, 212, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <KeyRound size={20} color="var(--accent-cyan)" />
              </div>
              <div>
                <h3>API Key Generated Successfully</h3>
                <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Save your secret key now. It will NEVER be shown again!
                </p>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(244, 63, 94, 0.1)",
                border: "1px solid rgba(244, 63, 94, 0.3)",
                padding: "10px 14px",
                borderRadius: "var(--radius-md)",
                color: "#fb7185",
                fontSize: "12px",
              }}
            >
              <AlertOctagon size={16} style={{ flexShrink: 0 }} />
              <span>
                For security reasons, TraceOpsAPI stores only a SHA-256 digest of this token. If you lose this key, you must generate a new one.
              </span>
            </div>

            {/* Secret Container with 1-click copy */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(0,0,0,0.6)",
                padding: "12px 14px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <code
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "13px",
                  color: "#38bdf8",
                  wordBreak: "break-all",
                  flex: 1,
                }}
              >
                {newlyGeneratedKey}
              </code>

              <button
                onClick={() => copyToClipboard(newlyGeneratedKey)}
                className="btn-primary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 12px",
                  flexShrink: 0,
                  fontSize: "12px",
                }}
              >
                {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedKey ? "Copied!" : "Copy"}</span>
              </button>
            </div>

            <button
              onClick={() => setNewlyGeneratedKey(null)}
              className="btn-secondary"
              style={{ alignSelf: "flex-end", marginTop: "8px" }}
            >
              I have copied and saved my secret key
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
