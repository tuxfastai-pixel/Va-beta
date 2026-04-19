"use client";

import { useEffect, useState } from "react";

interface KPIMetrics {
  ctr: number;
  costPerLead: number;
  closeRate: number;
  openRate: number;
  replyRate: number;
  bounceRate: number;
  emailsSent: number;
  leadsCreated: number;
  closedDeals: number;
  subscriptions: number;
}

interface KPIData {
  period: string;
  metrics: KPIMetrics;
  targets: Record<string, unknown>;
  assessment: {
    healthy: string[];
    warning: string[];
    critical: string[];
  };
}

interface EmailAccountSummary {
  id: string;
  email: string;
  status: string;
  daily_limit?: number;
  sent_today?: number;
  sent_total?: number;
  reply_rate?: number;
  bounce_rate?: number;
}

export default function ColdEmailDashboard() {
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const kpiRes = await fetch("/api/analytics/kpi?days=30");
        const kpiJson = (await kpiRes.json()) as KPIData;
        setKpiData(kpiJson);

        const accountsRes = await fetch("/api/outreach/accounts");
        const accountsJson = (await accountsRes.json()) as { accounts?: EmailAccountSummary[] };
        setEmailAccounts(Array.isArray(accountsJson.accounts) ? accountsJson.accounts : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading data");
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 40, backgroundColor: "#0f0f0f", minHeight: "100vh", color: "#fff" }}>
        Loading...
      </div>
    );
  }

  const kpi = kpiData?.metrics;

  return (
    <div style={{ padding: 40, backgroundColor: "#0f0f0f", minHeight: "100vh", color: "#fff" }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 40 }}>Cold Email Campaign</h1>

      {error && (
        <div style={{ padding: 16, backgroundColor: "#7f1d1d", borderRadius: 6, marginBottom: 20, color: "#fca5a5" }}>
          {error}
        </div>
      )}

      {/* KPI Cards */}
      {kpi && (
        <>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Performance Metrics</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: 20,
              marginBottom: 40,
            }}
          >
            {/* CTR Card */}
            <div style={{ padding: 20, backgroundColor: "#1a1a1a", borderRadius: 8, border: "1px solid #333" }}>
              <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Click-Through Rate</p>
              <p style={{ fontSize: 28, fontWeight: 700, margin: "8px 0", color: "#10b981" }}>
                {kpi.ctr}%
              </p>
              <p style={{ fontSize: 12, color: "#666", margin: "4px 0" }}>
                Target: 2–5%{kpi.ctr >= 2 && kpi.ctr <= 5 ? " ✅" : " ⚠️"}
              </p>
            </div>

            {/* Cost Per Lead */}
            <div style={{ padding: 20, backgroundColor: "#1a1a1a", borderRadius: 8, border: "1px solid #333" }}>
              <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Cost Per Lead</p>
              <p style={{ fontSize: 28, fontWeight: 700, margin: "8px 0", color: "#10b981" }}>
                ${kpi.costPerLead.toFixed(2)}
              </p>
              <p style={{ fontSize: 12, color: "#666", margin: "4px 0" }}>
                Target: {"<"}$10{kpi.costPerLead <= 10 ? " ✅" : " ❌"}
              </p>
            </div>

            {/* Close Rate */}
            <div style={{ padding: 20, backgroundColor: "#1a1a1a", borderRadius: 8, border: "1px solid #333" }}>
              <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Close Rate</p>
              <p style={{ fontSize: 28, fontWeight: 700, margin: "8px 0", color: "#10b981" }}>
                {kpi.closeRate}%
              </p>
              <p style={{ fontSize: 12, color: "#666", margin: "4px 0" }}>
                Target: 5–15%{kpi.closeRate >= 5 && kpi.closeRate <= 15 ? " ✅" : " ⚠️"}
              </p>
            </div>

            {/* Open Rate */}
            <div style={{ padding: 20, backgroundColor: "#1a1a1a", borderRadius: 8, border: "1px solid #333" }}>
              <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Email Open Rate</p>
              <p style={{ fontSize: 28, fontWeight: 700, margin: "8px 0", color: "#10b981" }}>
                {kpi.openRate}%
              </p>
              <p style={{ fontSize: 12, color: "#666", margin: "4px 0" }}>Target: 25%+ {kpi.openRate >= 25 ? "✅" : "⚠️"}</p>
            </div>

            {/* Reply Rate */}
            <div style={{ padding: 20, backgroundColor: "#1a1a1a", borderRadius: 8, border: "1px solid #333" }}>
              <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Reply Rate</p>
              <p style={{ fontSize: 28, fontWeight: 700, margin: "8px 0", color: "#10b981" }}>
                {kpi.replyRate}%
              </p>
              <p style={{ fontSize: 12, color: "#666", margin: "4px 0" }}>Target: 5%+ {kpi.replyRate >= 5 ? "✅" : "⚠️"}</p>
            </div>

            {/* Bounce Rate */}
            <div style={{ padding: 20, backgroundColor: "#1a1a1a", borderRadius: 8, border: "1px solid #333" }}>
              <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Bounce Rate</p>
              <p style={{ fontSize: 28, fontWeight: 700, margin: "8px 0", color: "#ef4444" }}>
                {kpi.bounceRate}%
              </p>
              <p style={{ fontSize: 12, color: "#666", margin: "4px 0" }}>Keep {"<"}5% {kpi.bounceRate < 5 ? "✅" : "❌"}</p>
            </div>
          </div>

          {/* Volume Metrics */}
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Volume</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
              marginBottom: 40,
            }}
          >
            <div style={{ padding: 16, backgroundColor: "#1a1a1a", borderRadius: 6, border: "1px solid #333" }}>
              <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Emails Sent</p>
              <p style={{ fontSize: 24, fontWeight: 600, margin: "8px 0" }}>{kpi.emailsSent}</p>
            </div>
            <div style={{ padding: 16, backgroundColor: "#1a1a1a", borderRadius: 6, border: "1px solid #333" }}>
              <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Leads Created</p>
              <p style={{ fontSize: 24, fontWeight: 600, margin: "8px 0" }}>{kpi.leadsCreated}</p>
            </div>
            <div style={{ padding: 16, backgroundColor: "#1a1a1a", borderRadius: 6, border: "1px solid #333" }}>
              <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Deals Closed</p>
              <p style={{ fontSize: 24, fontWeight: 600, margin: "8px 0" }}>{kpi.closedDeals}</p>
            </div>
            <div style={{ padding: 16, backgroundColor: "#1a1a1a", borderRadius: 6, border: "1px solid #333" }}>
              <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Subscriptions</p>
              <p style={{ fontSize: 24, fontWeight: 600, margin: "8px 0" }}>{kpi.subscriptions}</p>
            </div>
          </div>
        </>
      )}

      {/* Email Accounts Section */}
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Email Accounts ({emailAccounts.length})</h2>

      {emailAccounts.length > 0 ? (
        <div style={{ backgroundColor: "#1a1a1a", borderRadius: 8, border: "1px solid #333", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottomColor: "#333", borderBottomWidth: 1, borderBottomStyle: "solid" }}>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Email</th>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Status</th>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Sent Today</th>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Total Sent</th>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Health</th>
              </tr>
            </thead>
            <tbody>
              {emailAccounts.map((acc) => (
                <tr
                  key={acc.id}
                  style={{ borderTopColor: "#333", borderTopWidth: 1, borderTopStyle: "solid" }}
                >
                  <td style={{ padding: 12, fontSize: 14 }}>{acc.email}</td>
                  <td style={{ padding: 12, fontSize: 14 }}>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: 4,
                        backgroundColor: acc.status === "active" ? "#065f46" : "#7f1d1d",
                        color: acc.status === "active" ? "#d1fae5" : "#fca5a5",
                        fontSize: 12,
                      }}
                    >
                      {acc.status}
                    </span>
                  </td>
                  <td style={{ padding: 12, fontSize: 14 }}>
                    {acc.sent_today}/{acc.daily_limit}
                  </td>
                  <td style={{ padding: 12, fontSize: 14 }}>{acc.sent_total || 0}</td>
                  <td style={{ padding: 12, fontSize: 14 }}>
                    Open rate: {acc.reply_rate || 0}% | Bounce: {acc.bounce_rate || 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ color: "#888", textAlign: "center", padding: 40 }}>No email accounts configured</p>
      )}

      {/* Assessment Section */}
      {kpiData?.assessment && (
        <>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 40, marginBottom: 20 }}>Assessment</h2>

          {kpiData.assessment.healthy.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#10b981", marginBottom: 12 }}>Healthy ✅</h3>
              {kpiData.assessment.healthy.map((item: string, i: number) => (
                <p key={i} style={{ margin: 0, fontSize: 14, color: "#10b981" }}>
                  • {item}
                </p>
              ))}
            </div>
          )}

          {kpiData.assessment.warning.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f59e0b", marginBottom: 12 }}>Warning ⚠️</h3>
              {kpiData.assessment.warning.map((item: string, i: number) => (
                <p key={i} style={{ margin: 0, fontSize: 14, color: "#f59e0b" }}>
                  • {item}
                </p>
              ))}
            </div>
          )}

          {kpiData.assessment.critical.length > 0 && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#ef4444", marginBottom: 12 }}>Critical ❌</h3>
              {kpiData.assessment.critical.map((item: string, i: number) => (
                <p key={i} style={{ margin: 0, fontSize: 14, color: "#ef4444" }}>
                  • {item}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
