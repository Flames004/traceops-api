"use client";

import React, { useState, useEffect } from "react";
import { ScrollText, RefreshCw, Filter, ChevronLeft, ChevronRight, Activity } from "lucide-react";
import { ApiClient } from "../lib/api";
import { RequestLog, Service } from "../types";

export function LogsTab() {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Load Services for filter
  useEffect(() => {
    async function loadServices() {
      try {
        const res = await ApiClient.getServices();
        setServices(res.services);
      } catch (err) {
        console.error(err);
      }
    }
    loadServices();
  }, []);

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const res = await ApiClient.getLogs({
        page,
        limit: 20,
        serviceId: selectedServiceId || undefined,
        statusCode: statusFilter !== "all" ? parseInt(statusFilter, 10) : undefined,
      });

      setLogs(res.logs);
      setPagination(res.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [selectedServiceId, statusFilter]);

  // Auto-refresh every 5 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs(pagination.page);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, pagination.page, selectedServiceId, statusFilter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2>Gateway Request Log Stream</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "2px" }}>
            Real-time audit log of traffic flowing through the reverse proxy data plane.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-secondary)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ width: "auto" }}
            />
            <span>Live Polling (5s)</span>
          </label>

          <button onClick={() => fetchLogs(pagination.page)} className="btn-secondary" style={{ padding: "8px" }} title="Refresh now">
            <RefreshCw size={14} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        className="glass-panel"
        style={{
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Filter size={14} color="var(--text-muted)" />
          <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 600 }}>Filter By:</span>
        </div>

        {/* Service Filter */}
        <select
          value={selectedServiceId}
          onChange={(e) => setSelectedServiceId(e.target.value)}
          style={{ width: "auto", minWidth: "180px", fontSize: "13px" }}
        >
          <option value="">All Services</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} (/{s.slug})
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <div style={{ display: "flex", gap: "6px" }}>
          {[
            { id: "all", label: "All Statuses" },
            { id: "200", label: "200 OK" },
            { id: "401", label: "401 Auth Failed" },
            { id: "429", label: "429 Rate Limited" },
            { id: "502", label: "502 Bad Gateway" },
            { id: "504", label: "504 Timeout" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setStatusFilter(item.id)}
              style={{
                fontSize: "12px",
                padding: "5px 10px",
                borderRadius: "var(--radius-md)",
                background: statusFilter === item.id ? "rgba(6, 182, 212, 0.2)" : "rgba(255, 255, 255, 0.04)",
                color: statusFilter === item.id ? "var(--accent-cyan)" : "var(--text-secondary)",
                border: statusFilter === item.id ? "1px solid rgba(6, 182, 212, 0.4)" : "1px solid var(--border-subtle)",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Log Table */}
      {logs.length === 0 && !loading ? (
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
          <ScrollText size={32} color="var(--text-muted)" />
          <h3>No Request Logs Match Filter</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
            Send traffic through the gateway tester or your API clients to view live logs.
          </p>
        </div>
      ) : (
        <div className="glass-panel" style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "rgba(255, 255, 255, 0.02)", borderBottom: "1px solid var(--border-subtle)" }}>
                <th style={{ padding: "12px 16px", color: "var(--text-muted)", fontWeight: 600 }}>METHOD</th>
                <th style={{ padding: "12px 16px", color: "var(--text-muted)", fontWeight: 600 }}>STATUS</th>
                <th style={{ padding: "12px 16px", color: "var(--text-muted)", fontWeight: 600 }}>PATH</th>
                <th style={{ padding: "12px 16px", color: "var(--text-muted)", fontWeight: 600 }}>LATENCY</th>
                <th style={{ padding: "12px 16px", color: "var(--text-muted)", fontWeight: 600 }}>SERVICE</th>
                <th style={{ padding: "12px 16px", color: "var(--text-muted)", fontWeight: 600 }}>API KEY</th>
                <th style={{ padding: "12px 16px", color: "var(--text-muted)", fontWeight: 600 }}>TIME</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const is2xx = log.statusCode >= 200 && log.statusCode < 300;
                const is4xx = log.statusCode >= 400 && log.statusCode < 500;
                const statusClass = is2xx ? "badge-2xx" : is4xx ? "badge-4xx" : "badge-5xx";

                const latencyColor =
                  log.latencyMs < 100 ? "#34d399" : log.latencyMs < 500 ? "#fbbf24" : "#fb7185";

                return (
                  <tr key={log.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <span className={`method-badge method-${log.method.toLowerCase()}`}>
                        {log.method}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span className={`badge ${statusClass}`}>{log.statusCode}</span>
                      {log.failureCategory && (
                        <span
                          style={{
                            marginLeft: "6px",
                            fontSize: "10px",
                            padding: "2px 5px",
                            borderRadius: "3px",
                            background: "rgba(244, 63, 94, 0.1)",
                            color: "#fb7185",
                          }}
                        >
                          {log.failureCategory}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                      {log.path}
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: latencyColor }}>
                      {log.latencyMs} ms
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>
                      {log.service?.name || "Unknown"}
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-muted)" }}>
                      {log.apiKey ? `${log.apiKey.name} (${log.apiKey.keyPrefix})` : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: "12px" }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination Footer */}
          <div
            style={{
              padding: "12px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "rgba(255, 255, 255, 0.02)",
              borderTop: "1px solid var(--border-subtle)",
              fontSize: "12px",
              color: "var(--text-muted)",
            }}
          >
            <span>
              Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} requests
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                onClick={() => fetchLogs(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="btn-secondary"
                style={{ padding: "4px 8px", opacity: pagination.page <= 1 ? 0.4 : 1 }}
              >
                <ChevronLeft size={14} />
              </button>

              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                Page {pagination.page} of {pagination.totalPages || 1}
              </span>

              <button
                onClick={() => fetchLogs(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="btn-secondary"
                style={{ padding: "4px 8px", opacity: pagination.page >= pagination.totalPages ? 0.4 : 1 }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
