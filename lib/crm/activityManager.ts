import { supabaseServer } from "@/lib/supabaseServer";

export type ActivityType =
  | "call"
  | "email"
  | "meeting"
  | "followup"
  | "proposal"
  | "interview"
  | "note";

export interface Activity {
  id?: string;
  deal_id: string;
  type: ActivityType;
  note: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

/**
 * Create an activity log entry
 */
export async function logActivity(data: Activity): Promise<Activity | null> {
  try {
    const { data: activity, error } = await supabaseServer
      .from("activities")
      .insert([data])
      .select()
      .single();

    if (error) {
      console.error("[activityManager] Error logging activity:", error);
      return null;
    }

    return activity;
  } catch (err) {
    console.error("[activityManager] Unexpected error:", err);
    return null;
  }
}

/**
 * Get activities for a deal
 */
export async function getDealActivities(dealId: string): Promise<Activity[]> {
  try {
    const { data, error } = await supabaseServer
      .from("activities")
      .select("*")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[activityManager] Error fetching activities:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("[activityManager] Unexpected error:", err);
    return [];
  }
}

/**
 * Get recent activities across all deals
 */
export async function getRecentActivities(limit: number = 50): Promise<Activity[]> {
  try {
    const { data, error } = await supabaseServer
      .from("activities")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[activityManager] Error fetching recent activities:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("[activityManager] Unexpected error:", err);
    return [];
  }
}
