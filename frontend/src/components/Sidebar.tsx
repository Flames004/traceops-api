"use client";

import React from "react";
import { BarChart3, Server, KeyRound, ScrollText, Send } from "lucide-react";

export type TabType = "overview" | "services" | "keys" | "logs" | "tester";

interface SidebarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  serviceCount: number;
}

export function Sidebar({ currentTab, onSelectTab, serviceCount }: SidebarProps) {
  const tabs = [
    {
      id: "overview" as TabType,
      label: "Analytics Overview",
      icon: BarChart3,
    },
    {
      id: "services" as TabType,
      label: "Upstream Services",
      icon: Server,
      badge: serviceCount > 0 ? serviceCount : undefined,
    },
    {
      id: "keys" as TabType,
      label: "API Keys",
      icon: KeyRound,
    },
    {
      id: "logs" as TabType,
      label: "Request Logs",
      icon: ScrollText,
    },
    {
      id: "tester" as TabType,
      label: "Gateway Tester",
      icon: Send,
      highlight: true,
    },
  ];

  return (
    <aside
      style={{
        width: "240px",
        borderRight: "1px solid var(--border-subtle)",
        background: "rgba(10, 14, 23, 0.5)",
        padding: "20px 14px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      <div style={{ padding: "0 10px 10px 10px", fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Gateway Control
      </div>

      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: "10px 12px",
              borderRadius: "var(--radius-md)",
              background: isActive
                ? "linear-gradient(90deg, rgba(6, 182, 212, 0.15) 0%, rgba(99, 102, 241, 0.08) 100%)"
                : "transparent",
              color: isActive ? "#fff" : "var(--text-secondary)",
              border: isActive ? "1px solid rgba(6, 182, 212, 0.3)" : "1px solid transparent",
              textAlign: "left",
              fontSize: "13px",
              fontWeight: isActive ? 600 : 500,
              boxShadow: isActive ? "0 0 16px rgba(6, 182, 212, 0.1)" : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Icon
                size={16}
                color={isActive ? "var(--accent-cyan)" : tab.highlight ? "var(--accent-indigo)" : "var(--text-muted)"}
              />
              <span>{tab.label}</span>
            </div>

            {tab.badge !== undefined && (
              <span
                style={{
                  fontSize: "11px",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  background: "rgba(255, 255, 255, 0.1)",
                  color: "var(--text-secondary)",
                }}
              >
                {tab.badge}
              </span>
            )}

            {tab.highlight && !isActive && (
              <span
                style={{
                  fontSize: "9px",
                  padding: "2px 5px",
                  borderRadius: "4px",
                  background: "rgba(99, 102, 241, 0.2)",
                  color: "#818cf8",
                  fontWeight: 700,
                }}
              >
                TEST
              </span>
            )}
          </button>
        );
      })}
    </aside>
  );
}
