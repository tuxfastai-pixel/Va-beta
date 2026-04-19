import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { sendNotification } from "../notifications/email.ts";
import { enqueueApplicationJob } from "../queues/applicationQueue.ts";
import { enqueueEngineeringTask } from "@/lib/engineering/enqueueEngineeringTask";

loadEnv({ path: ".env.local" });

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type JobInput = {
  id?: string | number;
  title?: string;
  company_name?: string;
  company?: string;
  description?: string;
  scam_risk?: number | string;
  capability_score?: number;
  [key: string]: unknown;
};

function normalizeScamRisk(value: unknown): "low" | "medium" | "high" {
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (normalized === "low" || normalized === "medium" || normalized === "high") {
      return normalized;
    }
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "medium";
  }

  if (numeric < 0.3) {
    return "low";
  }

  if (numeric < 0.6) {
    return "medium";
  }

  return "high";
}

export async function jobMatcherAgent(userId: string, resume: string, job: JobInput, profile: string) {
  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content:
          "You are an AI recruiter scoring job fit.",
      },
      {
        role: "user",
        content: `
Resume:
${resume}

Job:
${job.description}

Return:

MatchScore:
Strengths:
MissingSkills:
Recommendation:
`,
      },
    ],
  });

  const result = completion.choices[0].message.content || "";

  const matchScore =
    parseInt(result.match(/MatchScore:\s*(\d+)/)?.[1] || "0", 10);

  const capabilityScore = Number(job.capability_score ?? matchScore);
  const match_score = matchScore;
  const scam_risk = normalizeScamRisk(job.scam_risk);

  await supabase.from("jobs").insert({
    user_id: userId,
    title: job.title,
    company: job.company_name,
    description: job.description,
    match_score: matchScore,
    strengths: result,
    missing_skills: result,
    recommendation: result,
  });

  const { data: user } = await supabase
    .from("users")
    .select("id, email, skills")
    .eq("id", userId)
    .single();

  if (capabilityScore > 80 && user) {
    await enqueueApplicationJob({
      userId: user.id,
      job,
      resume,
      profile,
    });
  }

  // Bootstrap mode: allow promotion at a lower bar when memory is sparse,
  // so the system can accumulate real signal before applying strict thresholds.
  const MIN_MEMORY = 20;
  const { count: memoryCount } = await supabase
    .from("ai_memory")
    .select("*", { count: "exact", head: true })
    .not("embedding", "is", null);
  const isBootstrap = (memoryCount ?? 0) < MIN_MEMORY;
  const semanticBoost = match_score / 100;

  if (
    match_score > 85 &&
    scam_risk === "low" &&
    (isBootstrap || semanticBoost > 0.75)
  ) {
    await enqueueEngineeringTask({
      goal: "Process a high-confidence low-risk job match",
      user_id: userId,
      job_id: String(job.id ?? ""),
      title: String(job.title ?? ""),
      company: String(job.company_name ?? ""),
      match_score,
      scam_risk,
    });
  }

  if (matchScore > 85 && user?.email) {
    await sendNotification(
      user.email,
      "High Match Job Found",
      `${job.title} at ${job.company}`
    );
  }

  return result;
}
