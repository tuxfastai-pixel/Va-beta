import OpenAI from "openai";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  const completion = await client.chat.completions.create({
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
  });

  return completion.choices[0].message.content;
}
