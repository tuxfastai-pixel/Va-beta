import { supabaseServer } from "@/lib/supabaseServer";
import { getScoreTier, getUserClientIds, rescoreAllClients, updateClientScore } from "@/lib/clients/clientScoring";
import {
  generateRetainerPitch,
  generateUpsellMessage,
  generateReEngagementMessage,
} from "@/lib/retainer/retainerEngine";
import { sendNotification } from "@/lib/notifications/email";

type ClientRow = {
  id: string;
  user_id?: string;
  name?: string;
  email?: string;
  score: number;
  score_tier: string;
  is_retainer: boolean;
  last_interaction?: string | null;
  message_count: number;
  lifetime_value: number;
  monthly_retainer_value?: number;
};

/**
 * How many days have passed since a timestamp
 */
function daysSince(ts: string | null | undefined): number {
  if (!ts) return 999;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86_400_000);
}

/**
 * Log an interaction so we won't spam the same client twice in a short period
 */
async function logInteraction(
  client: ClientRow,
  userId: string,
  type: string,
  message: string
): Promise<void> {
  await supabaseServer.from("client_interactions").insert({
    client_id: client.id,
    user_id: userId,
    interaction_type: type,
    message,
    sent_at: new Date().toISOString(),
  });

  await supabaseServer
    .from("clients")
    .update({
      last_interaction: new Date().toISOString(),
      message_count: (client.message_count ?? 0) + 1,
    })
    .eq("id", client.id);

  client.message_count = (client.message_count ?? 0) + 1;
}

async function createClientNotification(
  client: ClientRow,
  type: string,
  title: string,
  message: string,
  priority: "low" | "normal" | "high" = "normal"
): Promise<void> {
  await supabaseServer.from("client_notifications").insert({
    client_id: client.id,
    notification_type: type,
    priority,
    title,
    message,
    payload: {
      source: "account_manager",
      score: client.score,
      tier: client.score_tier,
    },
  });
}

/**
 * Check if we have already sent this interaction type to the client recently
 */
async function recentlyContacted(clientId: string, type: string, withinDays = 7): Promise<boolean> {
  const since = new Date(Date.now() - withinDays * 86_400_000).toISOString();
  const { data } = await supabaseServer
    .from("client_interactions")
    .select("id")
    .eq("client_id", clientId)
    .eq("interaction_type", type)
    .gte("sent_at", since)
    .limit(1);

  return !!(data && data.length > 0);
}

/**
 * Send message to client via email notification
 * Fails gracefully if email not configured
 */
async function sendMessageToClient(
  client: ClientRow,
  type: string,
  title: string,
  message: string,
  priority: "low" | "normal" | "high" = "normal"
): Promise<boolean> {
  await createClientNotification(client, type, title, message, priority);

  if (!client.email) {
    console.warn(`Account manager: no email for client ${client.id}, saved in-app notification only`);
    return true;
  }

  try {
    await sendNotification(client.email, title, message);
  } catch (err) {
    console.error(`Failed to send message to ${client.email}:`, err);
  }

  return true;
}

// ── Handlers per tier ──────────────────────────────────────────────────────────

async function handleVIPClient(client: ClientRow, userId: string): Promise<boolean> {
  // Retainer pitch if not already on retainer
  if (!client.is_retainer) {
    const alreadySent = await recentlyContacted(client.id, "retainer_pitch", 14);
    if (!alreadySent) {
      const pitch = generateRetainerPitch(client.name);
      await sendMessageToClient(client, "retainer_pitch", "Retainer support option", pitch, "high");
      await logInteraction(client, userId, "retainer_pitch", pitch);
      console.log(`💌 Retainer pitch sent to VIP client ${client.name || client.id}`);
      return true;
    }
  }

  // Regular VIP check-in (weekly)
  const alreadyCheckedIn = await recentlyContacted(client.id, "checkin", 7);
  if (!alreadyCheckedIn) {
    const msg = `Hi ${client.name || "there"},\n\nJust checking in — I'm here if you need anything or if there's something new I can help with. Happy to jump on any tasks when you're ready 👍`;
    await sendMessageToClient(client, "checkin", "Checking in", msg);
    await logInteraction(client, userId, "checkin", msg);
    console.log(`📬 VIP check-in sent to ${client.name || client.id}`);
    return true;
  }

  return false;
}

async function handleGrowthClient(client: ClientRow, userId: string): Promise<boolean> {
  // Check-in every 5 days
  const alreadyContacted = await recentlyContacted(client.id, "checkin", 5);
  if (!alreadyContacted) {
    const msg = `Hi ${client.name || "there"},\n\nJust checking in — I'm available if you need help with anything new or want to speed up ongoing work.`;
    await sendMessageToClient(client, "checkin", "Checking in", msg);
    await logInteraction(client, userId, "checkin", msg);
    console.log(`📬 Growth check-in sent to ${client.name || client.id}`);
    return true;
  }

  // Upsell attempt (once per 14 days)
  const alreadyUpsold = await recentlyContacted(client.id, "upsell", 14);
  if (!alreadyUpsold) {
    const msg = generateUpsellMessage(client.name);
    await sendMessageToClient(client, "upsell", "More support available", msg);
    await logInteraction(client, userId, "upsell", msg);
    console.log(`📈 Upsell sent to ${client.name || client.id}`);
    return true;
  }

  return false;
}

async function handleLowClient(client: ClientRow, userId: string): Promise<boolean> {
  // Only reach out if dormant for 7+ days
  if (daysSince(client.last_interaction) < 7) return false;

  const alreadyContacted = await recentlyContacted(client.id, "followup", 14);
  if (!alreadyContacted) {
    const msg = generateReEngagementMessage(client.name);
    await sendMessageToClient(client, "followup", "Checking back in", msg, "low");
    await logInteraction(client, userId, "followup", msg);
    console.log(`💤 Re-engagement sent to low client ${client.name || client.id}`);
    return true;
  }

  return false;
}

// ── Main runner ────────────────────────────────────────────────────────────────

/**
 * Run the full account management cycle for a user.
 * Called daily from the autonomous executor.
 */
export async function runAccountManager(userId: string): Promise<{
  clientsProcessed: number;
  messagesSent: number;
}> {
  // Step 1: Rescore all clients
  await rescoreAllClients(userId);

  // Step 2: Fetch clients linked to this user
  const clientIds = await getUserClientIds(userId);
  if (!clientIds.length) {
    return { clientsProcessed: 0, messagesSent: 0 };
  }

  const { data: clients, error } = await supabaseServer
    .from("clients")
    .select("id, name, email, last_interaction, message_count")
    .in("id", clientIds);

  if (error || !clients) {
    console.error("Account manager: failed to fetch clients", error?.message);
    return { clientsProcessed: 0, messagesSent: 0 };
  }

  let messagesSent = 0;

  for (const rawClient of clients as Array<Partial<ClientRow> & { id: string }>) {
    const scoreResult = await updateClientScore(rawClient.id);
    const client: ClientRow = {
      id: rawClient.id,
      user_id: rawClient.user_id,
      name: rawClient.name,
      email: rawClient.email,
      score: scoreResult?.score ?? Number(rawClient.score || 0),
      score_tier: scoreResult?.tier ?? String(rawClient.score_tier || "low"),
      is_retainer: Boolean(rawClient.is_retainer),
      last_interaction: rawClient.last_interaction ?? null,
      message_count: Number(rawClient.message_count || 0),
      lifetime_value: Number(rawClient.lifetime_value || 0),
      monthly_retainer_value: Number(rawClient.monthly_retainer_value || 0),
    };
    const tier = scoreResult?.tier ?? getScoreTier(client.score);

    try {
      if (tier === "vip") {
        if (await handleVIPClient(client, userId)) {
          messagesSent++;
        }
      } else if (tier === "high") {
        if (await handleGrowthClient(client, userId)) {
          messagesSent++;
        }
      } else if (tier === "medium") {
        // Medium clients — upsell attempt only
        const alreadyUpsold = await recentlyContacted(client.id, "upsell", 10);
        if (!alreadyUpsold) {
          const msg = generateUpsellMessage(client.name);
          await sendMessageToClient(client, "upsell", "More support available", msg);
          await logInteraction(client, userId, "upsell", msg);
          messagesSent++;
        }
      } else {
        if (await handleLowClient(client, userId)) {
          messagesSent++;
        }
      }
    } catch (err) {
      console.error(`Account manager error for client ${client.id}:`, err);
    }
  }

  console.log(`✅ Account manager cycle complete: ${clients.length} clients, ${messagesSent} messages sent`);
  return { clientsProcessed: clients.length, messagesSent };
}
