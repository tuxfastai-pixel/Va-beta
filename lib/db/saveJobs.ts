import { supabase } from "@/lib/supabase";

type StoredJob = {
  title: string;
  description: string;
  platform: string;
  link: string;
  score?: number;
  createdAt?: Date;
};

export async function saveJobs(jobs: StoredJob[]) {
  if (jobs.length === 0) {
    return { inserted: 0, error: null };
  }

  const { error } = await supabase.from("jobs").upsert(
    jobs.map((job) => ({
      title: job.title,
      description: job.description,
      platform: job.platform,
      link: job.link,
      score: Number(job.score || 0),
      created_at: (job.createdAt || new Date()).toISOString(),
    })),
    {
      onConflict: "link",
      ignoreDuplicates: false,
    }
  );

  return {
    inserted: jobs.length,
    error: error?.message || null,
  };
}