import { plannerAgent } from "@/lib/agents/plannerAgent";

export async function POST(req: Request) {
  const { userId, resume, profile } = await req.json();

  await plannerAgent(userId, resume, profile);

  return Response.json({
    status: "AI agents started",
  });
}
