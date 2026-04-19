import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

type ApplicationJob = {
  id?: string | number | null;
  title?: string | null;
  company?: string | null;
  company_name?: string | null;
  description?: string | null;
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function autoApplicationAgent(userId: string, job: ApplicationJob, resume: string, profile: string) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content:
          "You are an AI career assistant. Write a personalized cover letter and resume tweaks for a user applying to a job.",
      },
      {
        role: "user",
        content: `
Resume: ${resume}
Profile: ${profile}
Job Title: ${job.title || "Unknown role"}
Company: ${job.company || job.company_name || "Unknown company"}
Job Description: ${job.description || "No description provided"}

Generate:
- Suggested resume tweaks
- Cover letter
- Optional application notes
`,
      },
    ],
  });

  const result = completion.choices[0].message.content || "";

  await supabase.from("applications").insert({
    user_id: userId,
    job_id: job.id || null,
    job_title: job.title || "Untitled role",
    company: job.company ?? job.company_name ?? null,
    suggested_resume: result,
    cover_letter: result,
    status: "pending",
    created_at: new Date().toISOString(),
  });

  return result;
}
