"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const router = useRouter();

  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return false;
    }
    setPasswordError("");
    return true;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!validatePassword(password)) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data?.error || "Signup failed");
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
          Create Account
        </h1>

        <form onSubmit={handleSignup} style={{ display: "grid", gap: 16 }}>
          <div>
            <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
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
              onChange={(e) => {
                setPassword(e.target.value);
                if (e.target.value) validatePassword(e.target.value);
              }}
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
            {passwordError && (
              <p style={{ marginTop: 6, fontSize: 12, color: "#fca5a5" }}>{passwordError}</p>
            )}
          </div>

          {error && (
            <div style={{ padding: 12, backgroundColor: "#7f1d1d", borderRadius: 6, color: "#fca5a5" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !!passwordError}
            style={{
              padding: "12px 16px",
              fontSize: 14,
              fontWeight: 600,
              backgroundColor: "#10b981",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              cursor: loading || passwordError ? "not-allowed" : "pointer",
              opacity: loading || passwordError ? 0.6 : 1,
            }}
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p style={{ marginTop: 20, textAlign: "center", color: "#888", fontSize: 14 }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "#10b981", textDecoration: "none" }}>
            Login
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
