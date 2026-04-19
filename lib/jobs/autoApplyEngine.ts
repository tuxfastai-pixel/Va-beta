import { addPremiumPositioning, calculatePremiumPrice } from "@/lib/pricing/profitEngine";
import { detectUserNiche } from "@/lib/profile/nicheDetector";
import { optimizeJobSelection } from "@/lib/revenue/revenueOptimizer";
import { supabaseServer } from "@/lib/supabaseServer";

type JobMatch = {
  id: string;
  title?: string | null;
  created_at?: string | null;
  description?: string | null;
  match_score?: number | null;
  quality_score?: number | null;
  pay_amount?: number | null;
  scam_risk?: string | null;
  profit_score?: number | null;
};

function expandNicheKeywords(niche: string): string[] {
  const base = niche.toLowerCase().trim();

  const aliasMap: Record<string, string[]> = {
    teaching: ["teaching", "teacher", "tutor", "education"],
    admin: ["admin", "assistant", "virtual assistant", "operations"],
    "admin-crm": ["admin", "crm", "sales", "pipeline", "assistant"],
    developer: ["developer", "engineering", "software", "web", "frontend", "backend"],
    legal: ["legal", "compliance", "contract"],
    finance: ["finance", "bookkeeping", "accounting"],
    crm: ["crm", "sales", "pipeline", "lead generation"],
    general: [],
  };

  return aliasMap[base] || [base];
}

export function generateEliteProposal(job: JobMatch) {
  return `
Hi,

I've reviewed your requirement around "${job.title}", and the core issue is likely related to execution efficiency and consistency - not just the task itself.

What I would do immediately:
- Identify the exact bottleneck (workflow / data / system issue)
- Implement a clean, reliable fix or structure
- Ensure it's repeatable so you don't face this again

For roles like this, speed and accuracy matter - I focus on delivering both without unnecessary back-and-forth.

I can start immediately and provide a working result quickly.

Let me know if you'd like me to proceed or outline the exact approach for your case.

Best
`;
}

export function legalProposal(job: JobMatch) {
  return `
Hi,

For "${job.title || "this role"}",

For legal/admin workflows like this, the biggest risk is inconsistency and lack of traceability.

I would approach this by:
- Structuring documents and records for easy retrieval
- Ensuring compliance checkpoints are clearly tracked
- Reducing manual errors through a more controlled workflow

This ensures accuracy, accountability, and long-term reliability.

I can start immediately and stabilize this process quickly.

Best
`;
}

export function crmProposal(job: JobMatch) {
  return `
Hi,

For "${job.title || "this role"}",

From experience, most CRM issues are not tool-related - they're process-related.

I would:
- Audit your current pipeline and identify drop-off points
- Clean and structure your CRM data
- Introduce simple automation to improve follow-ups and tracking

This usually results in immediate improvement in conversion and visibility.

I can start right away and implement this efficiently.

Best
`;
}

export function financeProposal(job: JobMatch) {
  return `
Hi,

For "${job.title || "this role"}",

Accuracy and consistency are critical in financial/admin work.

My approach:
- Validate and clean existing records
- Ensure proper structure for tracking and reporting
- Implement a workflow that minimizes future discrepancies

This keeps your data reliable and decision-ready.

I can begin immediately and deliver quickly.

Best
`;
}

export function detectNiche(job: JobMatch) {
  const text = `${job.title || ""} ${job.description || ""}`.toLowerCase();

  if (text.includes("legal") || text.includes("compliance")) return "legal";
  if (text.includes("crm") || text.includes("pipeline")) return "crm";
  if (text.includes("finance") || text.includes("bookkeeping")) return "finance";

  return "general";
}

export function generateSmartProposal(job: JobMatch) {
  const niche = detectNiche(job);

  if (niche === "legal") return addPremiumPositioning(legalProposal(job));
  if (niche === "crm") return addPremiumPositioning(crmProposal(job));
  if (niche === "finance") return addPremiumPositioning(financeProposal(job));

  return addPremiumPositioning(generateEliteProposal(job));
}

export function generateProposal(job: JobMatch) {
  return generateSmartProposal(job);
}

export function generateSmartOffer(job: JobMatch) {
  return {
    price: calculatePremiumPrice(job),
    proposal: generateSmartProposal(job),
  };
}

export function exportProposal(job: JobMatch) {
  const offer = generateSmartOffer(job);

  return {
    title: job.title ?? "Untitled",
    proposal: offer.proposal,
    suggestedPrice: offer.price,
  };
}

export async function autoApplyToJobs(userId: string) {
  const { data: user } = await supabaseServer
    .from("users")
    .select("skills")
    .eq("id", userId)
    .maybeSingle();

  const detectedNiches = detectUserNiche({ skills: user?.skills });
  const nicheKeywords = Array.from(
    new Set(
      detectedNiches
        .flatMap(expandNicheKeywords)
        .map((keyword) => keyword.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  let query = supabaseServer
    .from("job_matches")
    .select("id, title, created_at, description, match_score, quality_score, pay_amount, profit_score, scam_risk")
    .eq("user_id", userId)
    .gt("match_score", 70)
    .eq("scam_risk", "low");

  if (nicheKeywords.length > 0) {
    const dynamicFilter = nicheKeywords
      .flatMap((keyword) => [`title.ilike.%${keyword}%`, `description.ilike.%${keyword}%`])
      .join(",");

    query = query.or(dynamicFilter);
  }

  const { data: jobs, error } = await query
    .order("pay_amount", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Failed to load profitable jobs: ${error.message}`);
  }

  const applications: Array<{ job_id: string; proposal: string }> = [];
  const optimizedJobs = optimizeJobSelection((jobs || []) as JobMatch[]);
  const topJobs = optimizedJobs
    .filter((job) => job.profit_score >= 60)
    .slice(0, 10);

  const columnPreference: Array<"job_id" | "job_match_id"> = ["job_id", "job_match_id"];

  for (const job of topJobs) {
    const offer = generateSmartOffer(job);
    const proposal = offer.proposal;

    let applied = false;
    let lastErrorMessage = "";

    for (const relationColumn of columnPreference) {
      const { data: existing, error: existingError } = await supabaseServer
        .from("job_applications")
        .select("id")
        .eq(relationColumn, job.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingError) {
        if (existingError.message.includes(relationColumn) || existingError.message.includes("Could not find")) {
          lastErrorMessage = existingError.message;
          continue;
        }

        throw new Error(`Failed to check existing application for ${job.id}: ${existingError.message}`);
      }

      if (existing) {
        applied = true;
        break;
      }

      const { error: insertError } = await supabaseServer
        .from("job_applications")
        .insert({
          [relationColumn]: job.id,
          user_id: userId,
          proposal,
        });

      if (insertError) {
        if (insertError.message.includes(relationColumn) || insertError.message.includes("Could not find")) {
          lastErrorMessage = insertError.message;
          continue;
        }

        throw new Error(`Failed to apply to job ${job.id}: ${insertError.message}`);
      }

      applied = true;
      break;
    }

    const schemaDriftError =
      lastErrorMessage.includes("Could not find") || lastErrorMessage.includes("does not exist");

    if (!applied && schemaDriftError) {
      const safeTitle = String(job.title || "Untitled");

      const { data: existingLegacy, error: legacyCheckError } = await supabaseServer
        .from("job_applications")
        .select("id")
        .eq("user_id", userId)
        .eq("job_title", safeTitle)
        .maybeSingle();

      if (!legacyCheckError && !existingLegacy) {
        const { error: legacyInsertError } = await supabaseServer
          .from("job_applications")
          .insert({
            user_id: userId,
            job_title: safeTitle,
            company: null,
            status: "applied",
          });

        if (!legacyInsertError) {
          applied = true;
        }
      }
    }

    if (!applied && lastErrorMessage && !schemaDriftError) {
      throw new Error(`Failed to apply to job ${job.id}: ${lastErrorMessage}`);
    }

    if (!applied) {
      continue;
    }

    applications.push({ job_id: String(job.id), proposal });
  }

  return applications;
}
