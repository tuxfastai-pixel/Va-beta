"use client";

import { useEffect, useState } from "react";

interface AccessRequest {
  id: string;
  email: string;
  name: string;
  reason?: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export default function AdminAccessDashboard() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/admin/access-requests?status=${filter}`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) {
          setRequests(data.requests || []);
        }
      })
      .catch((error) => {
        console.error("Fetch error:", error);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filter]);

  function selectFilter(nextFilter: AccessRequest["status"]) {
    setLoading(true);
    setFilter(nextFilter);
  }


  async function approveUser(email: string) {
    try {
      setProcessing(email);
      const response = await fetch("/api/admin/approve-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          adminNotes: "Approved via admin dashboard",
        }),
      });

      if (response.ok) {
        setRequests(requests.filter((r) => r.email !== email));
        alert(`âœ… User ${email} approved!`);
      } else {
        alert("Failed to approve user");
      }
    } catch (error) {
      console.error("Approve error:", error);
      alert("Error approving user");
    } finally {
      setProcessing(null);
    }
  }

  async function rejectUser(email: string, reason?: string) {
    const rejectionReason =
      reason || prompt("Enter reason for rejection (optional):");

    try {
      setProcessing(email);
      const response = await fetch("/api/admin/reject-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          reason: rejectionReason,
          adminNotes: "Rejected via admin dashboard",
        }),
      });

      if (response.ok) {
        setRequests(requests.filter((r) => r.email !== email));
        alert(`âŒ User ${email} rejected!`);
      } else {
        alert("Failed to reject user");
      }
    } catch (error) {
      console.error("Reject error:", error);
      alert("Error rejecting user");
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div style={{ padding: "20px", fontFamily: "system-ui, sans-serif" }}>
      <h1>ðŸ” Access Control Dashboard</h1>

      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={() => selectFilter("pending")}
          style={{
            marginRight: "10px",
            padding: "8px 16px",
            backgroundColor: filter === "pending" ? "#007bff" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          ðŸ“‹ Pending ({requests.length})
        </button>
        <button
          onClick={() => selectFilter("approved")}
          style={{
            marginRight: "10px",
            padding: "8px 16px",
            backgroundColor: filter === "approved" ? "#28a745" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          âœ… Approved
        </button>
        <button
          onClick={() => selectFilter("rejected")}
          style={{
            padding: "8px 16px",
            backgroundColor: filter === "rejected" ? "#dc3545" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          âŒ Rejected
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : requests.length === 0 ? (
        <p style={{ color: "#666" }}>No {filter} requests</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
            gap: "16px",
          }}
        >
          {requests.map((request) => (
            <div
              key={request.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "16px",
                backgroundColor: "#f9f9f9",
              }}
            >
              <h3>{request.name}</h3>
              <p>
                <strong>Email:</strong> {request.email}
              </p>
              <p>
                <strong>Reason:</strong> {request.reason || "Not provided"}
              </p>
              <p>
                <strong>Requested:</strong>{" "}
                {new Date(request.created_at).toLocaleDateString()}
              </p>

              {filter === "pending" && (
                <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => approveUser(request.email)}
                    disabled={processing === request.email}
                    style={{
                      flex: 1,
                      padding: "8px",
                      backgroundColor: "#28a745",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    âœ… Approve
                  </button>
                  <button
                    onClick={() => rejectUser(request.email)}
                    disabled={processing === request.email}
                    style={{
                      flex: 1,
                      padding: "8px",
                      backgroundColor: "#dc3545",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    âŒ Reject
                  </button>
                </div>
              )}

              <div
                style={{
                  marginTop: "12px",
                  padding: "8px",
                  backgroundColor: "#e0e0e0",
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
              >
                Status: <strong>{request.status.toUpperCase()}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
