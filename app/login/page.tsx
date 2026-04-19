"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data?.error || "Login failed");
        setLoading(false);
        return;
      }

      // Redirect to client portal
      router.push("/client-portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0f0f0f",
        color: "#ffffff",
      }}
    >
      <div
        style={{
          maxWidth: 400,
          width: "100%",
          padding: 40,
          backgroundColor: "#1a1a1a",
          borderRadius: 8,
          border: "1px solid #333",
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 30, textAlign: "center" }}>
          Client Portal
        </h1>

        <form onSubmit={handleLogin} style={{ display: "grid", gap: 16 }}>
          <div>
            <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 6,
                border: "1px solid #333",
                backgroundColor: "#0f0f0f",
                color: "#ffffff",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 6,
                border: "1px solid #333",
                backgroundColor: "#0f0f0f",
                color: "#ffffff",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <div style={{ padding: 12, backgroundColor: "#7f1d1d", borderRadius: 6, color: "#fca5a5" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px 16px",
              fontSize: 14,
              fontWeight: 600,
              backgroundColor: "#10b981",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p style={{ marginTop: 20, textAlign: "center", color: "#888", fontSize: 14 }}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" style={{ color: "#10b981", textDecoration: "none" }}>
            Sign up
          </Link>
        </p>

        <p style={{ marginTop: 12, textAlign: "center", color: "#888", fontSize: 14 }}>
          <Link href="/" style={{ color: "#10b981", textDecoration: "none" }}>
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
