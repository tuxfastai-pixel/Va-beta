import { supabaseServer } from "@/lib/supabaseServer";

type JobMatch = {
  title?: string | null;
};

export async function generateCareerPlan(userId: string) {
  const { data: jobs, error } = await supabaseServer
    .from("job_matches")
    .select("title, match_score")
    .eq("user_id", userId)
    .order("match_score", { ascending: false })
    .limit(5);

  if (error) {
    throw new Error(`Failed to load job matches: ${error.message}`);
  }

  const rankedJobs = (jobs || []) as JobMatch[];

  return {
    focus: rankedJobs[0]?.title ?? null,
    strategy: "Focus on high-paying repeatable skills",
    next_steps: [
      "Apply to 5 jobs daily",
      "Improve missing skills",
      "Build portfolio from completed jobs",
    ],
  };
}
