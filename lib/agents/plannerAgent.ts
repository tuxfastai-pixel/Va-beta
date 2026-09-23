import { config as loadEnv } from "dotenv";
import { supabaseServer } from "../supabaseServer.ts";
import { executeModelRequest, extractTextFromCompletion } from "@/lib/ai/executeModelRequest";

loadEnv({ path: ".env.local" });

const queuesEnabled = process.env.ENABLE_QUEUES === "true";

if (!queuesEnabled) {
  console.log("🚫 Queues disabled");
}

type PlannerQueue = {
  add(name: string, payload: Record<string, unknown>): Promise<unknown>;
};

let jobQueue: PlannerQueue | null = null;

async function getJobQueue(): Promise<PlannerQueue | null> {
  if (!queuesEnabled) {
    return null;
  }

  if (jobQueue) {
    return jobQueue;
  }

  const redisHost = process.env.REDIS_HOST?.trim();
  const redisPort = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined;

  if (!redisHost || redisHost === "127.0.0.1" || redisHost === "localhost") {
    return null;
  }

  const { Queue } = await import("bullmq");
  jobQueue = new Queue("career-tasks", {
    connection: {
      host: redisHost,
      ...(redisPort ? { port: redisPort } : {}),
    },
  });

  return jobQueue;
}

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

  if (!queuesEnabled) {
    return;
  }

  const [{ enqueueDiscovery }, { enqueueRanking }] = await Promise.all([
    import("../queues/discoveryQueue.ts"),
    import("../queues/rankingQueue.ts"),
  ]);

  await enqueueDiscovery(user.id, markets);
  await enqueueRanking(user.id);
}

export async function planner(user: PlannerUser) {
  return runPlanner(user);
}

export async function plannerAgent(userId: string, resume: string, profile: string) {
  const queue = await getJobQueue();

  const reasoning = await executeModelRequest({
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
    telemetry: {
      module: "lib/agents/plannerAgent.ts",
      userId,
    },
  });

  const decision = extractTextFromCompletion(reasoning);

  console.log("Planner decision:", decision);

  if (queue && decision.includes("scanJobs")) {
    await queue.add("scanJobs", {
      userId,
      resume,
      profile,
    });
  }

  if (queue && decision.includes("analyzeResume")) {
    await queue.add("analyzeResume", {
      userId,
      resume,
    });
  }

  if (queue && decision.includes("skillGapAnalysis")) {
    await queue.add("skillGapAnalysis", {
      userId,
      profile,
    });
  }
}
