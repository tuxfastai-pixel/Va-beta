import { getProfileAIMemory, updateProfileAIMemory } from "@/lib/learning/learningEngine";
import { runLiveAssistEngine } from "@/lib/assist/liveAssistEngine";
import { deriveMeetingContext } from "@/lib/assist/meetingContextEngine";
import { runProfessionalCoaching } from "@/lib/assist/professionalCoachingEngine";
import { runRealtimeKnowledgeEngine } from "@/lib/assist/realtimeKnowledgeEngine";
import { assessInterviewDrift } from "@/lib/assist/interviewDriftEngine";

export interface InterviewPreparationSyncInput {
  userId: string;
  transcript?: string;
  stageHint?: string;
  confidenceLevel?: number;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function normalizeTokens(value: string): string[] {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function detectDomain(terms: string[], identityLabel: string): "crm" | "finance" | "operations" {
  const blob = `${terms.join(" ")} ${identityLabel}`.toLowerCase();
  if (/crm|lead|pipeline|campaign|salesforce/.test(blob)) return "crm";
  if (/finance|audit|reconciliation|invoice|compliance/.test(blob)) return "finance";
  return "operations";
}

function inferWorkflowHints(terms: string[], identityLabel: string): string[] {
  const blob = `${terms.join(" ")} ${identityLabel}`.toLowerCase();

  if (/campaign|attribution|mql|reporting/.test(blob)) {
    return [
      "Explain campaign setup to reporting workflow in 3 steps.",
      "Reference lead qualification checkpoints and SLA handoff.",
      "Describe how you verify data quality before reporting decisions.",
    ];
  }

  if (/finance|audit|reconciliation|invoice/.test(blob)) {
    return [
      "Describe reconciliation workflow and exception handling sequence.",
      "Show controls used for audit-ready documentation.",
      "Emphasize traceability and approval separation.",
    ];
  }

  if (/tender|rfp|rfq|submission/.test(blob)) {
    return [
      "Explain requirement extraction and compliance checklisting.",
      "Outline submission governance and timeline control.",
      "Clarify handoff and revision tracking approach.",
    ];
  }

  return [
    "Explain requirement intake, execution sequencing, and QA handoff.",
    "Use one concrete process example with measurable outcome.",
    "Close answers with ownership, timeline, and success metric.",
  ];
}

function computeAlignmentScore(terms: string[], focusTerms: string[]): number {
  const left = new Set(terms.flatMap(normalizeTokens));
  const right = new Set(focusTerms.flatMap(normalizeTokens));

  if (left.size === 0 || right.size === 0) return 55;

  const intersection = Array.from(left).filter((token) => right.has(token)).length;
  const union = new Set([...Array.from(left), ...Array.from(right)]).size;
  const ratio = union > 0 ? intersection / union : 0;
  return Math.max(35, Math.min(98, Number((ratio * 100).toFixed(1))));
}

export async function buildInterviewPreparationSync(input: InterviewPreparationSyncInput) {
  const memory = await getProfileAIMemory(input.userId);
  const transcript = String(input.transcript || "").trim();
  const meetingContext = deriveMeetingContext({ transcript, stageHint: input.stageHint });

  const primaryIdentity = String(memory.primary_identity || memory.primary_specialization || "Operations Support Specialist").trim();
  const resumeIntelligence = memory.resume_intelligence;
  const primaryVariantKey = String(resumeIntelligence?.primary_resume_variant || "corporate_operations_resume");
  const variant = resumeIntelligence?.variants?.[primaryVariantKey];

  const terminologyPool = unique([
    ...(Array.isArray(variant?.prioritizedKeywords) ? variant.prioritizedKeywords : []),
    ...(Array.isArray(memory.profile_variants?.indeed_profile?.prioritizedKeywords) ? memory.profile_variants.indeed_profile.prioritizedKeywords : []),
    ...(Array.isArray(memory.profile_variants?.linkedin_profile?.prioritizedKeywords) ? memory.profile_variants.linkedin_profile.prioritizedKeywords : []),
  ]).slice(0, 12);

  const workflowHints = inferWorkflowHints(terminologyPool, primaryIdentity);
  const knowledgeDomain = detectDomain(terminologyPool, primaryIdentity);

  const liveAssist = runLiveAssistEngine({
    userMessage: transcript || "Prepare me for interview responses aligned to my active resume.",
    meetingStage: (meetingContext.stage as "intro" | "discovery" | "objection" | "negotiation" | "close"),
    intent: "interview",
    confidenceLevel: input.confidenceLevel,
    identityContext: {
      activeIdentity: primaryIdentity,
      primaryResumeVariant: primaryVariantKey,
      terminology: terminologyPool,
      workflowPriorities: workflowHints,
    },
  });

  const coaching = runProfessionalCoaching({
    context: "interview",
    userConfidence: input.confidenceLevel,
    identityFocus: {
      label: primaryIdentity,
      terminology: terminologyPool,
      workflowPriorities: workflowHints,
    },
  });

  const knowledge = runRealtimeKnowledgeEngine({
    domain: knowledgeDomain,
    query: transcript,
  });

  const alignmentScore = computeAlignmentScore(terminologyPool, [
    primaryIdentity,
    String(variant?.headline || ""),
    ...workflowHints,
  ]);

  const drift = assessInterviewDrift({
    transcript,
    alignmentScore,
    terminology: terminologyPool,
    workflowHints,
    confidenceLevel: input.confidenceLevel,
    meetingStage: meetingContext.stage,
    intent: meetingContext.intent,
    primaryIdentity,
  });

  await updateProfileAIMemory(input.userId, {
    interview_prep_sync: {
      updated_at: new Date().toISOString(),
      primary_identity: primaryIdentity,
      primary_resume_variant: primaryVariantKey,
      alignment_score: alignmentScore,
      terminology: terminologyPool,
      workflow_hints: workflowHints,
      meeting_stage: meetingContext.stage,
      intent: meetingContext.intent,
      drift: {
        risk_level: drift.riskLevel,
        risk_score: drift.riskScore,
        recruiter_suspicion_risk: drift.recruiterSuspicionRisk,
        flags: drift.flags,
        summary: drift.summary,
        recommendation: drift.recommendation,
        readiness_by_domain: drift.readinessByDomain,
        term_competency: drift.termCompetency,
        diagnostics: {
          terminology_overlap: drift.diagnostics.terminologyOverlap,
          workflow_overlap: drift.diagnostics.workflowOverlap,
          confidence_gap: drift.diagnostics.confidenceGap,
          hesitation_score: drift.diagnostics.hesitationScore,
          realism_inconsistency: drift.diagnostics.realismInconsistency,
        },
      },
    },
  });

  return {
    primaryIdentity,
    primaryResumeVariant: primaryVariantKey,
    alignmentScore,
    terminology: terminologyPool,
    workflowHints,
    drift,
    meetingContext,
    liveAssist,
    coaching,
    knowledge,
  };
}
