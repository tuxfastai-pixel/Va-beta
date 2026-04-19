import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { filterJob, saveQuality } from "../agents/jobQualityFilter.ts";
import { logEvent } from "../system/logging.ts";
import { crawlJobSources } from "./crawler.ts";
import { normalizeJob, type NormalizedJob } from "./normalization.ts";

loadEnv({ path: ".env.local" });

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizeMarket(value: string) {
  return value.trim().toUpperCase();
}

function isMarketMatch(job: NormalizedJob, markets: string[]) {
  if (!markets.length) {
    return true;
  }

  const country = String(job.country || "").toUpperCase();
  const normalized = markets.map(normalizeMarket);

  return normalized.some((market) => {
    if (market === "US" || market === "USA") {
      return country.includes("US") || country.includes("UNITED STATES") || country === "GLOBAL";
    }

    if (market === "UK") {
      return country.includes("UK") || country.includes("UNITED KINGDOM") || country === "GLOBAL";
    }

    if (market === "UAE") {
      return country.includes("UAE") || country.includes("DUBAI") || country.includes("UNITED ARAB EMIRATES") || country === "GLOBAL";
    }

    if (market === "DE") {
      return country.includes("DE") || country.includes("GERMANY") || country === "GLOBAL";
    }

    if (market === "FR") {
      return country.includes("FR") || country.includes("FRANCE") || country === "GLOBAL";
    }

    if (market === "NL") {
      return country.includes("NL") || country.includes("NETHERLANDS") || country === "GLOBAL";
    }

    return country.includes(market) || country === "GLOBAL";
  });
}

async function upsertIngestedJob(userId: string, job: NormalizedJob) {
  const { data: existing } = await supabase
    .from("jobs")
    .select("id")
    .eq("user_id", userId)
    .eq("title", job.title)
    .eq("company", job.company)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("jobs")
      .update({
        description: job.description,
      })
      .eq("id", existing.id);

    return { id: String(existing.id) };
  }

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      user_id: userId,
      title: job.title,
      company: job.company,
      description: job.description,
      match_score: 0,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || "Failed to ingest job");
  }

  return { id: String(data.id) };
}

export async function ingestJobs(userId: string, markets: string[] = []) {
  const rawJobs = await crawlJobSources();
  const acceptedJobs: Array<NormalizedJob & { id: string }> = [];

  logEvent({
    type: "jobs_discovered",
    worker_id: userId,
    count: rawJobs.length,
  });

  for (const rawJob of rawJobs) {
    const normalized = normalizeJob(rawJob, String(rawJob.source || "unknown"));

    if (!isMarketMatch(normalized, markets)) {
      continue;
    }

    const ingested = await upsertIngestedJob(userId, normalized);
    const quality = await filterJob(normalized);
    await saveQuality(ingested.id, quality);

    if (quality.quality_score < 60 || quality.scam_risk >= 0.6) {
      continue;
    }

    acceptedJobs.push({
      ...normalized,
      id: ingested.id,
    });
  }

  return acceptedJobs;
}
