"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "../components/Navbar";
import { Sidebar, TabType } from "../components/Sidebar";
import { OverviewTab } from "../components/OverviewTab";
import { ServicesTab } from "../components/ServicesTab";
import { ApiKeysTab } from "../components/ApiKeysTab";
import { LogsTab } from "../components/LogsTab";
import { GatewayTesterTab } from "../components/GatewayTesterTab";
import { AuthView } from "../components/AuthView";
import { ApiClient } from "../lib/api";
import { User } from "../types";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<TabType>("overview");
  const [serviceCount, setServiceCount] = useState(0);
  const [selectedServiceIdForKeys, setSelectedServiceIdForKeys] = useState<string | null>(null);

  // Check existing session
  useEffect(() => {
    async function initAuth() {
      try {
        const res = await ApiClient.getProfile();
        setUser(res.user);
      } catch (err) {
        ApiClient.removeToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    initAuth();
  }, []);

  const refreshServiceCount = async () => {
    try {
      const res = await ApiClient.getServices();
      setServiceCount(res.count);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    if (user) {
      refreshServiceCount();
    }
  }, [user]);

  const handleLogout = () => {
    ApiClient.removeToken();
    setUser(null);
  };

  const handleNavigateToKeys = (serviceId: string) => {
    setSelectedServiceIdForKeys(serviceId);
    setCurrentTab("keys");
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          color: "var(--accent-cyan)",
          fontSize: "14px",
          gap: "10px",
        }}
      >
        <div
          style={{
            width: "20px",
            height: "20px",
            border: "2px solid #06b6d4",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <span>Initializing TraceOps Control Plane...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <Navbar user={null} onLogout={() => {}} />
        <main>
          <AuthView onAuthSuccess={(authenticatedUser) => setUser(authenticatedUser)} />
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Navbar user={user} onLogout={handleLogout} />

      <div style={{ display: "flex", flex: 1 }}>
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => setCurrentTab(tab)}
          serviceCount={serviceCount}
        />

        <main style={{ flex: 1, padding: "28px 36px", overflowY: "auto", maxWidth: "1400px" }}>
          {currentTab === "overview" && <OverviewTab />}
          {currentTab === "services" && (
            <ServicesTab
              onSelectServiceForKeys={handleNavigateToKeys}
              onRefreshCount={refreshServiceCount}
            />
          )}
          {currentTab === "keys" && <ApiKeysTab initialServiceId={selectedServiceIdForKeys} />}
          {currentTab === "logs" && <LogsTab />}
          {currentTab === "tester" && <GatewayTesterTab />}
        </main>
      </div>
    </div>
  );
}
