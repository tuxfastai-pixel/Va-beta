import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import { enqueueEngineeringTask } from "@/lib/engineering/enqueueEngineeringTask";

type JobMatchRow = {
  id: string;
  user_id: string;
  title: string | null;
  company: string | null;
  description: string | null;
  url: string | null;
  match_score: number;
  quality_score: number | null;
  pay_amount: number | null;
  currency: string | null;
  scam_risk: string | null;
  [key: string]: unknown;
};

type MemoryRow = {
  job_match_id: string | null;
  context: Record<string, unknown> | null;
};

type SimilarityRow = {
  similarity?: number | null;
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function promoteQualifiedJobMatches(): Promise<number> {
  const { data: matches, error: matchError } = await supabase
    .from("job_matches")
    .select("*")
    .gt("match_score", 85)
    .eq("scam_risk", "low");

  if (matchError) {
    throw new Error(`Failed to fetch job matches: ${matchError.message}`);
  }

  let promoted = 0;

  for (const raw of (matches || []) as JobMatchRow[]) {
    const embedding = await createEmbedding(
      `${raw.title ?? ""} ${raw.description ?? ""} ${raw.company ?? ""}`
    );

    const similar = await supabase.rpc("search_ai_memory_by_embedding", {
      query_embedding: embedding,
      match_count: 5,
    });

    if (similar.error) {
      throw new Error(`Failed semantic lookup for match ${raw.id}: ${similar.error.message}`);
    }

    const topSimilar = (Array.isArray(similar.data) ? similar.data : []) as SimilarityRow[];
    const topMemory = similar.data?.[0] as MemoryRow | undefined;
    const semanticBoost = Number(topSimilar[0]?.similarity ?? 0);

    if (!(raw.match_score > 85 && raw.scam_risk === "low" && semanticBoost > 0.75)) {
      continue;
    }

    const { data: existingJob, error: existingErr } = await supabase
      .from("jobs")
      .select("id")
      .eq("job_match_id", raw.id)
      .maybeSingle();

    if (existingErr) {
      throw new Error(`Failed to check existing job for match ${raw.id}: ${existingErr.message}`);
    }

    if (existingJob?.id) {
      continue;
    }

    const { error: insertJobErr } = await supabase.from("jobs").insert({
      user_id: raw.user_id,
      title: raw.title,
      company: raw.company,
      url: raw.url,
      match_score: raw.match_score,
      quality_score: raw.quality_score,
      pay_amount: raw.pay_amount,
      currency: raw.currency,
      created_at: new Date().toISOString(),
      job_match_id: raw.id,
    });

    if (insertJobErr) {
      throw new Error(`Failed to insert promoted job ${raw.id}: ${insertJobErr.message}`);
    }

    const memoryPayload = {
      job_match_id: raw.id,
      context: raw,
      content: raw,
      memory_type: "job_match_context",
      user_id: raw.user_id,
      embedding,
      created_at: new Date().toISOString(),
    };

    const { error: memoryErr } = await supabase
      .from("ai_memory")
      .upsert(memoryPayload, { onConflict: "job_match_id" });

    if (memoryErr) {
      throw new Error(`Failed to store memory for match ${raw.id}: ${memoryErr.message}`);
    }

    await enqueueEngineeringTask({
      goal: "Process promoted high-quality low-risk job",
      user_id: raw.user_id,
      job_match_id: raw.id,
      title: raw.title,
      company: raw.company,
      match_score: raw.match_score,
      scam_risk: raw.scam_risk,
      prior_context: topMemory?.context ?? null,
    });

    promoted += 1;
  }

  return promoted;
}

async function createEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return response.data[0]?.embedding || [];
}

export async function getTopSimilarJobMemories(queryText: string): Promise<MemoryRow[]> {
  const queryEmbedding = await createEmbedding(queryText);

  const { data: semanticRows, error: semanticErr } = await supabase.rpc("search_ai_memory_by_embedding", {
    query_embedding: queryEmbedding,
    match_count: 5,
  });

  if (semanticErr) {
    throw new Error(`Failed semantic retrieval: ${semanticErr.message}`);
  }

  return (semanticRows || []) as MemoryRow[];
}
