"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Server,
  Zap,
} from "lucide-react";
import { ApiClient } from "../lib/api";
import { AnalyticsOverview } from "../types";

export function OverviewTab() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [timeRange, setTimeRange] = useState("24h");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const overview = await ApiClient.getOverview(timeRange);
      setData(overview);
    } catch (err: any) {
      setError(err.message || "Failed to load telemetry overview");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [timeRange]);

  // Compute SVG chart coordinates from timeSeries data
  const renderChart = () => {
    if (!data || !data.timeSeries || data.timeSeries.length === 0) {
      return (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: "13px" }}>
          No traffic recorded in this time window. Send gateway requests to populate analytics.
        </div>
      );
    }

    const points = data.timeSeries;
    const maxVal = Math.max(...points.map((p) => p.totalRequests), 5);
    const height = 180;
    const width = 800;
    const padding = 20;

    const getX = (idx: number) => padding + (idx / (points.length - 1)) * (width - 2 * padding);
    const getY = (val: number) => height - padding - (val / maxVal) * (height - 2 * padding);

    const totalPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(p.totalRequests)}`).join(" ");
    const errorPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(p.errorRequests)}`).join(" ");

    const areaPath = `${totalPath} L ${getX(points.length - 1)} ${height - padding} L ${getX(0)} ${height - padding} Z`;

    return (
      <div style={{ width: "100%", overflowX: "auto" }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "220px", display: "block" }}>
          <defs>
            <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.05)" />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="rgba(255,255,255,0.05)" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.1)" />

          {/* Area fill */}
          <path d={areaPath} fill="url(#cyanGradient)" />

          {/* Lines */}
          <path d={totalPath} fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d={errorPath} fill="none" stroke="#f43f5e" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />

          {/* Data Points */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={getX(i)}
              cy={getY(p.totalRequests)}
              r={3}
              fill="#06b6d4"
              stroke="#07090e"
              strokeWidth="1.5"
            />
          ))}
        </svg>

        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 10px", marginTop: "4px" }}>
          {points.filter((_, idx) => idx % Math.ceil(points.length / 6) === 0).map((p, i) => (
            <span key={i} style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              {p.label}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2>Real-Time Gateway Observability</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "2px" }}>
            Traffic telemetry captured non-blockingly on the gateway reverse proxy path.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              display: "flex",
              background: "rgba(255, 255, 255, 0.05)",
              padding: "3px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {["1h", "24h", "7d", "30d"].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                style={{
                  padding: "4px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "6px",
                  background: timeRange === range ? "var(--accent-cyan)" : "transparent",
                  color: timeRange === range ? "#07090e" : "var(--text-secondary)",
                }}
              >
                {range}
              </button>
            ))}
          </div>

          <button onClick={fetchOverview} className="btn-secondary" style={{ padding: "8px" }} title="Refresh metrics">
            <RefreshCw size={14} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "var(--radius-md)",
            background: "rgba(244, 63, 94, 0.15)",
            border: "1px solid rgba(244, 63, 94, 0.3)",
            color: "#fb7185",
            fontSize: "13px",
          }}
        >
          {error}
        </div>
      )}

      {/* Metric Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        {/* Total Requests */}
        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Total Requests
            </span>
            <Activity size={18} color="var(--accent-cyan)" />
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#fff" }}>
            {data ? data.totalRequests.toLocaleString() : "..."}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
            Processed in last {timeRange}
          </div>
        </div>

        {/* Success Count */}
        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Successful (2xx/3xx)
            </span>
            <CheckCircle2 size={18} color="var(--accent-emerald)" />
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#34d399" }}>
            {data ? data.successfulRequests.toLocaleString() : "..."}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
            {data && data.totalRequests > 0
              ? `${((data.successfulRequests / data.totalRequests) * 100).toFixed(1)}% success rate`
              : "100% nominal"}
          </div>
        </div>

        {/* Error Rate */}
        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Error Rate
            </span>
            <AlertTriangle size={18} color={data && data.errorRate > 0 ? "var(--accent-rose)" : "var(--text-muted)"} />
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: data && data.errorRate > 0 ? "#fb7185" : "#fff" }}>
            {data ? `${data.errorRate}%` : "..."}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
            {data ? `${data.errorRequests} total failed requests` : "No errors detected"}
          </div>
        </div>

        {/* Average Latency */}
        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Avg Latency
            </span>
            <Clock size={18} color="var(--accent-indigo)" />
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#fff" }}>
            {data ? `${data.latency.avg} ms` : "..."}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
            {data ? `Min: ${data.latency.min}ms | Max: ${data.latency.max}ms` : "Round-trip time"}
          </div>
        </div>
      </div>

      {/* Traffic Chart Panel */}
      <div className="glass-panel" style={{ padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div>
            <h3>Gateway Traffic Volume & Error Spikes</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "12px", marginTop: "2px" }}>
              Request throughput (solid cyan) vs. Error counts (dashed red) across time window
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "12px", height: "3px", background: "#06b6d4", borderRadius: "2px" }} />
              <span style={{ color: "var(--text-secondary)" }}>Total Throughput</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "12px", height: "3px", background: "#f43f5e", borderRadius: "2px" }} />
              <span style={{ color: "var(--text-secondary)" }}>Errors (4xx / 5xx)</span>
            </div>
          </div>
        </div>

        {renderChart()}
      </div>

      {/* Lower Row: Status Code Breakdown & Top Services */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {/* Status Codes */}
        <div className="glass-panel" style={{ padding: "20px" }}>
          <h3 style={{ marginBottom: "14px", fontSize: "15px" }}>Status Code Breakdown</h3>
          {data && data.statusBreakdown.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              {data.statusBreakdown.map((sb) => {
                const is2xx = sb.statusCode >= 200 && sb.statusCode < 300;
                const is4xx = sb.statusCode >= 400 && sb.statusCode < 500;
                const badgeClass = is2xx ? "badge-2xx" : is4xx ? "badge-4xx" : "badge-5xx";

                return (
                  <div
                    key={sb.statusCode}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 14px",
                      borderRadius: "var(--radius-md)",
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <span className={`badge ${badgeClass}`}>HTTP {sb.statusCode}</span>
                    <span style={{ fontSize: "14px", fontWeight: 700 }}>{sb.count.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>No status data recorded yet.</p>
          )}
        </div>

        {/* Top Active Services */}
        <div className="glass-panel" style={{ padding: "20px" }}>
          <h3 style={{ marginBottom: "14px", fontSize: "15px" }}>Top Active Services</h3>
          {data && data.topServices.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {data.topServices.map((svc) => (
                <div
                  key={svc.serviceId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-md)",
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Server size={14} color="var(--accent-cyan)" />
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>{svc.name}</span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      /{svc.slug}
                    </span>
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--accent-cyan)" }}>
                    {svc.requestCount.toLocaleString()} reqs
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>No active services handling requests yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
