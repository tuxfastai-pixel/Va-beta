import { config as loadEnv } from "dotenv";
import { executeModelRequest, extractTextFromCompletion } from "@/lib/ai/executeModelRequest";

loadEnv({ path: ".env.local" });

type ProfileWithSkills = {
  skills: string[];
};

type JobWithRequiredSkills = {
  required_skills: string[];
};

export function updateSkills(profile: ProfileWithSkills, job: JobWithRequiredSkills) {
  const skills = new Set(profile.skills);

  job.required_skills.forEach((s) => {
    skills.add(s);
  });

  return Array.from(skills);
}

export async function learningAgent(profile: string) {
  const completion = await executeModelRequest({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: "You recommend skills someone should learn to get hired.",
      },
      {
        role: "user",
        content: profile,
      },
    ],
    telemetry: {
      module: "lib/agents/learningAgent.ts",
    },
  });

  return extractTextFromCompletion(completion);
}
