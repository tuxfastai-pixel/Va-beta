import OpenAI from "openai";
import { Queue } from "bullmq";
import { config as loadEnv } from "dotenv";
import { enqueueDiscovery } from "../queues/discoveryQueue.ts";
import { enqueueRanking } from "../queues/rankingQueue.ts";
import { supabaseServer } from "../supabaseServer.ts";

loadEnv({ path: ".env.local" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const jobQueue = new Queue("career-tasks", {
  connection: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT ?? 6379),
  },
});

type PlannerUser = {
  id: string;
  email?: string;
  preferred_markets?: string[];
};

export async function runPlanner(user: PlannerUser) {
  const markets = user.preferred_markets || [];

  console.log("Running planner for", user.email || user.id);

  await supabaseServer.from("ai_memory").insert({
    user_id: user.id,
    memory_type: "job_strategy",
    content: {
      preferred_market: markets[0] || "UK",
    },
  });

  await enqueueDiscovery(user.id, markets);
  await enqueueRanking(user.id);
}

export async function planner(user: PlannerUser) {
  return runPlanner(user);
}

export async function plannerAgent(userId: string, resume: string, profile: string) {
  const reasoning = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content:
          "You are an AI career planner. Decide which actions should be taken to help the user get hired.",
      },
      {
        role: "user",
        content: `Resume:\n${resume}\n\nProfile:\n${profile}\n\nDecide tasks from this list:\nscanJobs\nanalyzeResume\nskillGapAnalysis`,
      },
    ],
  });

  const decision = reasoning.choices[0].message.content || "";

  console.log("Planner decision:", decision);

  if (decision.includes("scanJobs")) {
    await jobQueue.add("scanJobs", {
      userId,
      resume,
      profile,
    });
  }

  if (decision.includes("analyzeResume")) {
    await jobQueue.add("analyzeResume", {
      userId,
      resume,
    });
  }

  if (decision.includes("skillGapAnalysis")) {
    await jobQueue.add("skillGapAnalysis", {
      userId,
      profile,
    });
  }
}
