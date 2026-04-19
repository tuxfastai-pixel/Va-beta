import { supabaseServer } from "@/lib/supabaseServer";
import { upsertTrustScore } from "@/lib/users/trust";

export async function updateReputation(userId: string, success: boolean) {
  const delta = success ? 5 : -2;

  const { data: existing, error: existingError } = await supabaseServer
    .from("user_reputation")
    .select("id, score, reputation_score, jobs_completed")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load reputation for ${userId}: ${existingError.message}`);
  }

  if (!existing) {
    const startingScore = 50 + delta;
    const { error: insertError } = await supabaseServer
      .from("user_reputation")
      .insert({
        user_id: userId,
        score: startingScore,
        reputation_score: startingScore,
        jobs_completed: 1,
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      throw new Error(`Failed to create reputation row for ${userId}: ${insertError.message}`);
    }

    await upsertTrustScore(userId, {
      jobs_completed: 1,
      success_rate: success ? 1 : 0,
    });

    return;
  }

  const currentScore = Number(existing.score ?? existing.reputation_score ?? 50);
  const jobsCompleted = Number(existing.jobs_completed || 0) + 1;
  const nextScore = currentScore + delta;

  const { error: updateError } = await supabaseServer
    .from("user_reputation")
    .update({
      score: nextScore,
      reputation_score: nextScore,
      jobs_completed: jobsCompleted,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (updateError) {
    throw new Error(`Failed to update reputation for ${userId}: ${updateError.message}`);
  }

  await upsertTrustScore(userId, {
    jobs_completed: jobsCompleted,
    success_rate: success ? 1 : 0,
  });
}
