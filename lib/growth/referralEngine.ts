import { supabaseServer } from "@/lib/supabaseServer";

export function generateReferralMessage() {
  return `
We’ve been using an AI system that executes tasks automatically.

If you want access, I can refer you — they give priority onboarding.

Let me know.
`;
}

export async function createReferral(input: {
  referrerUserId: string;
  referredEmail: string;
  rewardType?: "free_month" | "recurring_revenue";
}) {
  const rewardType = input.rewardType || "free_month";

  const { data, error } = await supabaseServer
    .from("referrals")
    .insert({
      referrer_user_id: input.referrerUserId,
      referred_email: input.referredEmail,
      reward_type: rewardType,
      reward_value: rewardType === "free_month" ? 1 : 0,
      recurring_commission_rate: rewardType === "recurring_revenue" ? 0.1 : 0,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create referral: ${error.message}`);
  }

  return data;
}

export async function markReferralConverted(referredEmail: string, referredClientId: string) {
  const { error } = await supabaseServer
    .from("referrals")
    .update({
      referred_client_id: referredClientId,
      status: "converted",
      converted_at: new Date().toISOString(),
    })
    .eq("referred_email", referredEmail)
    .eq("status", "pending");

  if (error) {
    throw new Error(`Failed to mark referral converted: ${error.message}`);
  }
}

export async function getReferralStats(referrerUserId: string) {
  const { data, error } = await supabaseServer
    .from("referrals")
    .select("status")
    .eq("referrer_user_id", referrerUserId);

  if (error) {
    throw new Error(`Failed to load referral stats: ${error.message}`);
  }

  const total = data.length;
  const converted = data.filter((r) => r.status === "converted").length;
  const conversionRate = total > 0 ? converted / total : 0;

  return {
    total,
    converted,
    conversionRate,
    loop: "user -> customer -> promoter -> lead source",
  };
}
