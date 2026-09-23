export type SkillState =
  | "not_started"
  | "learning"
  | "understood"
  | "ai_assisted_capable"
  | "mastered";

export type AutomationLevel = "manual" | "assisted" | "semi-auto" | "autonomous";

export type Skill = {
  name: string;
  phase: number;
  humanCapability: string[];
  aiCapability: string[];
  automationLevel: AutomationLevel;
};

export type CareerPhase = {
  phase: number;
  title: string;
  humanTrack: string[];
  aiTrack: string[];
  roleOutcome: string;
};

export const ADMIN_AI_ASSISTED_PHASES: CareerPhase[] = [
  {
    phase: 1,
    title: "Basic Operations",
    humanTrack: [
      "Email communication basics",
      "Excel basics",
      "File naming and organization",
      "Task and instruction understanding",
    ],
    aiTrack: [
      "Draft professional emails",
      "Auto-format spreadsheets",
      "Auto-organize documents",
      "Suggest task prioritization",
    ],
    roleOutcome: "AI-assisted junior admin operator",
  },
  {
    phase: 2,
    title: "Work Ready",
    humanTrack: [
      "Professional email writing",
      "Client instruction handling",
      "Scheduling fundamentals",
      "Basic reporting logic",
    ],
    aiTrack: [
      "Draft client replies for approval",
      "Calendar scheduling automation",
      "Email summarization into action points",
      "Task breakdown generation",
    ],
    roleOutcome: "AI-assisted virtual assistant",
  },
  {
    phase: 3,
    title: "Professional",
    humanTrack: [
      "CRM pipeline basics",
      "Client communication etiquette",
      "Workflow coordination",
    ],
    aiTrack: [
      "CRM auto-updates",
      "Lead tagging and scoring",
      "Follow-up generation",
      "Context-aware client drafts",
    ],
    roleOutcome: "AI-augmented operations assistant",
  },
  {
    phase: 4,
    title: "High Value Ops",
    humanTrack: [
      "Sales fundamentals",
      "KPI interpretation",
      "Workflow design thinking",
    ],
    aiTrack: [
      "Lead conversion prediction",
      "Automated follow-up sequences",
      "Client pricing suggestions",
      "Performance dashboard generation",
    ],
    roleOutcome: "AI-enhanced revenue operator",
  },
  {
    phase: 5,
    title: "Autonomous Workforce Mode",
    humanTrack: [
      "Strategic oversight",
      "Decision approval",
      "Exception handling",
    ],
    aiTrack: [
      "Job selection and ranking",
      "Proposal writing",
      "Client communication",
      "CRM management",
      "Pricing optimization",
      "Revenue tracking",
    ],
    roleOutcome: "Supervisor of AI workforce",
  },
];

export const ADMIN_AI_ASSISTED_SKILLS: Skill[] = [
  {
    name: "Email Management",
    phase: 1,
    humanCapability: ["Read emails", "Respond manually"],
    aiCapability: ["Draft responses", "Summarize inbox", "Prioritize urgent messages"],
    automationLevel: "assisted",
  },
  {
    name: "Spreadsheet Operations",
    phase: 1,
    humanCapability: ["Create basic sheets", "Enter data manually"],
    aiCapability: ["Create structured trackers", "Auto-format tables", "Generate quick summaries"],
    automationLevel: "assisted",
  },
  {
    name: "Client Coordination",
    phase: 2,
    humanCapability: ["Understand client requests", "Follow up manually"],
    aiCapability: ["Draft client updates", "Suggest next actions", "Schedule reminders"],
    automationLevel: "semi-auto",
  },
  {
    name: "CRM Operations",
    phase: 3,
    humanCapability: ["Track leads", "Update pipeline manually"],
    aiCapability: ["Auto-update CRM", "Detect follow-up gaps", "Generate pipeline reports"],
    automationLevel: "semi-auto",
  },
  {
    name: "Revenue Operations",
    phase: 4,
    humanCapability: ["Review conversion KPIs", "Approve outreach strategy"],
    aiCapability: ["Predict lead quality", "Prioritize opportunities", "Draft closing messages"],
    automationLevel: "autonomous",
  },
];

export function deriveSkillState(input: {
  practiceCount?: number;
  hasAiExecution?: boolean;
  accuracyScore?: number;
}): SkillState {
  const practices = Number(input.practiceCount || 0);
  const hasAiExecution = Boolean(input.hasAiExecution);
  const accuracy = Number(input.accuracyScore || 0);

  if (accuracy >= 90 && practices >= 20) {
    return "mastered";
  }

  if (hasAiExecution && practices >= 3) {
    return "ai_assisted_capable";
  }

  if (practices >= 5) {
    return "understood";
  }

  if (practices > 0) {
    return "learning";
  }

  return "not_started";
}
