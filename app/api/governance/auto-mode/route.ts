import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/security/rateLimiter";
import { getProfileAIMemory } from "@/lib/learning/learningEngine";
import { getUserMode, setUserMode, type AiMode } from "@/lib/mode/modeManager";
import { translateCareerExperience } from "@/lib/ui/careerExperienceTranslator";
import { computeNotificationTone } from "@/lib/ui/notificationToneController";

export const dynamic = "force-dynamic";

function parseBoolean(input: string | null | undefined): boolean {
  if (!input) return false;
  return ["1", "true", "yes", "on"].includes(input.toLowerCase());
}

function parseModeInput(body: Record<string, unknown>): AiMode {
  const directMode = String(body.mode || "").trim().toLowerCase();
  if (directMode === "assist" || directMode === "autonomous") {
    return directMode;
  }

  if (typeof body.enabled === "boolean") {
    return body.enabled ? "autonomous" : "assist";
  }

  return "assist";
}

export const GET = withRateLimit(async (req: NextRequest) => {
  const userId = String(req.nextUrl.searchParams.get("userId") || "").trim();
  const includeWhy = parseBoolean(req.nextUrl.searchParams.get("includeWhy"));

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const [memory, mode] = await Promise.all([
    getProfileAIMemory(userId),
    getUserMode(userId),
  ]);

  const experience = translateCareerExperience({
    memory,
    mode,
    includeWhy,
  });

  const notificationTone = computeNotificationTone({
    systemGuidanceState: experience.systemGuidanceState,
    momentum: experience.momentum,
    stabilityOfDirection: experience.stabilityOfDirection,
    recoveryFrequency: Number(
      memory.resume_intelligence?.equilibrium_diagnostics?.equilibrium?.recoveryFrequency ??
      memory.mutation_policy_memory?.recovery_frequency ??
      0
    ),
    instabilityAcceleration: Number(
      memory.resume_intelligence?.equilibrium_diagnostics?.gradient?.instabilityAcceleration ??
      0
    ),
  });

  return NextResponse.json({
    success: true,
    userId,
    experience,
    notificationTone,
  }, {
    headers: {
      "Cache-Control": "public, max-age=5, stale-while-revalidate=10",
    },
  });
}, {
  namespace: "api:governance:auto-mode:get",
  limit: 90,
  windowSeconds: 60,
});

export const POST = withRateLimit(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const userId = String(body.userId || "").trim();
  const includeWhy = Boolean(body.includeWhy);

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const mode = parseModeInput(body);
  await setUserMode(userId, mode);

  const memory = await getProfileAIMemory(userId);
  const experience = translateCareerExperience({
    memory,
    mode,
    includeWhy,
  });

  const notificationTone = computeNotificationTone({
    systemGuidanceState: experience.systemGuidanceState,
    momentum: experience.momentum,
    stabilityOfDirection: experience.stabilityOfDirection,
    recoveryFrequency: Number(
      memory.resume_intelligence?.equilibrium_diagnostics?.equilibrium?.recoveryFrequency ??
      memory.mutation_policy_memory?.recovery_frequency ??
      0
    ),
    instabilityAcceleration: Number(
      memory.resume_intelligence?.equilibrium_diagnostics?.gradient?.instabilityAcceleration ??
      0
    ),
  });

  return NextResponse.json({
    success: true,
    userId,
    mode,
    message:
      mode === "autonomous"
        ? "Auto mode enabled. We will keep your direction steady while moving forward."
        : "Guided mode enabled. Recommendations will wait for your confirmation.",
    experience,
    notificationTone,
  });
}, {
  namespace: "api:governance:auto-mode:post",
  limit: 40,
  windowSeconds: 60,
});
