"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveResumeStepOnLoad } from "@/lib/career/activationContinuity";
import { buildReferralLink, calculateReferralBoost, generateReferralCode, generateSuccessPost } from "../../lib/growth/referrals.ts";
import { generateProfile, type SkillTrack } from "../../lib/profile/generateProfile.ts";
import { buildMicroLessons } from "../../lib/skills/skillBuilder.ts";
import CareerSelector from "@/components/CareerSelector";
import {
  buildPlatformStates,
  generatePlatformSync,
  getPlatformSummary,
  type PlatformState,
} from "../../lib/platforms/profileSync.ts";
import { generateContinuitySafeguard, generateRecoveryReflections } from "@/lib/ui/recoveryIntelligence";
import styles from "./page.module.css";

type UserInput = {
  name: string;
  email: string;
  skill: SkillTrack;
  country: string;
  userId: string | null;
};

type PaymentAccount =
  | "Wise"
  | "Payoneer"
  | "Deel"
  | "Remote"
  | "Oyster"
  | "PayPal"
  | "Revolut"
  | "None Yet";

type PayoutCurrency = "USD" | "EUR" | "GBP" | "CAD" | "AUD";

type PaymentReadinessScore = {
  profileCompletion: number;
  remoteWorkReadiness: number;
  paymentReadiness: number;
  missing: string[];
  guidance: string;
  estimatedSetupTimeMinutes: number;
};

const skillOptions: Array<{ value: SkillTrack; label: string }> = [
  { value: "teaching", label: "Writing / Teaching" },
  { value: "project-management", label: "Project Management" },
  { value: "admin-crm", label: "Admin Work" },
  { value: "finance-compliance", label: "Finance / Compliance" },
];

const paymentAccountOptions: PaymentAccount[] = [
  "Wise",
  "Payoneer",
  "Deel",
  "Remote",
  "Oyster",
  "PayPal",
  "Revolut",
  "None Yet",
];

const payoutCurrencies: PayoutCurrency[] = ["USD", "EUR", "GBP", "CAD", "AUD"];

const activationChecklist = ["Profile building", "Job applications", "Proposal writing", "Fast client delivery"];

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export default function OnboardingPage() {
  const lastTelemetrySignatureRef = useRef("");
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [savingPlatform, setSavingPlatform] = useState<PlatformState["name"] | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "Welcome. Let\'s activate your AI Career Agent in about 8 minutes."
  );
  const [platformStates, setPlatformStates] = useState<PlatformState[]>(() => buildPlatformStates());
  const [selectedCareers, setSelectedCareers] = useState<string[]>([]);
  const [primaryCareer, setPrimaryCareer] = useState<string>("");
  const [secondaryCareers, setSecondaryCareers] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<PaymentAccount[]>(["None Yet"]);
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [payoutCurrency, setPayoutCurrency] = useState<PayoutCurrency>("USD");
  const [user, setUser] = useState<UserInput>({
    name: "",
    email: "",
    skill: "admin-crm",
    country: "South Africa",
    userId: null,
  });

  useEffect(() => {
    const loadOnboardingData = async () => {
      const authRes = await fetch("/api/auth/me", { credentials: "include" });

      if (!authRes.ok) {
        router.push("/login");
        return;
      }

      const authPayload = (await authRes.json().catch(() => ({}))) as {
        user?: { id: string; email: string; name: string; founderEnabled?: boolean };
        onboardingCompleted?: boolean;
        redirectTo?: string;
      };

      if (!authPayload.user) {
        router.push("/login");
        return;
      }

      if (authPayload.onboardingCompleted && authPayload.redirectTo === "/client-portal") {
        router.replace("/client-portal");
        return;
      }

      const onboardingStateRes = await fetch("/api/onboarding/state", { credentials: "include" }).catch(() => null);
      const onboardingStatePayload = onboardingStateRes && onboardingStateRes.ok
        ? ((await onboardingStateRes.json().catch(() => ({}))) as { state?: { onboarding_completed?: boolean; completed_step?: number; last_valid_step?: number } | null })
        : null;

      const resume = resolveResumeStepOnLoad(onboardingStatePayload?.state
        ? {
            userId: authPayload.user.id,
            onboardingCompleted: Boolean(onboardingStatePayload.state.onboarding_completed),
            completedStep: Number(onboardingStatePayload.state.completed_step || 0),
            lastValidStep: Math.max(1, Math.min(5, Number(onboardingStatePayload.state.last_valid_step || 1))) as 1 | 2 | 3 | 4 | 5,
            completionTimestamp: null,
            answers: {},
            careerLanes: { selected: [], primary: "", secondary: [] },
            paymentReadiness: {
              selectedAccounts: [],
              accountHolderName: "",
              accountEmail: "",
              payoutCurrency: "USD",
              paymentReadinessScore: 0,
              paymentMissing: [],
            },
            internationalReadiness: {
              remoteReadinessScore: 0,
              profileCompletionScore: 0,
              internationalReadinessScore: 0,
            },
            continuityCheckpoint: {},
          }
        : null)

      if (resume.completed) {
        router.replace("/career-activation/complete");
        return;
      }

      setStep(resume.onboardingStep);

      setUser((prev) => ({
        ...prev,
        userId: authPayload.user?.id || null,
        email: prev.email || authPayload.user?.email || "",
        name: prev.name || authPayload.user?.name || "",
      }));

      const response = await fetch(`/api/platforms/status?userId=${authPayload.user.id}`);
      const profileResponse = await fetch(`/api/profile/summary?userId=${authPayload.user.id}`).catch(() => null);
      const profilePayload = profileResponse && profileResponse.ok
        ? ((await profileResponse.json().catch(() => ({}))) as {
            careers?: string[];
            primary_career?: string;
            secondary_careers?: string[];
          })
        : null;

      const careers = Array.isArray(profilePayload?.careers)
        ? profilePayload.careers.filter((career): career is string => typeof career === "string")
        : [];

      const primary = String(profilePayload?.primary_career || "");
      const secondary = Array.isArray(profilePayload?.secondary_careers)
        ? profilePayload.secondary_careers.filter((career): career is string => typeof career === "string")
        : [];

      if (careers.length > 0) {
        setSelectedCareers(careers.slice(0, 3));
      }

      if (primary) {
        setPrimaryCareer(primary);
      }

      if (secondary.length > 0) {
        setSecondaryCareers(secondary.slice(0, 2));
      }

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { platforms?: PlatformState[] };
      if (Array.isArray(payload.platforms)) {
        setPlatformStates(payload.platforms);
      }
    };

    void loadOnboardingData();
  }, [router]);

  const handleCompleteOnboarding = async () => {
    if (!user.userId) {
      setStatusMessage("Sign in again to complete activation.");
      router.push("/login");
      return;
    }

    setIsCompleting(true);
    setStatusMessage("Finalizing your AI Career Agent...");

    try {
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          userId: user.userId,
          name: user.name,
          email: user.email,
          selectedCareers,
          primaryCareer,
          secondaryCareers,
          selectedAccounts,
          accountHolderName,
          accountEmail,
          payoutCurrency,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string; redirectTo?: string };
      if (!response.ok) {
        setStatusMessage(payload.error || "Could not finalize onboarding.");
        return;
      }

      setStatusMessage("Your AI worker is now ready.");
      router.push(payload.redirectTo || "/client-portal");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not finalize onboarding.");
    } finally {
      setIsCompleting(false);
    }
  };

  const persistProgress = async (nextStep: number) => {
    const payload = {
      name: user.name,
      email: user.email,
      skillTrack: user.skill,
      selectedCareers,
      primaryCareer,
      secondaryCareers,
      paymentReadiness: {
        selectedAccounts,
        accountHolderName,
        accountEmail,
        payoutCurrency,
        paymentReadinessScore: paymentReadiness.paymentReadiness,
        paymentMissing: missingPaymentItems,
      },
      internationalReadiness: {
        remoteReadinessScore: paymentReadiness.remoteWorkReadiness,
        profileCompletionScore: paymentReadiness.profileCompletion,
        internationalReadinessScore: Math.round((paymentReadiness.remoteWorkReadiness + paymentReadiness.paymentReadiness) / 2),
      },
    };

    await fetch("/api/onboarding/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ step: nextStep, payload }),
    }).catch(() => null);
  };

  const handleRestartOnboarding = async () => {
    const confirmation = window.confirm("Restart onboarding? This will reset your current wizard progress.");
    if (!confirmation) {
      return;
    }

    setIsRestarting(true);
    try {
      const response = await fetch("/api/onboarding/restart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirm: true, reason: "explicit_user_request" }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setStatusMessage(payload.error || "Could not restart onboarding.");
        return;
      }

      setStep(1);
      setStatusMessage("Onboarding restarted.");
    } catch {
      setStatusMessage("Could not restart onboarding.");
    } finally {
      setIsRestarting(false);
    }
  };

  const referralCode = useMemo(() => generateReferralCode(user.email || user.name || "guest"), [user.email, user.name]);
  const referralLink = useMemo(() => buildReferralLink("", referralCode), [referralCode]);
  const profile = useMemo(
    () => generateProfile({
      name: user.name,
      email: user.email,
      skill: user.skill,
      primary_career: primaryCareer || selectedCareers[0],
      secondary_careers: secondaryCareers,
    }),
    [user, primaryCareer, secondaryCareers, selectedCareers]
  );
  const skillLessons = useMemo(() => buildMicroLessons(user.skill), [user.skill]);
  const platformSummary = useMemo(
    () => getPlatformSummary(platformStates, Math.round((skillLessons.length / 4) * 100)),
    [platformStates, skillLessons.length]
  );
  const platformSync = useMemo(
    () => generatePlatformSync({ skills: profile.skills, ai_capabilities: profile.ai_capabilities }),
    [profile]
  );
  const referralBoost = useMemo(() => calculateReferralBoost(1000), []);

  const paymentReadiness: PaymentReadinessScore = (() => {
    const completedPlatforms = platformStates.filter((platform) => platform.status === "completed").length;
    const profileCompletion = Math.round(
      clamp01((selectedCareers.length * 0.25 + completedPlatforms / Math.max(1, platformStates.length)) / 1.25) * 100
    );
    const remoteWorkReadiness = Math.round(
      clamp01((skillLessons.length / 4) * 0.45 + (selectedCareers.length > 0 ? 0.35 : 0.1) + (user.email ? 0.15 : 0)) * 100
    );

    const hasInternationalPaymentAccount = selectedAccounts.some((account) => account === "Wise" || account === "Payoneer");
    const hasTaxInfo = Boolean(accountHolderName.trim()) && Boolean(accountEmail.trim());
    const hasPreferredCurrency = Boolean(payoutCurrency);

    const missing = [
      hasInternationalPaymentAccount ? null : "Wise Account",
      hasTaxInfo ? null : "Tax Information",
      hasPreferredCurrency ? null : "International Banking Preference",
    ].filter((item): item is string => Boolean(item));

    const paymentReadinessValue = Math.round(
      clamp01(
        (hasInternationalPaymentAccount ? 0.45 : 0.12) +
          (hasTaxInfo ? 0.3 : 0.08) +
          (hasPreferredCurrency ? 0.15 : 0.05) +
          (selectedAccounts.includes("PayPal") ? 0.1 : 0)
      ) * 100
    );

    const guidance = hasInternationalPaymentAccount
      ? `Your payment setup is aligned for remote work in ${payoutCurrency}. Keep the account details current before applying.`
      : "This role pays through Wise or Payoneer. You do not currently have either. Recommended Action: Create a Wise account before applying.";

    const estimatedSetupTimeMinutes = hasInternationalPaymentAccount ? 5 : 15;

    return {
      profileCompletion,
      remoteWorkReadiness,
      paymentReadiness: paymentReadinessValue,
      missing,
      guidance,
      estimatedSetupTimeMinutes,
    };
  })();
  const missingPaymentItems = paymentReadiness?.missing ?? [];

  const onboardingRecovery = useMemo(() => {
    const completedPlatforms = platformStates.filter((platform) => platform.status === "completed");
    const pendingPlatforms = platformStates.filter((platform) => platform.status !== "completed");
    const trustScore = completedPlatforms.length / Math.max(1, platformStates.length);

    const reflections = generateRecoveryReflections({
      recentCompletions: completedPlatforms.map((platform) => platform.name),
      recentAbandoned: pendingPlatforms.slice(0, 2).map((platform) => platform.name),
      pressureState: pendingPlatforms.length > 2 ? "stabilizing" : "balanced",
      fatigueRisk: clamp01(pendingPlatforms.length / Math.max(1, platformStates.length)),
      trustScore,
      identityStable: selectedCareers.length > 0,
    });

    const safeguard = generateContinuitySafeguard({
      stablePatterns: ["Finish one setup step at a time", "Commit to one primary career direction"],
      successfulWorkflows: completedPlatforms.map((platform) => `${platform.name} completed`),
      trustDirection: primaryCareer || selectedCareers[0] || null,
      identityCore: user.name ? `${user.name}'s career momentum` : "Your career momentum",
    });

    return {
      reflections,
      safeguard,
      trustScore,
    };
  }, [platformStates, primaryCareer, selectedCareers, user.name]);

  useEffect(() => {
    const completedPlatforms = platformStates.filter((platform) => platform.status === "completed").length;
    const fatigueRisk = clamp01((platformStates.length - completedPlatforms) / Math.max(1, platformStates.length));
    const pressureState = fatigueRisk > 0.6 ? "stabilizing" : "balanced";
    const signature = `${step}|${pressureState}|${completedPlatforms}`;
    const previousSignature = lastTelemetrySignatureRef.current;

    if (signature === previousSignature) {
      return;
    }

    lastTelemetrySignatureRef.current = signature;
    const previousState = previousSignature.split("|")[1] || "balanced";

    const emit = async (eventType: string, nextState: string) => {
      try {
        await fetch("/api/telemetry/equilibrium-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: {
              userId: user.userId || "onboarding-anon",
              eventType,
              previousState,
              nextState,
              pressureLevel: fatigueRisk,
              fatigueRisk,
              recoveryTriggered: pressureState === "stabilizing",
              metadata: {
                step,
                completedPlatforms,
                platformCount: platformStates.length,
              },
            },
          }),
        });
      } catch (error) {
        console.error("onboarding telemetry emit failed", error);
      }
    };

    void emit("equilibrium_transition", pressureState);
    void emit("continuity_safeguard", onboardingRecovery.trustScore > 0.45 ? "engaged" : "low_trust");
  }, [onboardingRecovery.trustScore, platformStates, step, user.userId]);

  const markPlatformCompleteLocally = (platformName: PlatformState["name"]) => {
    setPlatformStates((prev) => prev.map((item) => (item.name === platformName ? { ...item, status: "completed" } : item)));
  };

  const handlePlatformComplete = async (platformName: PlatformState["name"]) => {
    if (!user.userId) {
      markPlatformCompleteLocally(platformName);
      setStatusMessage(`${platformName} marked as completed locally. Sign in to sync this across devices.`);
      return;
    }

    setSavingPlatform(platformName);

    try {
      const response = await fetch("/api/platforms/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.userId,
          platform: platformName,
        }),
      });

      const payload = (await response.json()) as {
        message?: string;
        platforms?: PlatformState[];
      };

      if (response.ok) {
        markPlatformCompleteLocally(platformName);
      }

      setStatusMessage(payload.message || `AI verified ${platformName}. You can move to the next phase.`);
    } catch {
      markPlatformCompleteLocally(platformName);
      setStatusMessage(`AI could not sync ${platformName} right now, but your local progress has been updated.`);
    } finally {
      setSavingPlatform(null);
    }
  };

  const togglePaymentAccount = (account: PaymentAccount) => {
    setSelectedAccounts((current) => {
      if (account === "None Yet") {
        return ["None Yet"];
      }

      const withoutNoneYet = current.filter((item) => item !== "None Yet");
      if (withoutNoneYet.includes(account)) {
        const next = withoutNoneYet.filter((item) => item !== account);
        return next.length > 0 ? next : ["None Yet"];
      }

      return [...withoutNoneYet, account];
    });
  };

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <h1>Career Activation Wizard</h1>
        <p>Step {step} of 5</p>
        <div className={styles.introBox}>
          <p><strong>Recovery continuity:</strong> {onboardingRecovery.safeguard}</p>
          <p>{onboardingRecovery.trustScore > 0.66 ? "Youâ€™ve maintained strong consistency." : onboardingRecovery.trustScore > 0.4 ? "Progress remains steady." : "Your direction is becoming clearer."}</p>
          {onboardingRecovery.reflections[0] && <p>{onboardingRecovery.reflections[0].message}</p>}
        </div>

        {step === 1 && (
          <div className={styles.card}>
            <h2>Step 1: Define your Income Strategy</h2>
            <div className={styles.introBox}>
              <p>I will learn your background and infer your strongest income opportunities before asking follow-up questions.</p>
              <p>Letâ€™s map your primary and secondary career tracks, then confirm payment readiness details.</p>
            </div>
            <label>
              Full Name
              <input
                value={user.name}
                onChange={(event) => setUser((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Your full name"
              />
            </label>
            <label>
              Email
              <input
                value={user.email}
                onChange={(event) => setUser((prev) => ({ ...prev, email: event.target.value }))}
                type="email"
                placeholder="you@example.com"
              />
            </label>
            <div className={styles.options}>
              {skillOptions.map((skill) => (
                <button
                  key={skill.value}
                  type="button"
                  className={user.skill === skill.value ? styles.optionActive : styles.option}
                  onClick={() => setUser((prev) => ({ ...prev, skill: skill.value }))}
                >
                  {skill.label}
                </button>
              ))}
            </div>

            <div className={styles.introBox}>
              <CareerSelector
                userId={user.userId}
                initialCareers={selectedCareers}
                onSaved={(payload) => {
                  setSelectedCareers(payload.careers);
                  setPrimaryCareer(payload.primary);
                  setSecondaryCareers(payload.secondary);
                }}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className={styles.card}>
            <h2>Step 2: Create your earning accounts</h2>
            <div className={styles.introBox}>
              <p>Platforms connected: {platformSummary.completedCount}/{platformSummary.totalCount}</p>
              <p>Status: {platformSummary.readyLabel}</p>
            </div>

            {platformStates.map((platform) => (
              <div key={platform.name} className={styles.platformRow}>
                <div className={styles.platformHeader}>
                  <div>
                  <div className={styles.introBox}>
                    <p><strong>Your AI worker is now ready.</strong></p>
                    <p>Complete this step to open your Client Portal with live career recommendations.</p>
                  </div>
                    <strong>{platform.status === "completed" ? "âœ”" : "[ ]"} {platform.name}</strong>
                    <ul>
                      {platform.checklist.map((item) => (
                        <li key={`${platform.name}-${item}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <span
                    className={`${styles.platformStatus} ${platform.status === "completed" ? styles.statusDone : styles.statusPending}`}
                  >
                    {platform.status === "completed" ? "Verified" : "Pending"}
                  </span>
                </div>

                <div className={styles.actionRow}>
                  <a href={platform.url} target="_blank" rel="noreferrer" className={styles.finishLink}>
                    Open
                  </a>
                  <button
                    type="button"
                    onClick={() => handlePlatformComplete(platform.name)}
                    disabled={platform.status === "completed" || savingPlatform === platform.name}
                  >
                    âœ” Iâ€™ve signed up
                  </button>
                </div>
              </div>
            ))}

            <p className={styles.muted}>{statusMessage}</p>

            <div className={styles.paymentSection}>
              <div className={styles.paymentHeader}>
                <div>
                  <p className={styles.muted}>International Payment Readiness</p>
                  <h3>Prepare payout rails before you apply</h3>
                </div>
                <span className={styles.paymentBadge}>{paymentReadiness.paymentReadiness}% ready</span>
              </div>

              <div className={styles.checkboxGrid}>
                {paymentAccountOptions.map((account) => (
                  <label key={account} className={styles.checkboxChip}>
                    <input
                      type="checkbox"
                      checked={selectedAccounts.includes(account)}
                      onChange={() => togglePaymentAccount(account)}
                    />
                    <span>{account}</span>
                  </label>
                ))}
              </div>

              <div className={styles.paymentFields}>
                <label>
                  Account holder name
                  <input
                    value={accountHolderName}
                    onChange={(event) => setAccountHolderName(event.target.value)}
                    placeholder="Account holder name"
                  />
                </label>
                <label>
                  Account email
                  <input
                    value={accountEmail}
                    onChange={(event) => setAccountEmail(event.target.value)}
                    type="email"
                    placeholder="Account email"
                  />
                </label>
                <label>
                  Preferred payout currency
                  <select value={payoutCurrency} onChange={(event) => setPayoutCurrency(event.target.value as PayoutCurrency)}>
                    {payoutCurrencies.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className={styles.paymentSummaryGrid}>
                <div className={styles.syncBox}>
                  <strong>Profile Completion</strong>
                  <p>{paymentReadiness.profileCompletion}%</p>
                </div>
                <div className={styles.syncBox}>
                  <strong>Remote Work Readiness</strong>
                  <p>{paymentReadiness.remoteWorkReadiness}%</p>
                </div>
                <div className={styles.syncBox}>
                  <strong>Payment Readiness</strong>
                  <p>{paymentReadiness.paymentReadiness}%</p>
                </div>
              </div>

              <div className={styles.successBox}>
                <p><strong>Missing:</strong></p>
                <ul>
                  {missingPaymentItems.length > 0 ? (
                    missingPaymentItems.map((item) => <li key={item}>âœ“ {item}</li>)
                  ) : (
                    <li>All payment readiness fields are present.</li>
                  )}
                </ul>
                <p>{paymentReadiness.guidance}</p>
                <p>Estimated setup time: {paymentReadiness.estimatedSetupTimeMinutes} minutes.</p>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className={styles.card}>
            <h2>Step 3: AI Skill Builder</h2>
            <p>Short, practical lessons only â€” enough to start earning fast.</p>
            <div className={styles.options}>
              {skillLessons.map((lesson) => (
                <div key={lesson.title} className={styles.microCard}>
                  <h3>{lesson.title}</h3>
                  <span className={styles.pill}>
                    {lesson.classification === "ai_executable" ? "AI can add this to your profile now" : "Human-required with AI guidance"}
                  </span>
                  <p>{lesson.example}</p>
                  <p><strong>Do now:</strong> {lesson.action}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className={styles.card}>
            <h2>Step 4: Auto Profile Builder</h2>
            <ul>
              {activationChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <p className={styles.muted}>AI-ready profile description</p>
            <p>{profile.profileDescription}</p>

            <p className={styles.muted}>AI Capabilities</p>
            <div className={styles.actionRow}>
              {profile.ai_capabilities.map((capability) => (
                <span key={capability} className={styles.pill}>{capability}</span>
              ))}
            </div>

            <p className={styles.muted}>Platform sync templates</p>
            <div className={styles.options}>
              {Object.entries(platformSync.templates).map(([name, description]) => (
                <div key={name} className={styles.syncBox}>
                  <strong>{name}</strong>
                  <p>{description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className={styles.card}>
            <h2>Step 5: AI Worker Activated</h2>
            <div className={styles.successBox}>
              <p><strong>Platforms:</strong> {platformSummary.completedCount}/{platformSummary.totalCount} completed</p>
              <p><strong>Skills:</strong> {skillLessons.length} practical launch lessons prepared</p>
              <p><strong>AI Capabilities:</strong> Active</p>
              <p><strong>Status:</strong> {platformSummary.readyLabel}</p>
            </div>
            <p><strong>Your AI worker is now ready.</strong></p>
            <p>Your referral loop is ready. Invite a friend and unlock a 10% earnings boost on a $1K benchmark, worth ${referralBoost.toFixed(2)}.</p>
            <p className={styles.muted}>Referral Link</p>
            <p>{referralLink}</p>
            <p className={styles.muted}>Share Post</p>
            <p>{generateSuccessPost(user.name || "I")}</p>
          </div>
        )}

        <div className={styles.navRow}>
          <button type="button" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1}>
            Back
          </button>
          {step < 5 ? (
            <button
              type="button"
              onClick={async () => {
                const next = Math.min(5, step + 1);
                if (step === 2 && !platformSummary.nextStepUnlocked) {
                  setStatusMessage("You can continue now and finish the remaining items later.");
                }
                setStep(next);
                await persistProgress(next);
              }}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              className={styles.finishLink}
              onClick={() => void handleCompleteOnboarding()}
              disabled={isCompleting}
            >
              {isCompleting ? "Activating..." : "Open Client Portal"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleRestartOnboarding()}
            disabled={isRestarting}
          >
            {isRestarting ? "Restarting..." : "Restart onboarding"}
          </button>
        </div>
      </section>
    </main>
  );
}
