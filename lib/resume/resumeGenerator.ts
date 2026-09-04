import type { ProfileSpecializationResult } from "@/lib/profile/profileSpecializationEngine";

export interface ResumeGeneratorInput {
  fullName?: string;
  location?: string;
  selectedCareers: string[];
  interests: string[];
  skills: string[];
  desiredIncome?: number;
  experienceSummary?: string;
  specialization: ProfileSpecializationResult;
  recommendedNiche: string;
}

export interface ResumeArtifact {
  key: string;
  title: string;
  summary: string;
  coreSkills: string[];
  transferableStrengths: string[];
  aiTooling: string[];
  atsKeywords: string[];
  honestyNotes: string[];
  text: string;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function sanitizeClaims(text: string): { text: string; notes: string[] } {
  const notes: string[] = [];
  let safeText = text;

  const replacements: Array<{ from: RegExp; to: string; note: string }> = [
    { from: /expert\s+/gi, to: "experienced with ", note: "Downgraded unsupported expert-level claim." },
    { from: /certified\s+/gi, to: "trained in ", note: "Avoided unverified certification claim." },
    { from: /master(?:y)?\s+of\s+/gi, to: "strong familiarity with ", note: "Reframed mastery claim to defensible proficiency." },
  ];

  for (const item of replacements) {
    const next = safeText.replace(item.from, item.to);
    if (next !== safeText) {
      notes.push(item.note);
      safeText = next;
    }
  }

  return { text: safeText, notes };
}

function buildResumeText(artifact: Omit<ResumeArtifact, "text" | "honestyNotes">): { text: string; honestyNotes: string[] } {
  const draft = [
    `${artifact.title}`,
    "",
    "Summary",
    artifact.summary,
    "",
    "Skills",
    artifact.coreSkills.join(" | "),
    "",
    "Transferable Strengths",
    artifact.transferableStrengths.map((item) => `- ${item}`).join("\n"),
    "",
    "Tools & AI-Augmented Operations",
    artifact.aiTooling.map((item) => `- ${item}`).join("\n"),
    "",
    "ATS Keywords",
    artifact.atsKeywords.join(", "),
    "",
    "Experience Framing",
    "Delivered structured operational support through workflow coordination, reporting discipline, documentation quality, and reliable communication.",
    "",
    "Integrity Statement",
    "This resume emphasizes verified and transferable strengths without fabricating employment history, certifications, or role scope.",
  ].join("\n");

  const sanitized = sanitizeClaims(draft);
  return {
    text: sanitized.text,
    honestyNotes: sanitized.notes,
  };
}

export function generateBaseResume(input: ResumeGeneratorInput): ResumeArtifact {
  const role = input.specialization.primarySpecialization || "Administrative Operations Specialist";
  const coreSkills = unique([
    ...input.skills,
    ...input.specialization.operationalStrengths,
  ]).slice(0, 16);

  const transferableStrengths = unique([
    "structured execution under deadlines",
    "clear written communication",
    "process reliability and follow-through",
    "cross-functional coordination",
    ...input.specialization.operationalStrengths,
  ]).slice(0, 10);

  const aiTooling = unique(input.specialization.aiCapabilityFraming).slice(0, 8);
  const atsKeywords = unique(input.specialization.atsKeywords).slice(0, 24);

  const summary = `${role} with a focus on ${input.recommendedNiche.replace(/_/g, " ")}. Strength in operational consistency, workflow coordination, and AI-assisted delivery for measurable business outcomes.`;

  const built = buildResumeText({
    key: "base_resume",
    title: role,
    summary,
    coreSkills,
    transferableStrengths,
    aiTooling,
    atsKeywords,
  });

  return {
    key: "base_resume",
    title: role,
    summary,
    coreSkills,
    transferableStrengths,
    aiTooling,
    atsKeywords,
    honestyNotes: built.honestyNotes,
    text: built.text,
  };
}

export function generateNicheResume(
  base: ResumeArtifact,
  nicheKey: string,
  nicheTitle: string,
  nicheKeywords: string[]
): ResumeArtifact {
  const summary = `${nicheTitle} profile emphasizing defensible operational outcomes, process quality, and execution discipline in ${nicheKey.replace(/_/g, " ")}.`;

  const built = buildResumeText({
    key: nicheKey,
    title: nicheTitle,
    summary,
    coreSkills: base.coreSkills,
    transferableStrengths: base.transferableStrengths,
    aiTooling: base.aiTooling,
    atsKeywords: unique([...nicheKeywords, ...base.atsKeywords]).slice(0, 26),
  });

  return {
    key: nicheKey,
    title: nicheTitle,
    summary,
    coreSkills: base.coreSkills,
    transferableStrengths: base.transferableStrengths,
    aiTooling: base.aiTooling,
    atsKeywords: unique([...nicheKeywords, ...base.atsKeywords]).slice(0, 26),
    honestyNotes: built.honestyNotes,
    text: built.text,
  };
}
