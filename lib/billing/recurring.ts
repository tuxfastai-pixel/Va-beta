import { supabaseServer } from "@/lib/supabaseServer";
import { createInvoice } from "@/lib/invoices/generator";

export type BillingInterval = "weekly" | "monthly" | "quarterly" | "yearly";

export interface Subscription {
  id?: string;
  client_id: string;
  amount: number;
  interval?: BillingInterval;
  next_billing_date: Date;
  status?: "active" | "paused" | "cancelled";
  created_at?: string;
  updated_at?: string;
}

/**
 * Create a subscription for recurring billing
 */
export async function createSubscription(data: Subscription): Promise<Subscription | null> {
  try {
    const interval = data.interval || "monthly";
    const status = data.status || "active";

    const { data: subscription, error } = await supabaseServer
      .from("subscriptions")
      .insert([
        {
          ...data,
          interval,
          status,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("[billingManager] Error creating subscription:", error);
      return null;
    }

    return subscription;
  } catch (err) {
    console.error("[billingManager] Unexpected error:", err);
    return null;
  }
}

/**
 * Get subscription by ID
 */
export async function getSubscription(subscriptionId: string): Promise<Subscription | null> {
  try {
    const { data, error } = await supabaseServer
      .from("subscriptions")
      .select("*")
      .eq("id", subscriptionId)
      .single();

    if (error) {
      console.error("[billingManager] Error fetching subscription:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[billingManager] Unexpected error:", err);
    return null;
  }
}

/**
 * Get active subscriptions for a client
 */
export async function getClientSubscriptions(clientId: string): Promise<Subscription[]> {
  try {
    const { data, error } = await supabaseServer
      .from("subscriptions")
      .select("*")
      .eq("client_id", clientId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[billingManager] Error fetching subscriptions:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("[billingManager] Unexpected error:", err);
    return [];
  }
}

/**
 * Calculate next billing date based on interval
 */
function calculateNextBillingDate(currentDate: Date, interval: BillingInterval): Date {
  const next = new Date(currentDate);

  switch (interval) {
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "quarterly":
      next.setMonth(next.getMonth() + 3);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1); // default monthly
  }

  return next;
}

/**
 * Process recurring billing
 * Call this from orchestrator once daily (or as needed)
 * Checks for subscriptions with next_billing_date <= now and creates invoices
 */
export async function processRecurringBilling(): Promise<{
  processed: number;
  invoicesCreated: number;
  errors: number;
}> {
  try {
    const now = new Date();

    // Get all active subscriptions due for billing
    const { data: subscriptions, error } = await supabaseServer
      .from("subscriptions")
      .select("*")
      .eq("status", "active")
      .lte("next_billing_date", now.toISOString());

    if (error) {
      console.error("[billingManager] Error fetching due subscriptions:", error);
      return { processed: 0, invoicesCreated: 0, errors: 0 };
    }

    if (!subscriptions || subscriptions.length === 0) {
      return { processed: 0, invoicesCreated: 0, errors: 0 };
    }

    let invoicesCreated = 0;
    let errors = 0;

    for (const sub of subscriptions) {
      try {
        // We need to find or create a deal for this subscription
        // For now, we'll create an invoice with the subscription amount
        // In production, you might want to link this to existing deals

        const interval = sub.interval || "monthly";
        const dueDate = calculateNextBillingDate(now, interval);

        // Create invoice
        const invoice = await createInvoice(
          sub.client_id, // Using client_id as placeholder for deal_id
          sub.amount,
          dueDate,
          `Recurring billing - ${interval}`
        );

        if (invoice) {
          invoicesCreated++;

          // Update subscription's next billing date
          const nextBilling = calculateNextBillingDate(now, interval);

          const { error: updateError } = await supabaseServer
            .from("subscriptions")
            .update({
              next_billing_date: nextBilling.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", sub.id);

          if (updateError) {
            console.error("[billingManager] Error updating subscription:", updateError);
            errors++;
          }
        }
      } catch (err) {
        console.error("[billingManager] Error processing subscription:", err);
        errors++;
      }
    }

    return {
      processed: subscriptions.length,
      invoicesCreated,
      errors,
    };
  } catch (err) {
    console.error("[billingManager] Unexpected error:", err);
    return { processed: 0, invoicesCreated: 0, errors: 1 };
  }
}

/**
 * Pause a subscription
 */
export async function pauseSubscription(subscriptionId: string): Promise<Subscription | null> {
  try {
    const { data, error } = await supabaseServer
      .from("subscriptions")
      .update({
        status: "paused",
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscriptionId)
      .select()
      .single();

    if (error) {
      console.error("[billingManager] Error pausing subscription:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[billingManager] Unexpected error:", err);
    return null;
  }
}

/**
 * Resume a paused subscription
 */
export async function resumeSubscription(subscriptionId: string): Promise<Subscription | null> {
  try {
    const { data, error } = await supabaseServer
      .from("subscriptions")
      .update({
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscriptionId)
      .select()
      .single();

    if (error) {
      console.error("[billingManager] Error resuming subscription:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[billingManager] Unexpected error:", err);
    return null;
  }
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string): Promise<Subscription | null> {
  try {
    const { data, error } = await supabaseServer
      .from("subscriptions")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscriptionId)
      .select()
      .single();

    if (error) {
      console.error("[billingManager] Error cancelling subscription:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[billingManager] Unexpected error:", err);
    return null;
  }
}
