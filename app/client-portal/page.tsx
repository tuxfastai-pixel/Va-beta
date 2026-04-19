"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type DashboardData = {
  jobs: Array<{ id: string; title: string; status?: string; created_at?: string }>;
  invoices: Array<{ id: string; amount: number; status?: string; created_at?: string }>;
};

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export default function ClientPortal() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if user is authenticated
        const authRes = await fetch("/api/auth/me", { credentials: "include" });

        if (!authRes.ok) {
          router.push("/login");
          return;
        }

        const authData = await authRes.json();
        setUser(authData.user);

        // Fetch dashboard data
        const dashRes = await fetch("/api/dashboard");
        const dashData = await dashRes.json();
        setData(dashData || { jobs: [], invoices: [] });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading portal");
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/");
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", backgroundColor: "#0f0f0f", color: "#ffffff" }}>
        Loading...
      </div>
    );
  }

  if (error || !user) {
    return (
      <div style={{ padding: 40, color: "#ffffff", backgroundColor: "#0f0f0f", minHeight: "100vh" }}>
        <p>{error || "Not authenticated"}</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f0f0f", color: "#ffffff" }}>
      {/* Header */}
      <div
        style={{
          padding: "20px 40px",
          borderBottom: "1px solid #333",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Client Portal</h1>
          <p style={{ margin: "8px 0 0 0", color: "#888", fontSize: 14 }}>Welcome, {user.name}</p>
        </div>

        <button
          onClick={handleLogout}
          style={{
            padding: "8px 16px",
            fontSize: 14,
            backgroundColor: "#374151",
            color: "#ffffff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div style={{ padding: "40px", maxWidth: 1200, margin: "0 auto" }}>
        {/* Jobs Section */}
        <div style={{ marginBottom: 60 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>Active Jobs</h2>

          {data && data.jobs.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: 20,
              }}
            >
              {data.jobs.map((job) => (
                <div
                  key={job.id}
                  style={{
                    padding: 20,
                    backgroundColor: "#1a1a1a",
                    borderRadius: 8,
                    border: "1px solid #333",
                  }}
                >
                  <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 12px 0" }}>
                    {job.title}
                  </h3>
                  {job.status && (
                    <p style={{ margin: 0, fontSize: 13, color: "#10b981" }}>
                      Status: {job.status}
                    </p>
                  )}
                  {job.created_at && (
                    <p style={{ margin: "8px 0 0 0", fontSize: 12, color: "#888" }}>
                      {new Date(job.created_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "#888" }}>No active jobs</p>
          )}
        </div>

        {/* Invoices Section */}
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>Invoices</h2>

          {data && data.invoices.length > 0 ? (
            <div style={{ backgroundColor: "#1a1a1a", borderRadius: 8, border: "1px solid #333", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottomColor: "#333", borderBottomWidth: 1, borderBottomStyle: "solid" }}>
                    <th style={{ padding: 16, textAlign: "left", fontWeight: 600 }}>Date</th>
                    <th style={{ padding: 16, textAlign: "left", fontWeight: 600 }}>Amount</th>
                    <th style={{ padding: 16, textAlign: "left", fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      style={{ borderTopColor: "#333", borderTopWidth: 1, borderTopStyle: "solid" }}
                    >
                      <td style={{ padding: 16, fontSize: 14 }}>
                        {inv.created_at
                          ? new Date(inv.created_at).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td style={{ padding: 16, fontSize: 14, fontWeight: 600 }}>
                        ${inv.amount.toLocaleString()}
                      </td>
                      <td style={{ padding: 16, fontSize: 14, color: "#10b981" }}>
                        {inv.status || "Paid"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: "#888" }}>No invoices</p>
          )}
        </div>
      </div>
    </div>
  );
}
