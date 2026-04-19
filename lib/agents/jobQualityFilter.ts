import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type JobCandidate = {
  id?: string | number | null;
  url?: string | null;
  title?: string | null;
  company?: string | null;
  company_name?: string | null;
  description?: string | null;
  salary?: string | number | null;
  pay_amount?: string | number | null;
  location?: string | null;
  country?: string | null;
};

type QualityResult = {
  quality_score: number;
  scam_risk: number;
  reason: string;
  salary_score: number;
  company_score: number;
  location_score: number;
  scam_risk_score: number;
  relevance_score: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function scoreFromRisk(risk: number) {
  return clamp((1 - risk) * 20, 0, 20);
}

function parseQualityResponse(content: string): QualityResult {
  const normalized = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/, "")
    .trim();

  const parsed = JSON.parse(normalized) as Partial<QualityResult> & {
    scam_risk?: number | string;
  };

  const salaryScore = clamp(Number(parsed.salary_score ?? 0), 0, 20);
  const companyScore = clamp(Number(parsed.company_score ?? 0), 0, 20);
  const locationScore = clamp(Number(parsed.location_score ?? 0), 0, 20);
  const relevanceScore = clamp(Number(parsed.relevance_score ?? 0), 0, 20);
  const scamRisk = clamp(Number(parsed.scam_risk ?? 0.5), 0, 1);
  const scamRiskScore = clamp(Number(parsed.scam_risk_score ?? scoreFromRisk(scamRisk)), 0, 20);
  const qualityScore = clamp(
    salaryScore + companyScore + locationScore + scamRiskScore + relevanceScore,
    0,
    100
  );

  return {
    quality_score: qualityScore,
    scam_risk: scamRisk,
    reason: String(parsed.reason ?? "No reason provided."),
    salary_score: salaryScore,
    company_score: companyScore,
    location_score: locationScore,
    scam_risk_score: scamRiskScore,
    relevance_score: relevanceScore,
  };
}

export async function filterJob(job: JobCandidate): Promise<QualityResult> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "You detect scams and low quality job posts and return scoring components.",
        },
        {
          role: "user",
          content: `Evaluate this job listing.\n\nTitle: ${job.title || ""}\nCompany: ${job.company || job.company_name || ""}\nDescription: ${job.description || ""}\nPay: ${job.salary || job.pay_amount || ""}\nLocation: ${job.location || job.country || ""}\n\nReturn JSON only with:\n{\n salary_score: number (0-20),\n company_score: number (0-20),\n location_score: number (0-20),\n scam_risk: number (0-1),\n scam_risk_score: number (0-20),\n relevance_score: number (0-20),\n reason: string\n}`,
        },
      ],
    });

    const content = response.choices[0].message.content || "{}";
    return parseQualityResponse(content);
  } catch (error) {
    console.warn("Quality filter fallback:", error);
    return {
      quality_score: 0,
      scam_risk: 1,
      reason: "Quality filter failed; defaulting to high risk.",
      salary_score: 0,
      company_score: 0,
      location_score: 0,
      scam_risk_score: 0,
      relevance_score: 0,
    };
  }
}

export async function saveQuality(jobId: string, quality: QualityResult) {
  if (!jobId) {
    return;
  }

  const { error } = await supabase
    .from("jobs")
    .update({
      quality_score: quality.quality_score,
      scam_risk: quality.scam_risk.toFixed(2),
      quality_reason: quality.reason,
    })
    .eq("id", jobId);

  if (error) {
    console.warn(`Unable to save quality for job ${jobId}:`, error.message);
  }
}
