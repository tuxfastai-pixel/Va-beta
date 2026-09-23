import { applyToJob } from "@/lib/jobs/apply";

type JobLike = {
  id?: string;
  title?: string;
  description?: string;
  client_response?: string;
};

export async function applyToJobAction(
  user: { id: string; resume?: string | null; profile?: string | null },
  job: JobLike,
  safeMode = true
) {
  if (safeMode) {
    console.log("Safe mode apply preview:", job.title || "Untitled");
    return;
  }

  await applyToJob(
    {
      user_id: user.id,
      resume: user.resume || "",
      profile: user.profile || "",
    },
    {
      ...job,
      client_response: job.client_response || "awaiting_response",
    }
  );
}
