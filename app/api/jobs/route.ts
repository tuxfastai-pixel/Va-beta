import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { getOrSetCache } from "@/lib/cache/performanceCache";

loadEnv({ path: ".env.local" });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type JobRow = {
  quality_score?: number | string | null;
  scam_risk?: number | string | null;
  quality_reason?: string | null;
  [key: string]: unknown;
};

export async function GET() {
  const enriched = await getOrSetCache("job_queries:top_20", 60, async () => {
    const { data } = await supabase
      .from("jobs")
      .select("*")
      .order("match_score", { ascending: false })
      .limit(20);

    return (data || []).map((job: JobRow) => {
      const scamRiskValue = Number(job.scam_risk);
      const isNumericRisk = Number.isFinite(scamRiskValue);
      const isHighRisk = isNumericRisk
        ? scamRiskValue >= 0.6
        : String(job.scam_risk || "").toLowerCase() === "high";

      return {
        ...job,
        quality_score: Number(job.quality_score || 0),
        scam_risk: String(job.scam_risk || "unknown"),
        quality_reason: String(job.quality_reason || "No quality reason available."),
        decision: Number(job.quality_score || 0) >= 60 && !isHighRisk ? "Accepted" : "Rejected",
      };
    });
  });

  return Response.json(enriched);
}
