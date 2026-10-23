"use client";

import React from "react";
import { Activity, ShieldCheck, LogOut, User as UserIcon } from "lucide-react";
import { User } from "../types";

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
}

export function Navbar({ user, onLogout }: NavbarProps) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 28px",
        borderBottom: "1px solid var(--border-subtle)",
        background: "rgba(10, 14, 23, 0.8)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #06b6d4, #6366f1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 16px rgba(6, 182, 212, 0.4)",
          }}
        >
          <Activity size={20} color="#fff" />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "16px", fontWeight: "700", letterSpacing: "-0.02em" }}>
              TraceOps<span style={{ color: "var(--accent-cyan)" }}>API</span>
            </span>
            <span
              style={{
                fontSize: "10px",
                padding: "2px 6px",
                borderRadius: "4px",
                background: "rgba(6, 182, 212, 0.15)",
                color: "var(--accent-cyan)",
                border: "1px solid rgba(6, 182, 212, 0.3)",
                fontWeight: 600,
              }}
            >
              GATEWAY ACTIVE
            </span>
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "-2px" }}>
            Reverse Proxy & Observability Engine
          </p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            color: "#34d399",
            background: "rgba(16, 185, 129, 0.1)",
            padding: "4px 10px",
            borderRadius: "var(--radius-full)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
          }}
        >
          <div
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "#10b981",
              boxShadow: "0 0 8px #10b981",
            }}
          />
          <span>Data Plane Online</span>
        </div>

        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "4px 10px",
                borderRadius: "var(--radius-md)",
                background: "rgba(255, 255, 255, 0.05)",
                fontSize: "13px",
              }}
            >
              <UserIcon size={14} color="var(--text-secondary)" />
              <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{user.name}</span>
              <span
                style={{
                  fontSize: "10px",
                  color: "var(--text-muted)",
                  background: "rgba(255, 255, 255, 0.08)",
                  padding: "1px 5px",
                  borderRadius: "3px",
                }}
              >
                {user.role}
              </span>
            </div>

            <button
              onClick={onLogout}
              className="btn-secondary"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                padding: "6px 12px",
              }}
              title="Sign Out"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
