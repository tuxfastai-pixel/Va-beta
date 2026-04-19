import { supabase } from "@/lib/supabase";
import { sendPaymentReminder } from "@/lib/notifications/reminders";
import { generateFollowUpMessage, type FollowUpStage } from "@/lib/payments/followUpEngine";

type PaymentRow = {
  id: string;
  user_id: string | null;
  client_id: string | null;
  payment_link: string | null;
  status: string | null;
  created_at: string | null;
  follow_up_stage: number | null;
};

function resolveFollowUpStage(hoursPassed: number): FollowUpStage | null {
  if (hoursPassed > 2 && hoursPassed <= 24) return 1;
  if (hoursPassed > 24 && hoursPassed <= 48) return 2;
  if (hoursPassed > 48) return 3;
  return null;
}

export async function runFollowUps() {
  const { data: pending, error } = await supabase
    .from("payments")
    .select("id, user_id, client_id, payment_link, status, created_at, follow_up_stage")
    .eq("status", "pending");

  if (error) {
    throw new Error(`Failed to load pending payments: ${error.message}`);
  }

  let processed = 0;
  let escalated = 0;
  let expired = 0;
  let remindersSent = 0;
  let remindersSkipped = 0;

  for (const payment of (pending || []) as PaymentRow[]) {
    if (!payment.payment_link) continue;

    const createdAt = Date.parse(String(payment.created_at || ""));
    if (Number.isNaN(createdAt)) continue;

    const hoursPassed = (Date.now() - createdAt) / (1000 * 60 * 60);
    const stage = resolveFollowUpStage(hoursPassed);
    if (!stage) continue;

    const previousStage = Number(payment.follow_up_stage || 0);
    if (stage <= previousStage) continue;

    const message = generateFollowUpMessage(stage, payment.payment_link);

    const messageInsert = await supabase.from("messages").insert({
      session_id: null,
      role: "assistant",
      content: `[payment_follow_up payment_id=${payment.id} stage=${stage}]\n\n${message}`,
      created_at: new Date().toISOString(),
    });

    if (messageInsert.error) {
      throw new Error(`Failed to insert follow-up message: ${messageInsert.error.message}`);
    }

    if (payment.client_id) {
      const { data: clientRow } = await supabase.from("clients").select("email").eq("id", payment.client_id).maybeSingle();
      const reminderResults = await sendPaymentReminder(
        {
          email: clientRow?.email || undefined,
        },
        payment.payment_link
      );

      for (const result of reminderResults) {
        if (result.ok) {
          remindersSent += 1;
        } else if (result.skipped) {
          remindersSkipped += 1;
        }
      }
    } else {
      remindersSkipped += 2;
    }

    const updatePatch: Record<string, unknown> = {
      follow_up_stage: stage,
      last_follow_up_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (stage === 3) {
      updatePatch.status = "expired";
      updatePatch.expired_at = new Date().toISOString();
      expired += 1;
    }

    const paymentUpdate = await supabase.from("payments").update(updatePatch).eq("id", payment.id);
    if (paymentUpdate.error) {
      throw new Error(`Failed to update payment follow-up stage: ${paymentUpdate.error.message}`);
    }

    processed += 1;
    escalated += 1;
  }

  return {
    processed,
    escalated,
    expired,
    remindersSent,
    remindersSkipped,
    pendingCount: (pending || []).length,
  };
}