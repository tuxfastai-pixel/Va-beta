import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type EquilibriumDiagnosticsResponse = {
  systemEmotionalState: string;
  tempo: {
    mode: string;
    adaptationVelocity: number;
    stabilizationBias: number;
  };
  inertia: {
    inertiaState: string;
    mutationResistance: number;
    identityLockPressure: number;
  };
  gradient: {
    instabilityAcceleration: number;
    warningGrowthRate: number;
    stabilizationRequired: boolean;
  };
  equilibrium: {
    equilibriumScore: number;
    stabilityEfficiencyRatio: number;
    recoveryFrequency: number;
  };
  trends: {
    equilibriumTrend: number[];
    recoveryTrend: number[];
    velocityTrend: number[];
  };
  updatedAt: string;
};

function safeNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export async function GET(req: Request) {
  const session = await getSessionUser();

  if (!session?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (userId && userId !== session.userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("ai_memory, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      {
        error: "Failed to fetch profile",
        message: error?.message || "Profile not found",
      },
      { status: 404 }
    );
  }

  const memory = (data.ai_memory || {}) as Record<string, unknown>;
  const resumeIntelligence =
    memory.resume_intelligence && typeof memory.resume_intelligence === "object"
      ? (memory.resume_intelligence as Record<string, unknown>)
      : {};
  const diagnostics =
    resumeIntelligence.equilibrium_diagnostics &&
    typeof resumeIntelligence.equilibrium_diagnostics === "object"
      ? (resumeIntelligence.equilibrium_diagnostics as Record<string, unknown>)
      : {};
  const tempo =
    diagnostics.tempo && typeof diagnostics.tempo === "object"
      ? (diagnostics.tempo as Record<string, unknown>)
      : {};
  const inertia =
    diagnostics.inertia && typeof diagnostics.inertia === "object"
      ? (diagnostics.inertia as Record<string, unknown>)
      : {};
  const gradient =
    diagnostics.gradient && typeof diagnostics.gradient === "object"
      ? (diagnostics.gradient as Record<string, unknown>)
      : {};
  const equilibrium =
    diagnostics.equilibrium && typeof diagnostics.equilibrium === "object"
      ? (diagnostics.equilibrium as Record<string, unknown>)
      : {};

  const policyMemory =
    memory.mutation_policy_memory &&
    typeof memory.mutation_policy_memory === "object"
      ? (memory.mutation_policy_memory as Record<string, unknown>)
      : {};
  const recoveryFrequency = safeNumber(policyMemory.recovery_frequency, 0);
  const stabilityEfficiencyRatio = safeNumber(
    policyMemory.stability_efficiency_ratio,
    0.5
  );

  const equilibriumLearning =
    resumeIntelligence.equilibrium_learning &&
    typeof resumeIntelligence.equilibrium_learning === "object"
      ? (resumeIntelligence.equilibrium_learning as Record<string, unknown>)
      : {};

  const byPattern =
    equilibriumLearning.byPattern && typeof equilibriumLearning.byPattern === "object"
      ? (equilibriumLearning.byPattern as Record<string, unknown>)
      : {};

  const patternEntries = Object.values(byPattern).filter(
    (entry): entry is Record<string, unknown> => typeof entry === "object"
  );

  const equilibriumTrend = patternEntries
    .map((entry) => safeNumber(entry.averageScore, 0))
    .slice(-12);

  const velocityTrend = patternEntries
    .map((entry) => Math.max(0, 1 - safeNumber(entry.interventions, 0) / (safeNumber(entry.attempts, 1) + 1)))
    .slice(-12);

  const recoveryTrend = Array(Math.min(12, patternEntries.length))
    .fill(0)
    .map((_, i) => {
      const idx = Math.max(0, patternEntries.length - 12 + i);
      const entry = patternEntries[idx];
      return entry ? safeNumber(entry.averageScore, 0) * (1 - recoveryFrequency * 0.3) : 0;
    });

  const response: EquilibriumDiagnosticsResponse = {
    systemEmotionalState: String(diagnostics.systemEmotionalState || "Balanced"),
    tempo: {
      mode: String(tempo.tempoMode || "balanced"),
      adaptationVelocity: safeNumber(tempo.adaptationVelocity, 0.5),
      stabilizationBias: safeNumber(tempo.stabilizationBias, 0.3),
    },
    inertia: {
      inertiaState: String(inertia.inertiaState || "fluid"),
      mutationResistance: safeNumber(inertia.mutationResistance, 0.4),
      identityLockPressure: safeNumber(inertia.identityLockPressure, 0.2),
    },
    gradient: {
      instabilityAcceleration: safeNumber(
        gradient.instabilityAcceleration,
        0
      ),
      warningGrowthRate: safeNumber(gradient.warningGrowthRate, 0),
      stabilizationRequired: Boolean(gradient.stabilizationRequired),
    },
    equilibrium: {
      equilibriumScore: safeNumber(equilibrium.equilibriumScore, 0.5),
      stabilityEfficiencyRatio,
      recoveryFrequency,
    },
    trends: {
      equilibriumTrend,
      recoveryTrend,
      velocityTrend,
    },
    updatedAt: String(
      diagnostics.timestamp || data.updated_at || new Date().toISOString()
    ),
  };

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
