import { supabaseServer } from "@/lib/supabaseServer";

export type WorkforceAgent =
  | "LeadHunterAgent"
  | "ProposalAgent"
  | "InterviewAgent"
  | "NegotiationAgent"
  | "BillingAgent"
  | "RetentionAgent";

export interface WorkItem {
  id: string;
  type: "lead" | "proposal" | "interview" | "negotiation" | "billing" | "retention";
  priority: number; // 1-10
  payload?: Record<string, unknown>;
}

export interface AgentLoadProfile {
  agentName: WorkforceAgent;
  recentActions: number;
  recentFailures: number;
  loadScore: number;
}

export interface AssignmentRecommendation {
  workItemId: string;
  assignedAgent: WorkforceAgent;
  primaryAgent: WorkforceAgent;
  rebalanced: boolean;
  confidence: number;
  reason: string;
}

export interface WorkloadBalancingOptions {
  minConfidence?: number;
  maxReassignPct?: number;
}

const TYPE_TO_AGENT: Record<WorkItem["type"], WorkforceAgent> = {
  lead: "LeadHunterAgent",
  proposal: "ProposalAgent",
  interview: "InterviewAgent",
  negotiation: "NegotiationAgent",
  billing: "BillingAgent",
  retention: "RetentionAgent",
};

function clamp(input: number): number {
  return Math.max(0, Math.min(100, Math.round(input)));
}

async function getAgentLoadProfiles(days = 3): Promise<AgentLoadProfile[]> {
  const since = new Date();
  since.setDate(since.getDate() - Math.max(1, days));

  const { data } = await supabaseServer
    .from("agent_activities")
    .select("agent_name, outcome")
    .gte("created_at", since.toISOString());

  const map = new Map<string, { actions: number; failures: number }>();

  for (const row of (data ?? []) as Array<{ agent_name: string; outcome: string | null }>) {
    const key = String(row.agent_name || "UnknownAgent");
    const current = map.get(key) ?? { actions: 0, failures: 0 };
    current.actions += 1;
    if (String(row.outcome || "").toLowerCase() === "failure") {
      current.failures += 1;
    }
    map.set(key, current);
  }

  const allAgents: WorkforceAgent[] = [
    "LeadHunterAgent",
    "ProposalAgent",
    "InterviewAgent",
    "NegotiationAgent",
    "BillingAgent",
    "RetentionAgent",
  ];

  return allAgents.map((agent) => {
    const stats = map.get(agent) ?? { actions: 0, failures: 0 };
    const failureRatio = stats.actions > 0 ? stats.failures / stats.actions : 0;
    const loadScore = clamp(stats.actions * 6 + failureRatio * 40);

    return {
      agentName: agent,
      recentActions: stats.actions,
      recentFailures: stats.failures,
      loadScore,
    };
  });
}

export async function balanceWorkload(
  items: WorkItem[],
  options?: WorkloadBalancingOptions
): Promise<AssignmentRecommendation[]> {
  const minConfidence = Math.max(25, Math.min(95, Number(options?.minConfidence ?? 55)));
  const maxReassignPct = Math.max(5, Math.min(80, Number(options?.maxReassignPct ?? 35)));
  const loadProfiles = await getAgentLoadProfiles();
  const loadMap = new Map(loadProfiles.map((profile) => [profile.agentName, profile]));

  const maxReassignments = Math.max(1, Math.floor(items.length * (maxReassignPct / 100)));
  let rebalancedCount = 0;

  return items
    .slice()
    .sort((left, right) => right.priority - left.priority)
    .map((item) => {
      const primary = TYPE_TO_AGENT[item.type];
      const primaryLoad = loadMap.get(primary);

      let assigned = primary;
      let reason = `Primary owner for ${item.type}`;
      let rebalanced = false;

      if (primaryLoad && primaryLoad.loadScore > 75 && rebalancedCount < maxReassignments) {
        const backup = loadProfiles
          .filter((profile) => profile.agentName !== primary)
          .sort((left, right) => left.loadScore - right.loadScore)[0];

        if (backup) {
          assigned = backup.agentName;
          reason = `${primary} overloaded (${primaryLoad.loadScore}); shifted to ${backup.agentName}`;
          rebalanced = true;
          rebalancedCount += 1;
        }
      }

      const assignedLoad = loadMap.get(assigned);
      const confidence = clamp(92 - (assignedLoad?.loadScore ?? 0) * 0.45 - Math.max(0, item.priority - 7) * 3);

      if (confidence < minConfidence) {
        assigned = primary;
        rebalanced = false;
        reason = `Guardrail blocked rebalancing; confidence ${confidence}% below ${minConfidence}%`;
      }

      return {
        workItemId: item.id,
        assignedAgent: assigned,
        primaryAgent: primary,
        rebalanced,
        confidence,
        reason,
      };
    });
}
