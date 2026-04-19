import { supabaseServer } from "@/lib/supabaseServer";

export interface FunnelEventData {
  user_id?: string;
  email?: string;
  step: "landing_view" | "form_submit" | "lead_created" | "outreach_sent" | "subscription_created" | "ad_click" | string;
  metadata?: Record<string, unknown>;
}

/**
 * Track a funnel event for conversion analysis
 */
export async function trackFunnelEvent(
  data: FunnelEventData
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseServer
      .from("funnel_events")
      .insert({
        user_id: data.user_id,
        email: data.email,
        step: data.step,
        metadata: data.metadata || {},
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error(`Funnel tracking error: ${error.message}`);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Funnel tracking exception: ${message}`);
    return { success: false, error: message };
  }
}

export async function trackAdClick(userId: string) {
  return trackFunnelEvent({
    user_id: userId,
    step: "ad_click",
  });
}

/**
 * Get conversion funnel metrics
 */
export async function getFunnelMetrics() {
  try {
    const { data, error } = await supabaseServer
      .from("funnel_conversion_rates")
      .select("*");

    if (error) {
      console.error(`Error fetching funnel metrics: ${error.message}`);
      return { success: false, metrics: null, error: error.message };
    }

    return {
      success: true,
      metrics: data,
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, metrics: null, error: message };
  }
}

/**
 * Get funnel events for specific step
 */
export async function getFunnelEventsForStep(
  step: string,
  limit: number = 100
) {
  try {
    const { data, error } = await supabaseServer
      .from("funnel_events")
      .select("*")
      .eq("step", step)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return { success: false, events: null, error: error.message };
    }

    return { success: true, events: data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, events: null, error: message };
  }
}

/**
 * Get funnel events for a specific user/email
 */
export async function getUserFunnelPath(email: string) {
  try {
    const { data, error } = await supabaseServer
      .from("funnel_events")
      .select("*")
      .eq("email", email)
      .order("created_at", { ascending: true });

    if (error) {
      return { success: false, path: null, error: error.message };
    }

    return { success: true, path: data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, path: null, error: message };
  }
}
