"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { buildReferralLink, calculateReferralBoost, generateReferralCode, generateSuccessPost } from "../../lib/growth/referrals.ts";
import { generateProfile, type SkillTrack } from "../../lib/profile/generateProfile.ts";
import { buildMicroLessons } from "../../lib/skills/skillBuilder.ts";
import {
  buildPlatformStates,
  generatePlatformSync,
  getPlatformSummary,
  type PlatformState,
} from "../../lib/platforms/profileSync.ts";
import styles from "./page.module.css";

type UserInput = {
  name: string;
  email: string;
  skill: SkillTrack;
  country: string;
  userId: string | null;
};

const skillOptions: Array<{ value: SkillTrack; label: string }> = [
  { value: "teaching", label: "Writing / Teaching" },
  { value: "project-management", label: "Project Management" },
  { value: "admin-crm", label: "Admin Work" },
  { value: "finance-compliance", label: "Finance / Compliance" },
];

const activationChecklist = ["Profile building", "Job applications", "Proposal writing", "Fast client delivery"];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "Great — here’s the plan: create your accounts, I’ll help set up your profiles, and AI will handle what it can for you."
  );
  const [platformStates, setPlatformStates] = useState<PlatformState[]>(() => buildPlatformStates());
  const [user, setUser] = useState<UserInput>({
    name: "",
    email: "",
    skill: "admin-crm",
    country: "South Africa",
    userId: null,
  });

  useEffect(() => {
    const loadOnboardingData = async () => {
      const { data } = await supabase.auth.getUser();
      const authUser = data?.user;

      if (!authUser) {
        return;
      }

      const fullName = typeof authUser.user_metadata?.full_name === "string" ? authUser.user_metadata.full_name : "";

      setUser((prev) => ({
        ...prev,
        userId: authUser.id,
        email: prev.email || authUser.email || "",
        name: prev.name || fullName,
      }));

      const response = await fetch(`/api/platforms/status?userId=${authUser.id}`);
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { platforms?: PlatformState[] };
      if (Array.isArray(payload.platforms)) {
        setPlatformStates(payload.platforms);
      }
    };

    void loadOnboardingData();
  }, []);

  const referralCode = useMemo(() => generateReferralCode(user.email || user.name || "guest"), [user.email, user.name]);
  const referralLink = useMemo(() => buildReferralLink("", referralCode), [referralCode]);
  const profile = useMemo(() => generateProfile({ name: user.name, email: user.email, skill: user.skill }), [user]);
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

  useEffect(() => {
    if (step === 2 && platformSummary.nextStepUnlocked) {
      setStatusMessage("All earning accounts are verified. The skill-building phase is now unlocked automatically.");
      setStep(3);
    }
  }, [step, platformSummary.nextStepUnlocked]);

  const markPlatformCompleteLocally = (platformName: PlatformState["name"]) => {
    setPlatformStates((prev) => prev.map((item) => (item.name === platformName ? { ...item, status: "completed" } : item)));
  };

  const handlePlatformComplete = async (platformName: PlatformState["name"]) => {
    if (!user.userId) {
      markPlatformCompleteLocally(platformName);
      setStatusMessage(`${platformName} marked as completed locally. Sign in to sync this across devices.`);
      return;
    }

    setIsSaving(true);

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

      if (Array.isArray(payload.platforms)) {
        setPlatformStates(payload.platforms);
      } else if (response.ok) {
        markPlatformCompleteLocally(platformName);
      }

      setStatusMessage(payload.message || `AI verified ${platformName}. You can move to the next phase.`);
    } catch {
      markPlatformCompleteLocally(platformName);
      setStatusMessage(`AI could not sync ${platformName} right now, but your local progress has been updated.`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <h1>Career Activation Wizard</h1>
        <p>Step {step} of 5</p>

        {step === 1 && (
          <div className={styles.card}>
            <h2>Step 1: Choose your earning lane</h2>
            <div className={styles.introBox}>
              <p>Some tasks I can fully handle for you using AI. Others I’ll guide you through step-by-step.</p>
              <p>Let’s start with your career path and the earning accounts you’ll need.</p>
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
                    <strong>{platform.status === "completed" ? "✔" : "[ ]"} {platform.name}</strong>
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
                    disabled={platform.status === "completed" || isSaving}
                  >
                    ✔ I’ve signed up
                  </button>
                </div>
              </div>
            ))}

            <p className={styles.muted}>{statusMessage}</p>
          </div>
        )}

        {step === 3 && (
          <div className={styles.card}>
            <h2>Step 3: AI Skill Builder</h2>
            <p>Short, practical lessons only — enough to start earning fast.</p>
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
            <h2>Step 5: Ready to earn</h2>
            <div className={styles.successBox}>
              <p><strong>Platforms:</strong> {platformSummary.completedCount}/{platformSummary.totalCount} completed</p>
              <p><strong>Skills:</strong> {skillLessons.length} practical launch lessons prepared</p>
              <p><strong>AI Capabilities:</strong> Active</p>
              <p><strong>Status:</strong> {platformSummary.readyLabel}</p>
            </div>
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
              onClick={() => setStep((current) => Math.min(5, current + 1))}
              disabled={step === 2 && !platformSummary.nextStepUnlocked}
            >
              Next
            </button>
          ) : (
            <a className={styles.finishLink} href="/dashboard">
              Open Dashboard
            </a>
          )}
        </div>
      </section>
    </main>
  );
}
