import { supabaseServer } from "@/lib/supabaseServer";

type TrackEarningsOptions = {
  source?: string;
  aiUsed?: boolean;
  platform?: string;
  currency?: string;
  status?: string;
};

export function calculateSplit(amount: number, aiUsed: boolean) {
  const safeAmount = Number(amount || 0);

  if (!aiUsed) {
    return { user: safeAmount, platform: 0 };
  }

  return {
    user: safeAmount * 0.7,
    platform: safeAmount * 0.3,
  };
}

export function buildTransparentEarningsSummary(rows: Array<{ amount?: number | null; ai_assisted?: boolean | null }>) {
  let totalEarned = 0;
  let aiGenerated = 0;
  let userGenerated = 0;
  let platformCut = 0;

  for (const row of rows) {
    const amount = Number(row.amount || 0);
    totalEarned += amount;

    if (row.ai_assisted === false) {
      userGenerated += amount;
      continue;
    }

    aiGenerated += amount;
    platformCut += calculateSplit(amount, true).platform;
  }

  return {
    total_earned: Math.round(totalEarned * 100) / 100,
    ai_generated: Math.round(aiGenerated * 100) / 100,
    user_generated: Math.round(userGenerated * 100) / 100,
    platform_cut: Math.round(platformCut * 100) / 100,
    user_receives: Math.round((totalEarned - platformCut) * 100) / 100,
  };
}

function isLegacyEarningsColumnError(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  return ["ai_assisted", "platform", "currency", "status"].some((column) => message.includes(column));
}

export async function trackEarnings(userId: string, amount: number, source: string = "job", options: TrackEarningsOptions = {}) {
  const effectiveSource = options.source ?? source;
  const payload = {
    user_id: userId,
    amount,
    source: effectiveSource,
    ai_assisted: options.aiUsed ?? true,
    platform: options.platform ?? null,
    currency: options.currency ?? "USD",
    status: options.status ?? "recorded",
    created_at: new Date().toISOString(),
  };

  let { error } = await supabaseServer
    .from("earnings")
    .insert(payload);

  if (error && isLegacyEarningsColumnError(error)) {
    ({ error } = await supabaseServer
      .from("earnings")
      .insert({
        user_id: userId,
        amount,
        source: effectiveSource,
        created_at: new Date().toISOString(),
      }));
  }

  if (error) {
    throw new Error(`Failed to track earnings for ${userId}: ${error.message}`);
  }

  return {
    split: calculateSplit(amount, options.aiUsed ?? true),
    userId,
    amount,
    source: effectiveSource,
  };
}
