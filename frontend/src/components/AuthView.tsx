"use client";

import React, { useState } from "react";
import { Activity, Lock, Mail, User as UserIcon, ArrowRight } from "lucide-react";
import { ApiClient } from "../lib/api";
import { User } from "../types";

interface AuthViewProps {
  onAuthSuccess: (user: User) => void;
}

export function AuthView({ onAuthSuccess }: AuthViewProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("admin@traceops.io");
  const [password, setPassword] = useState("password123");
  const [name, setName] = useState("Admin User");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        const res = await ApiClient.register({ email, password, name });
        onAuthSuccess(res.user);
      } else {
        const res = await ApiClient.login({ email, password });
        onAuthSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "85vh",
        padding: "20px",
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "36px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 16px 48px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "8px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #06b6d4, #6366f1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 24px rgba(6, 182, 212, 0.4)",
            }}
          >
            <Activity size={26} color="#fff" />
          </div>
          <h2 style={{ fontSize: "20px", marginTop: "4px" }}>
            TraceOps<span style={{ color: "var(--accent-cyan)" }}>API</span>
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
            {isRegister ? "Create a platform admin account" : "Sign in to the gateway dashboard"}
          </p>
        </div>

        {/* Tab switch */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            background: "rgba(0,0,0,0.3)",
            padding: "3px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setIsRegister(false);
              setError(null);
            }}
            style={{
              padding: "6px",
              fontSize: "12px",
              fontWeight: 600,
              borderRadius: "6px",
              background: !isRegister ? "rgba(255, 255, 255, 0.08)" : "transparent",
              color: !isRegister ? "#fff" : "var(--text-muted)",
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegister(true);
              setError(null);
            }}
            style={{
              padding: "6px",
              fontSize: "12px",
              fontWeight: 600,
              borderRadius: "6px",
              background: isRegister ? "rgba(255, 255, 255, 0.08)" : "transparent",
              color: isRegister ? "#fff" : "var(--text-muted)",
            }}
          >
            Create Account
          </button>
        </div>

        {error && (
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
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {isRegister && (
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                Full Name
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  placeholder="e.g. Jane Developer"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ paddingLeft: "36px" }}
                  required
                />
                <UserIcon size={16} color="var(--text-muted)" style={{ position: "absolute", left: "12px", top: "12px" }} />
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
              Email Address
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="email"
                placeholder="admin@traceops.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: "36px" }}
                required
              />
              <Mail size={16} color="var(--text-muted)" style={{ position: "absolute", left: "12px", top: "12px" }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: "36px" }}
                required
              />
              <Lock size={16} color="var(--text-muted)" style={{ position: "absolute", left: "12px", top: "12px" }} />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "12px",
              marginTop: "8px",
              fontSize: "14px",
            }}
          >
            <span>{loading ? "Authenticating..." : isRegister ? "Create Account" : "Sign In to Gateway"}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ textAlign: "center", fontSize: "11px", color: "var(--text-muted)" }}>
          Dashboard Auth utilizes JWT + Bcrypt. Gateway traffic uses separate SHA-256 API keys.
        </div>
      </div>
    </div>
  );
}
