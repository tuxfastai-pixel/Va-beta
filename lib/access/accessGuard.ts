import { supabaseServer } from "@/lib/supabaseServer";

export type AccessStatus = "pending" | "approved" | "rejected";

function isMissingAccessStatusColumn(error: { code?: string; message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  return error?.code === "42703" || message.includes("access_status") || message.includes("column");
}

async function hasLegacyUserAccess(userId: string): Promise<boolean> {
  const [{ data: user }, { data: profile }] = await Promise.all([
    supabaseServer.from("users").select("id").eq("id", userId).maybeSingle(),
    supabaseServer.from("profiles").select("id").eq("id", userId).maybeSingle(),
  ]);

  return Boolean(user?.id || profile?.id);
}

/**
 * Check if user has approved access
 * Throws error if not approved, allowing middleware to handle it
 */
export async function checkAccess(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseServer
      .from("users")
      .select("access_status")
      .eq("id", userId)
      .single();

    if (error) {
      if (isMissingAccessStatusColumn(error)) {
        const fallbackAccess = await hasLegacyUserAccess(userId);
        if (!fallbackAccess) {
          console.error("Access check fallback failed: no user/profile record found for legacy schema.");
        }
        return fallbackAccess;
      }

      console.error("Access check query error:", error);
      return false;
    }

    if (data?.access_status !== "approved") {
      return false;
    }

    return true;
  } catch (error) {
    console.error("Access check error:", error);
    return false;
  }
}

/**
 * Guard function for API routes
 * Returns error response if access not approved
 */
export function createAccessGuard() {
  return async (userId: string | undefined) => {
    if (!userId) {
      return {
        error: true,
        status: 401,
        message: "Unauthorized: User ID required",
      };
    }

    const hasAccess = await checkAccess(userId);

    if (!hasAccess) {
      return {
        error: true,
        status: 403,
        message: "Access denied: Your access request is pending approval or has been rejected. Contact support.",
      };
    }

    return { error: false };
  };
}

/**
 * Get user's current access status
 */
export async function getUserAccessStatus(userId: string): Promise<AccessStatus> {
  try {
    const { data } = await supabaseServer
      .from("users")
      .select("access_status")
      .eq("id", userId)
      .single();

    return (data?.access_status || "pending") as AccessStatus;
  } catch (error) {
    console.error("Error fetching access status:", error);
    return "pending";
  }
}

/**
 * Middleware helper for Next.js API routes
 * Use in your route handler to enforce access control
 *
 * Example:
 * export async function GET(req: Request) {
 *   const guardResult = await enforceAccess(userId);
 *   if (guardResult.error) {
 *     return NextResponse.json(guardResult, { status: guardResult.status });
 *   }
 *   // ... rest of handler
 * }
 */
export const enforceAccess = createAccessGuard();
