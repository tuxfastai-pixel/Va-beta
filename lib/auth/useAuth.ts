import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Simple check: if session cookie exists, user is logged in
    // In production, verify token server-side
    const checkAuth = async () => {
      try {
        // Try to fetch protected resource to verify session
        const res = await fetch("/api/auth/me", { credentials: "include" });

        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else if (res.status === 401) {
          // Not authenticated, redirect to login
          router.push("/login");
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      setUser(null);
      router.push("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return { user, loading, logout };
}

/**
 * Server-side auth check (use in API routes)
 */
export async function verifyAuth(req: Request) {
  const cookieHeader = req.headers.get("cookie") || "";
  const sessionMatch = cookieHeader.match(/session=([^;]+)/);

  if (!sessionMatch) {
    return null;
  }

  // In production, verify JWT signature here
  // For now, just check if session exists
  return { authenticated: true };
}
