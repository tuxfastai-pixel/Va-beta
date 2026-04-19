import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { autoApplicationAgent } from "../agents/autoApplicationAgent.ts";
import { logEvent } from "../system/logging.ts";

loadEnv({ path: ".env.local" });

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type WorkerContext = {
  user_id?: string;
  resume?: string | null;
  profile?: string | null;
};

type JobContext = {
  id?: string | number | null;
  title?: string | null;
  industry?: string | null;
  category?: string | null;
  client_response?: string | null;
  company?: string | null;
  company_name?: string | null;
  description?: string | null;
};

export async function applyToJob(worker: WorkerContext, job: JobContext) {
  if (!worker.user_id) {
    throw new Error("worker.user_id is required");
  }

  await autoApplicationAgent(
    worker.user_id,
    job,
    worker.resume || "",
    worker.profile || ""
  );

  await supabase.from("ai_memory").insert([
    {
      user_id: worker.user_id,
      memory_type: "successful_job_type",
      content: { job_type: job.title || "unknown" },
    },
    {
      user_id: worker.user_id,
      memory_type: "preferred_industry",
      content: { preferred_industry: job.industry || job.category || "general" },
    },
    {
      user_id: worker.user_id,
      memory_type: "client_response",
      content: { client_response: job.client_response || "awaiting_response" },
    },
  ]);

  logEvent({
    type: "application_sent",
    job_id: job.id,
    worker_id: worker.user_id,
  });
}
