import { generateProfileDescription } from "@/lib/profile/generateProfile.ts";

export const platforms = ["Upwork", "Fiverr", "LinkedIn", "Freelancer", "PayPal"] as const;

export type PlatformName = (typeof platforms)[number];
export type PlatformStatus = "pending" | "completed";

export type PlatformState = {
  name: PlatformName;
  status: PlatformStatus;
  url: string;
  checklist: string[];
};

export const platformLinks: Record<PlatformName, string> = {
  Upwork: "https://www.upwork.com",
  Fiverr: "https://www.fiverr.com",
  LinkedIn: "https://www.linkedin.com",
  Freelancer: "https://www.freelancer.com",
  PayPal: "https://www.paypal.com",
};

const PLATFORM_CAPABILITY_PREFIX = "__platform__:";

const platformChecklists: Record<PlatformName, string[]> = {
  Upwork: ["Create account", "Add headline", "Upload portfolio"],
  Fiverr: ["Create seller profile", "Set service niche", "Publish first gig draft"],
  LinkedIn: ["Create profile", "Add skills", "Turn on Open to Work"],
  Freelancer: ["Open account", "Set hourly rate", "Complete profile summary"],
  PayPal: ["Use same email", "Verify account", "Connect payout method"],
};

export function normalizePlatformName(value: string | null | undefined): PlatformName | null {
  if (!value) {
    return null;
  }

  const lowerValue = value.toLowerCase();
  return platforms.find((platform) => platform.toLowerCase() === lowerValue) ?? null;
}

export function buildPlatformStates(statusByName: Partial<Record<PlatformName, PlatformStatus>> = {}): PlatformState[] {
  return platforms.map((name) => ({
    name,
    status: statusByName[name] ?? "pending",
    url: platformLinks[name],
    checklist: platformChecklists[name],
  }));
}

function toPlatformCapabilityMarker(platform: PlatformName) {
  return `${PLATFORM_CAPABILITY_PREFIX}${platform}`;
}

export function stripPlatformCapabilityMarkers(capabilities: string[] = []) {
  return capabilities.filter((capability) => !capability.startsWith(PLATFORM_CAPABILITY_PREFIX));
}

export function extractPlatformStatusesFromCapabilities(capabilities: string[] = []) {
  const statusByName: Partial<Record<PlatformName, PlatformStatus>> = {};

  for (const capability of capabilities) {
    if (!capability.startsWith(PLATFORM_CAPABILITY_PREFIX)) {
      continue;
    }

    const normalizedPlatform = normalizePlatformName(capability.slice(PLATFORM_CAPABILITY_PREFIX.length));
    if (!normalizedPlatform) {
      continue;
    }

    statusByName[normalizedPlatform] = "completed";
  }

  return statusByName;
}

export function addPlatformCapabilityMarker(capabilities: string[] = [], platform: PlatformName) {
  const nextCapabilities = stripPlatformCapabilityMarkers(capabilities);
  const existingPlatforms = Object.keys(extractPlatformStatusesFromCapabilities(capabilities)) as PlatformName[];

  for (const existingPlatform of existingPlatforms) {
    nextCapabilities.push(toPlatformCapabilityMarker(existingPlatform));
  }

  if (!existingPlatforms.includes(platform)) {
    nextCapabilities.push(toPlatformCapabilityMarker(platform));
  }

  return nextCapabilities;
}

export function extractVisiblePlan(planValue: string | null | undefined) {
  if (!planValue) {
    return null;
  }

  return planValue.split("|")[0] || null;
}

export function extractPlatformStatusesFromPlan(planValue: string | null | undefined) {
  const planParts = String(planValue || "").split("|");
  return extractPlatformStatusesFromCapabilities(planParts);
}

export function addPlatformMarkerToPlan(planValue: string | null | undefined, platform: PlatformName) {
  const basePlan = extractVisiblePlan(planValue) || "free";
  const existingPlatforms = Object.keys(extractPlatformStatusesFromPlan(planValue)) as PlatformName[];
  const markers = existingPlatforms.map((existingPlatform) => toPlatformCapabilityMarker(existingPlatform));

  if (!existingPlatforms.includes(platform)) {
    markers.push(toPlatformCapabilityMarker(platform));
  }

  return [basePlan, ...markers].join("|");
}

export function getPlatformSummary(platformRows: Array<{ status: PlatformStatus }>, skillReadiness = 0) {
  const totalCount = platformRows.length || platforms.length;
  const completedCount = platformRows.filter((platform) => platform.status === "completed").length;
  const nextStepUnlocked = completedCount === totalCount;

  let readyLabel = "SETUP IN PROGRESS";
  if (nextStepUnlocked && skillReadiness >= 60) {
    readyLabel = "READY TO EARN 🔥";
  } else if (completedCount >= Math.max(3, Math.ceil(totalCount / 2)) || skillReadiness >= 50) {
    readyLabel = "ALMOST READY";
  }

  return {
    completedCount,
    totalCount,
    nextStepUnlocked,
    readyLabel,
  };
}

type ProfileSyncInput = {
  name?: string;
  skills: string[];
  ai_capabilities?: string[];
};

export function generatePlatformSync(profile: ProfileSyncInput) {
  const description = generateProfileDescription(profile);
  const leadSkills = profile.skills.slice(0, 3).join(", ") || "remote support";

  return {
    masterDescription: description,
    templates: {
      LinkedIn: `${description}\n\nOpen to remote opportunities in ${leadSkills}.`,
      Upwork: `I help clients with ${leadSkills} using AI-assisted workflows, clean communication, and fast delivery.`,
      Fiverr: `I will deliver reliable ${leadSkills} support with clear updates, smart automation, and quick turnaround.`,
      Freelancer: `Experienced in ${leadSkills}, workflow setup, and execution support for growing teams.`,
      PayPal: "Use the same verified email for smooth payouts across your earning platforms.",
    } as Record<PlatformName, string>,
  };
}
