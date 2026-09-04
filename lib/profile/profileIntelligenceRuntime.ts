import { getLearningEvents, getProfileAIMemory, updateProfileAIMemory } from "@/lib/learning/learningEngine";
import { optimizeATSProfile, type ATSOptimizationResult, type ATSPlatform } from "@/lib/profile/atsOptimizationEngine";
import { scoreHumanRealism } from "@/lib/profile/humanRealismScoring";
import { runIdentityEvolutionForUser } from "@/lib/profile/identityEvolution";
import { scoreIdentityStability } from "@/lib/profile/identityStability";
import { deriveMarketSignalIntelligence } from "@/lib/profile/marketSignalIntelligence";
import { determineMarketPositioning } from "@/lib/profile/marketPositioningEngine";
import { buildProfileExplainability } from "@/lib/profile/profileExplainability";
import { scoreIdentityCohesion } from "@/lib/profile/identityCohesion";
import { runProfileSpecializationEngine } from "@/lib/profile/profileSpecializationEngine";
import { buildProfileVariants, type ProfileVariantKey } from "@/lib/profile/profileVariants";

export interface ProfileIntelligenceInput {
  userId: string;
  selectedCareers?: string[];
  skillsDetected?: string[];
  regionalTrends?: string[];
  platforms?: ATSPlatform[];
}

export interface ProfileIntelligenceOutput {
  specialization: ReturnType<typeof runProfileSpecializationEngine>;
  marketPositioning: ReturnType<typeof determineMarketPositioning>;
  atsProfiles: Array<ReturnType<typeof optimizeATSProfile>>;
  profileVariants: Record<ProfileVariantKey, ReturnType<typeof buildProfileVariants>[ProfileVariantKey]>;
  identityEvolution: Awaited<ReturnType<typeof runIdentityEvolutionForUser>>;
  identityStability: ReturnType<typeof scoreIdentityStability>;
  identityCohesion: ReturnType<typeof scoreIdentityCohesion>;
  explainability: ReturnType<typeof buildProfileExplainability>;
  humanRealism: ReturnType<typeof scoreHumanRealism>;
  marketSignals: ReturnType<typeof deriveMarketSignalIntelligence>;
  profileConfidenceScore: number;
}

function extractTextValues(events: Awaited<ReturnType<typeof getLearningEvents>>, type: string): string[] {
  return events
    .filter((event) => event.event_type === type)
    .map((event) => String((event.metadata as Record<string, unknown> | undefined)?.text || "").trim())
    .filter(Boolean);
}

function inferPlatformPattern(events: Awaited<ReturnType<typeof getLearningEvents>>): string[] {
  return events
    .map((event) => String((event.metadata as Record<string, unknown> | undefined)?.platform || "").toLowerCase().trim())
    .filter(Boolean);
}

function buildPositioningPerformance(events: Awaited<ReturnType<typeof getLearningEvents>>) {
  const identityStats = new Map<string, { proposals: number; callbacks: number; wins: number }>();

  for (const event of events) {
    const metadata = (event.metadata as Record<string, unknown> | undefined) ?? {};
    const label = String(metadata.identity_label || "").trim();
    if (!label) continue;

    const current = identityStats.get(label) ?? { proposals: 0, callbacks: 0, wins: 0 };
    if (event.event_type === "proposal_sent") current.proposals += 1;
    if (event.event_type === "client_reply" || event.event_type === "callback") current.callbacks += 1;
    if (event.event_type === "job_won") current.wins += 1;
    identityStats.set(label, current);
  }

  return Array.from(identityStats.entries())
    .map(([identityLabel, stats]) => ({
      identityLabel,
      proposalCount: stats.proposals,
      callbackRate: stats.proposals > 0 ? Number((stats.callbacks / stats.proposals).toFixed(2)) : 0,
      conversionRate: stats.proposals > 0 ? Number((stats.wins / stats.proposals).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.conversionRate - a.conversionRate)
    .slice(0, 8);
}

function computeProfileConfidence(output: ProfileIntelligenceOutput): number {
  const spec = output.specialization.confidence;
  const market = output.marketPositioning.confidence;
  const identity = output.identityEvolution.primaryIdentity.confidence;
  const stability = output.identityStability.score / 100;
  const realism = output.humanRealism.overallScore / 100;

  return Number(((spec.primaryConfidence * 0.26 + spec.dataConfidence * 0.14 + market * 0.18 + identity * 0.17 + stability * 0.15 + realism * 0.1) * 100).toFixed(1));
}

export async function runProfileIntelligenceRuntime(input: ProfileIntelligenceInput): Promise<ProfileIntelligenceOutput> {
  const events = await getLearningEvents(input.userId);
  const currentMemory = await getProfileAIMemory(input.userId);

  const selectedCareers = input.selectedCareers ?? [];
  const successfulApplications = extractTextValues(events, "job_won");
  const jobDescriptions = extractTextValues(events, "proposal_sent");
  const platformPatterns = inferPlatformPattern(events);

  const specialization = runProfileSpecializationEngine({
    selectedCareers,
    jobDescriptions,
    successfulApplications,
    platformPatterns,
    skillsDetected: input.skillsDetected ?? [],
    regionalTrends: input.regionalTrends ?? [],
  });

  const marketPositioning = determineMarketPositioning(specialization.inferredNiches);
  const marketSignals = deriveMarketSignalIntelligence(specialization.inferredNiches, events);

  const targets: ATSPlatform[] = input.platforms && input.platforms.length > 0
    ? input.platforms
    : ["linkedin", "indeed", "flexjobs", "generic"];

  const atsProfiles = targets.map((platform) => optimizeATSProfile({
    platform,
    headline: specialization.headline,
    specialization: specialization.primarySpecialization,
    secondarySpecialization: specialization.secondarySpecialization,
    baseKeywords: specialization.atsKeywords,
    operationalStrengths: specialization.operationalStrengths,
    aiCapabilityFraming: specialization.aiCapabilityFraming,
  }));

  const identityEvolution = await runIdentityEvolutionForUser(input.userId);
  const identityStability = scoreIdentityStability({
    previousMemory: currentMemory,
    nextWeights: identityEvolution.rankedIdentities,
    nextPrimaryIdentity: identityEvolution.primaryIdentity.identityLabel,
    suggestedShift: identityEvolution.suggestedShift,
  });

  const profileVariants = buildProfileVariants({
    headline: specialization.headline,
    primarySpecialization: specialization.primarySpecialization,
    secondarySpecialization: specialization.secondarySpecialization,
    atsKeywords: specialization.atsKeywords,
    operationalStrengths: specialization.operationalStrengths,
    aiCapabilityFraming: specialization.aiCapabilityFraming,
    identityLabel: identityEvolution.primaryIdentity.identityLabel,
    recommendedMarketFocus: marketSignals.recommendedProactiveShift || marketPositioning.recommendedNicheFocus,
    adaptationThrottle: identityStability.adaptationThrottle,
    atsReshapeThrottle: identityStability.atsReshapeThrottle,
  });

  const humanRealism = scoreHumanRealism(
    Object.values(profileVariants).map((variant) => ({
      key: variant.key,
      headline: variant.optimizedHeadline,
      summary: variant.summary,
      keywords: variant.prioritizedKeywords,
    }))
  );

  const safetyThrottle = Math.min(identityStability.adaptationThrottle, humanRealism.deploymentThrottle);
  const tunedVariants = Object.fromEntries(
    Object.entries(profileVariants).map(([key, variant]) => {
      const reducedKeywordCount = Math.max(8, Math.round(variant.prioritizedKeywords.length * safetyThrottle));
      return [
        key,
        {
          ...variant,
          prioritizedKeywords: variant.prioritizedKeywords.slice(0, reducedKeywordCount),
          appliedThrottle: Number(safetyThrottle.toFixed(2)),
        },
      ];
    })
  ) as Record<ProfileVariantKey, ReturnType<typeof buildProfileVariants>[ProfileVariantKey]>;

  const previousKeywords = Array.isArray(currentMemory.positioning_memory?.keywords)
    ? currentMemory.positioning_memory.keywords.flatMap((row) => row.keywords || [])
    : [];
  const selectedKeywordUniverse = Array.from(new Set(Object.values(tunedVariants).flatMap((variant) => variant.prioritizedKeywords)));
  const droppedKeywords = previousKeywords.filter((keyword) => !selectedKeywordUniverse.includes(keyword));

  const previousConfidence = Number(currentMemory.profile_confidence_score || 0);
  const previousMarketFocus = String((currentMemory.positioning_memory?.market_positioning as { recommendedNicheFocus?: unknown } | undefined)?.recommendedNicheFocus || "");
  const identityCohesion = scoreIdentityCohesion({
    primaryIdentity: identityEvolution.primaryIdentity.identityLabel,
    primarySpecialization: specialization.primarySpecialization,
    primaryResumeVariant: currentMemory.resume_intelligence?.primary_resume_variant || undefined,
    profileVariants: tunedVariants,
    resumeVariants: (currentMemory.resume_intelligence?.variants as Record<string, { label: string; headline: string; prioritizedKeywords: string[] }> | undefined) || {},
  });

  const explainability = buildProfileExplainability({
    primaryIdentity: identityEvolution.primaryIdentity.identityLabel,
    identityShift: identityEvolution.suggestedShift,
    identityStabilityScore: identityStability.score,
    adaptationThrottle: safetyThrottle,
    previousConfidence,
    currentConfidence: 0,
    selectedKeywords: selectedKeywordUniverse,
    droppedKeywords,
    previousMarketFocus,
    nextMarketFocus: marketSignals.recommendedProactiveShift || marketPositioning.recommendedNicheFocus,
    rationale: {
      identity: [identityEvolution.strategy],
      market: marketPositioning.rationale,
      stability: identityStability.rationale,
      realism: humanRealism.warnings.length > 0 ? humanRealism.warnings : ["Human realism checks passed."],
    },
  });

  const output: ProfileIntelligenceOutput = {
    specialization,
    marketPositioning,
    atsProfiles: targets
      .map((platform): ATSOptimizationResult => {
        if (platform === "linkedin") {
          return {
            ...atsProfiles.find((item) => item.platform === platform),
            platform: "linkedin",
            tone: atsProfiles.find((item) => item.platform === platform)!.tone,
            optimizedHeadline: tunedVariants.linkedin_profile.optimizedHeadline,
            summary: tunedVariants.linkedin_profile.summary,
            prioritizedKeywords: tunedVariants.linkedin_profile.prioritizedKeywords,
          };
        }
        if (platform === "indeed") {
          return {
            ...atsProfiles.find((item) => item.platform === platform),
            platform: "indeed",
            tone: atsProfiles.find((item) => item.platform === platform)!.tone,
            optimizedHeadline: tunedVariants.indeed_profile.optimizedHeadline,
            summary: tunedVariants.indeed_profile.summary,
            prioritizedKeywords: tunedVariants.indeed_profile.prioritizedKeywords,
          };
        }
        if (platform === "flexjobs") {
          return {
            ...atsProfiles.find((item) => item.platform === platform),
            platform: "flexjobs",
            tone: atsProfiles.find((item) => item.platform === platform)!.tone,
            optimizedHeadline: tunedVariants.flexjobs_profile.optimizedHeadline,
            summary: tunedVariants.flexjobs_profile.summary,
            prioritizedKeywords: tunedVariants.flexjobs_profile.prioritizedKeywords,
          };
        }
        return atsProfiles.find((item) => item.platform === platform)!;
      })
      .filter(Boolean),
    profileVariants: tunedVariants,
    identityEvolution,
    identityStability,
    identityCohesion,
    explainability,
    humanRealism,
    marketSignals,
    profileConfidenceScore: 0,
  };

  output.profileConfidenceScore = computeProfileConfidence(output);
  output.explainability = buildProfileExplainability({
    primaryIdentity: identityEvolution.primaryIdentity.identityLabel,
    identityShift: identityEvolution.suggestedShift,
    identityStabilityScore: identityStability.score,
    adaptationThrottle: safetyThrottle,
    previousConfidence,
    currentConfidence: output.profileConfidenceScore,
    selectedKeywords: selectedKeywordUniverse,
    droppedKeywords,
    previousMarketFocus,
    nextMarketFocus: marketSignals.recommendedProactiveShift || marketPositioning.recommendedNicheFocus,
    rationale: {
      identity: [identityEvolution.strategy],
      market: marketPositioning.rationale,
      stability: identityStability.rationale,
      realism: humanRealism.warnings.length > 0 ? humanRealism.warnings : ["Human realism checks passed."],
    },
  });

  const previousHistory = Array.isArray(currentMemory.positioning_memory?.history)
    ? currentMemory.positioning_memory?.history
    : [];
  const performance = buildPositioningPerformance(events);
  const history = [
    ...previousHistory,
    {
      recorded_at: new Date().toISOString(),
      primary_specialization: specialization.primarySpecialization,
      primary_identity: identityEvolution.primaryIdentity.identityLabel,
      confidence_score: output.profileConfidenceScore,
      market_focus: marketPositioning.recommendedNicheFocus,
    },
  ].slice(-30);

  const positioningMemoryPatch = {
    profile_confidence_score: output.profileConfidenceScore,
    identity_stability_score: identityStability.score,
    identity_cohesion: {
      score: identityCohesion.score,
      consistency: identityCohesion.consistency,
      overlap: identityCohesion.overlap,
      believability: identityCohesion.believability,
      divergenceRisk: identityCohesion.divergenceRisk,
      flags: identityCohesion.flags,
      rationale: identityCohesion.rationale,
    },
    identity_adaptation_throttle: Number(safetyThrottle.toFixed(2)),
    human_realism_score: humanRealism.overallScore,
    reinforcement_aggressiveness: identityStability.reinforcementAggressiveness,
    primary_specialization: specialization.primarySpecialization,
    secondary_specialization: specialization.secondarySpecialization,
    primary_identity: identityEvolution.primaryIdentity.identityLabel,
    profile_variants: tunedVariants,
    market_signal_intelligence: {
      ...marketSignals,
      risingNiches: marketSignals.risingNiches.map((signal) =>
        Object.fromEntries(Object.entries(signal))
      ),
      improvingSalaries: marketSignals.improvingSalaries.map((signal) =>
        Object.fromEntries(Object.entries(signal))
      ),
      weakeningPlatforms: marketSignals.weakeningPlatforms.map((signal) =>
        Object.fromEntries(Object.entries(signal))
      ),
      saturatingCategories: marketSignals.saturatingCategories.map((signal) =>
        Object.fromEntries(Object.entries(signal))
      ),
    },
    explainability: output.explainability,
    positioning_memory: {
      last_updated_at: new Date().toISOString(),
      headlines: Object.values(tunedVariants).map((profile) => ({ platform: profile.key, headline: profile.optimizedHeadline })),
      summaries: Object.values(tunedVariants).map((profile) => ({ platform: profile.key, summary: profile.summary })),
      keywords: Object.values(tunedVariants).map((profile) => ({ platform: profile.key, keywords: profile.prioritizedKeywords })),
      performance,
      history,
      market_positioning: {
        ...marketPositioning,
        proactive_shift: marketSignals.recommendedProactiveShift,
      },
    },
  };

  await updateProfileAIMemory(input.userId, positioningMemoryPatch);

  return output;
}
