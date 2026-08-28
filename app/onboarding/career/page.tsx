"use client"

import { useMemo, useState } from "react"
import type { CareerIdentityProfile, CareerReconstructionOutput } from "@/lib/career/careerTypes.ts"
import {
  paymentAccountOptions,
  payoutCurrencies,
  scoreInternationalPaymentReadiness,
} from "@/lib/career/internationalPaymentReadiness.ts"
import WelcomeCard from "@/components/career/WelcomeCard"
import TrustTransparencyPanel from "@/components/career/TrustTransparencyPanel"
import HumanControlPanel from "@/components/career/HumanControlPanel"
import DataPrivacyControls from "@/components/career/DataPrivacyControls"
import PauseAutonomyButton from "@/components/career/PauseAutonomyButton"
import CareerIdentityCard from "@/components/career/CareerIdentityCard"
import AIResumeDiffViewer from "@/components/career/AIResumeDiffViewer"
import SkillExpansionPanel from "@/components/career/SkillExpansionPanel"
import ConfidenceReinforcementPanel from "@/components/career/ConfidenceReinforcementPanel"
import styles from "./page.module.css"

type ProfileResponse = {
  profile: CareerIdentityProfile
  reconstruction: CareerReconstructionOutput
  questions: Array<{ id: string; prompt: string; required: boolean }>
}

export default function CareerOnboardingPage() {
  const [paused, setPaused] = useState(false)
  const [status, setStatus] = useState("Choose a starting point: upload CV, share LinkedIn context, tell your story, or start from scratch.")
  const [resumeText, setResumeText] = useState("")
  const [conversationText, setConversationText] = useState("")
  const [existingAccounts, setExistingAccounts] = useState<string[]>([])
  const [accountHolderName, setAccountHolderName] = useState("")
  const [accountEmail, setAccountEmail] = useState("")
  const [preferredPayoutCurrency, setPreferredPayoutCurrency] = useState("")
  const [hasTaxInformation, setHasTaxInformation] = useState(false)
  const [hasInternationalBankingPreference, setHasInternationalBankingPreference] = useState(false)
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<CareerIdentityProfile | null>(null)
  const [reconstruction, setReconstruction] = useState<CareerReconstructionOutput | null>(null)
  const [questions, setQuestions] = useState<Array<{ id: string; prompt: string; required: boolean }>>([])
  const safeExistingAccounts = existingAccounts ?? []

  const confidenceNotes = useMemo(() => {
    if (!profile) {
      return ["No confidence profile yet. Complete intake to generate one."]
    }

    return [
      ...profile.trustNotes,
      ...profile.pacingNotes,
      `Overall readiness ${Math.round(profile.overallReadiness * 100)}%`,
    ]
  }, [profile])

  const paymentReadiness = useMemo(
    () =>
      scoreInternationalPaymentReadiness({
        existingAccounts: safeExistingAccounts as Array<(typeof paymentAccountOptions)[number]>,
        noneYet: safeExistingAccounts.length === 0,
        accountHolderName,
        accountEmail,
        preferredPayoutCurrency,
        hasTaxInformation,
        hasInternationalBankingPreference,
      }),
    [accountEmail, accountHolderName, hasInternationalBankingPreference, hasTaxInformation, preferredPayoutCurrency, safeExistingAccounts],
  )

  async function handleTextFileUpload(file: File) {
    const text = await file.text()
    setResumeText(text)
    setStatus(`Loaded ${file.name}. Ready for identity reconstruction.`)
  }

  async function runIntake() {
    setLoading(true)
    setStatus("Building career identity profile...")

    try {
      const response = await fetch("/api/career/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          conversationText,
          preferences: {
            quietMode: paused,
          },
        }),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        setStatus(payload.error || "Could not build profile.")
        return
      }

      const payload = (await response.json()) as ProfileResponse
      setProfile(payload.profile)
      setReconstruction(payload.reconstruction)
      setQuestions(payload.questions)
      setStatus("Career identity profile generated. You can now review reconstruction and matches.")
    } catch {
      setStatus("Profile generation failed. Try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.grid}>
        <WelcomeCard />
        <TrustTransparencyPanel />
        <HumanControlPanel
          onPause={() => setPaused(true)}
          onQuietMode={() => setPaused(true)}
          onDisableSuggestions={() => setStatus("Suggestions disabled for this onboarding session.")}
        />
        <DataPrivacyControls
          onExport={() => setStatus("Profile export request captured. Download endpoint can be wired to your account store.")}
          onDelete={() => setStatus("Profile deletion request captured. Governance review required before delete.")}
        />
      </div>

      <section className={styles.intakeCard}>
        <div className={styles.intakeHeader}>
          <h2>Step 1: AI Background Intake</h2>
          <PauseAutonomyButton paused={paused} onToggle={() => setPaused((current) => !current)} />
        </div>

        <div className={styles.paymentSummary}>
          <p><strong>Fast start options:</strong> Upload your CV, paste your LinkedIn summary, tell me about yourself, or start from scratch.</p>
          <p>The AI will infer what it can first, then ask only for missing clarifications.</p>
        </div>

        <label className={styles.label}>
          Upload resume (TXT/PDF/DOCX/image)
          <input
            type="file"
            accept=".txt,.pdf,.docx,.png,.jpg,.jpeg,.webp"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) {
                return
              }
              void handleTextFileUpload(file)
            }}
          />
        </label>

        <label className={styles.label}>
          Conversational career intake
          <textarea
            value={conversationText}
            onChange={(event) => setConversationText(event.target.value)}
            placeholder="Tell us what you have done, what you are naturally good at, and what kind of work you want."
            rows={6}
          />
        </label>

        <section className={styles.paymentSection}>
          <h3>International Payment Readiness</h3>

          <div className={styles.paymentOptions}>
            {paymentAccountOptions.map((account) => {
              const checked = safeExistingAccounts.includes(account)
              return (
                <label key={account} className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      setExistingAccounts((current) => {
                        if (event.target.checked) {
                          return current.includes(account) ? current : [...current, account]
                        }

                        return current.filter((item) => item !== account)
                      })
                    }}
                  />
                  <span>{account.charAt(0).toUpperCase() + account.slice(1)}</span>
                </label>
              )
            })}
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={safeExistingAccounts.length === 0}
                onChange={(event) => {
                  if (event.target.checked) {
                    setExistingAccounts([])
                  }
                }}
              />
              <span>None Yet</span>
            </label>
          </div>

          <div className={styles.paymentGrid}>
            <label className={styles.label}>
              Account holder name
              <input value={accountHolderName} onChange={(event) => setAccountHolderName(event.target.value)} placeholder="Your legal name" />
            </label>
            <label className={styles.label}>
              Account email
              <input value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} placeholder="you@example.com" />
            </label>
            <label className={styles.label}>
              Preferred payout currency
              <select value={preferredPayoutCurrency} onChange={(event) => setPreferredPayoutCurrency(event.target.value)}>
                <option value="">Select currency</option>
                {payoutCurrencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.paymentOptions}>
            <label className={styles.checkboxRow}>
              <input type="checkbox" checked={hasTaxInformation} onChange={(event) => setHasTaxInformation(event.target.checked)} />
              <span>I have tax information ready</span>
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={hasInternationalBankingPreference}
                onChange={(event) => setHasInternationalBankingPreference(event.target.checked)}
              />
              <span>I have an international banking preference</span>
            </label>
          </div>

          <div className={styles.paymentSummary}>
            <p><strong>International Payment Readiness:</strong> {paymentReadiness.score}%</p>
            <p><strong>Missing:</strong> {paymentReadiness.missing.join(", ") || "Nothing missing"}</p>
          </div>
        </section>

        <button type="button" onClick={() => void runIntake()} disabled={loading} className={styles.primaryButton}>
          {loading ? "Processing..." : "Build career identity"}
        </button>

        <p className={styles.status}>{status}</p>

        {questions.length > 0 && (
          <div className={styles.questions}>
            <p className={styles.questionsTitle}>Adaptive follow-up questions</p>
            <ul>
              {questions.map((question) => (
                <li key={question.id}>{question.prompt}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className={styles.grid}>
        <CareerIdentityCard profile={profile} />
        <SkillExpansionPanel
          skills={profile?.translatedSkills || []}
          hiddenSkills={profile?.hiddenSkills || []}
          recommendedRoles={profile?.recommendedRoles || []}
        />
        <ConfidenceReinforcementPanel confidence={profile?.profileConfidence || 0} notes={confidenceNotes} />
      </div>

      <AIResumeDiffViewer
        originalText={resumeText || conversationText}
        reconstructedText={reconstruction?.remoteReadyCv || reconstruction?.atsCv || ""}
      />
    </main>
  )
}
