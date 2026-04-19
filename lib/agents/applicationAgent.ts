import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { generateWinningProposal, highConversionProposal, suggestProposalTone } from "@/lib/jobs/winningProposal";

loadEnv({ path: ".env.local" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type JobInput = {
  id: string;
  title?: string | null;
  description?: string | null;
  company?: string | null;
  recommendation?: string | null;
  base_price?: number | string | null;
  pay_amount?: number | string | null;
  demand_factor?: number | string | null;
  complexity_factor?: number | string | null;
  demand_score?: number | string | null;
  complexity_score?: number | string | null;
  match_score?: number | string | null;
  quality_score?: number | string | null;
  currency?: string | null;
};

type UserInput = {
  id: string;
  email?: string | null;
  skills?: string | string[] | null;
};

function toNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeFactor(raw: unknown): number {
  const numeric = toNumber(raw, 0);
  if (numeric > 1) {
    return clamp(numeric / 100, 0, 1);
  }

  return clamp(numeric, 0, 1);
}

// calculateDynamicPrice uses match_score + quality_score (AI-derived signals)
export function calculateDynamicPrice(job: JobInput): number {
  const base = toNumber(job.pay_amount, 50);
  const demandBoost = toNumber(job.match_score, 0) / 100;
  const complexityBoost = toNumber(job.quality_score, 0) / 100;
  return Number((base * (1 + demandBoost + complexityBoost)).toFixed(2));
}

// generateProposalTemplate returns a quick, human-readable proposal without GPT
export function generateProposalTemplate(job: JobInput): string {
  return highConversionProposal(job, {}, suggestProposalTone(job));
}

function calculateProposalPrice(job: JobInput): { price: number; basePrice: number; demandFactor: number; complexityFactor: number } {
  const basePrice = Math.max(1, toNumber(job.base_price ?? job.pay_amount, 50));
  const demandFactor = normalizeFactor(job.demand_factor ?? job.demand_score ?? 0.15);
  const complexityFactor = normalizeFactor(job.complexity_factor ?? job.complexity_score ?? 0.1);
  const price = Number((basePrice * (1 + demandFactor + complexityFactor)).toFixed(2));

  return { price, basePrice, demandFactor, complexityFactor };
}

export async function generateProposal(job: JobInput, user: UserInput) {
  const { price, basePrice, demandFactor, complexityFactor } = calculateProposalPrice(job);
  const skillsText = Array.isArray(user.skills) ? user.skills.join(", ") : String(user.skills || "");
  const seedProposal = await generateWinningProposal(job, user, suggestProposalTone(job));

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: "You write professional freelance proposals.",
      },
      {
        role: "user",
        content: `

Write a proposal for this job.

Job Title:
${job.title}

Description:
${job.description}

User Skills:
${skillsText}

Pricing:
- Base Price: ${basePrice}
- Demand Factor: ${demandFactor}
- Complexity Factor: ${complexityFactor}
- Final Price Formula: basePrice * (1 + demandFactor + complexityFactor)
- Final Proposed Price: ${price}

Make it concise, professional, and conversion-focused.

Base draft to adapt:
${seedProposal}
`,
      },
    ],
  });

  const proposal = response.choices[0].message.content?.trim() || seedProposal;

  await supabase
    .from("job_applications")
    .insert({
      user_id: user.id,
      job_id: job.id,
      proposal,
    });

  // Auto-generate an invoice when the proposal is submitted
  const invoiceAmount = calculateDynamicPrice(job);
  await supabase.from("invoices").insert({
    client_email: user.email ?? null,
    description: job.title,
    amount: invoiceAmount,
    currency: job.currency || "USD",
    status: "pending",
  });

  return {
    proposal,
    price,
    pricing_breakdown: {
      basePrice,
      demandFactor,
      complexityFactor,
      formula: "basePrice * (1 + demandFactor + complexityFactor)",
    },
  };
}
