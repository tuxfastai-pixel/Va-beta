import { supabaseServer } from "@/lib/supabaseServer";

export async function generateSkillPlan(userId: string) {
  const { data: gaps, error } = await supabaseServer
    .from("job_matches")
    .select("missing_skills")
    .eq("user_id", userId)
    .not("missing_skills", "is", null);

  if (error) {
    throw new Error(`Failed to load skill gaps: ${error.message}`);
  }

  for (const row of gaps || []) {
    if (!row.missing_skills) continue;

    const { error: insertError } = await supabaseServer
      .from("skill_recommendations")
      .insert({
        user_id: userId,
        skill: row.missing_skills,
        priority: 1,
        source: "job_match",
      });

    if (insertError) {
      throw new Error(`Failed to insert skill recommendation: ${insertError.message}`);
    }
  }

  return { processed: (gaps || []).length };
}
