import { test } from "node:test"
import assert from "node:assert"
import {
  buildContinuityCheckpoint,
  canClaimSkillOnCv,
  resolveRecommendationBand,
  resolveResumeStepOnLoad,
  type ActivationStateRecord,
} from "../../lib/career/activationContinuity.ts"

test("Step 5 completion checkpoint carries continuity payload and completion semantics", () => {
  const checkpoint = buildContinuityCheckpoint({
    userId: "u-1",
    completedStep: 5,
    payload: {
      name: "Pilot User",
      email: "pilot@example.com",
      skillTrack: "admin-crm",
      selectedCareers: ["customer-support"],
      primaryCareer: "customer-support",
      secondaryCareers: ["writer"],
      paymentReadiness: {
        selectedAccounts: ["Wise"],
        accountHolderName: "Pilot User",
        accountEmail: "pilot@example.com",
        payoutCurrency: "USD",
        paymentReadinessScore: 80,
        paymentMissing: [],
      },
      internationalReadiness: {
        remoteReadinessScore: 72,
        profileCompletionScore: 88,
        internationalReadinessScore: 76,
      },
    },
  })

  assert.equal(checkpoint.completedStep, 5)
  assert.equal(checkpoint.userId, "u-1")
  assert.equal(checkpoint.careerLanes.primary, "customer-support")
  assert.equal(checkpoint.paymentReadiness.payoutCurrency, "USD")
})

test("Completed user is not routed back to step 1; incomplete user resumes last valid step", () => {
  const completed: ActivationStateRecord = {
    userId: "u-1",
    onboardingCompleted: true,
    completedStep: 5,
    lastValidStep: 5,
    completionTimestamp: new Date().toISOString(),
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

  const completedResume = resolveResumeStepOnLoad(completed)
  assert.equal(completedResume.completed, true)
  assert.equal(completedResume.onboardingStep, 5)

  const inProgress: ActivationStateRecord = {
    ...completed,
    onboardingCompleted: false,
    completedStep: 3,
    lastValidStep: 4,
    completionTimestamp: null,
  }

  const inProgressResume = resolveResumeStepOnLoad(inProgress)
  assert.equal(inProgressResume.completed, false)
  assert.equal(inProgressResume.onboardingStep, 4)
})

test("Recommendation threshold bands follow 75/60 policy", () => {
  assert.equal(resolveRecommendationBand(85), "recommended_to_apply")
  assert.equal(resolveRecommendationBand(68), "possible_with_preparation")
  assert.equal(resolveRecommendationBand(45), "not_currently_recommended")
})

test("Learning skill states cannot be claimed as active CV skills before demonstrated evidence", () => {
  assert.equal(canClaimSkillOnCv("Missing"), false)
  assert.equal(canClaimSkillOnCv("Learning"), false)
  assert.equal(canClaimSkillOnCv("Practised"), false)
  assert.equal(canClaimSkillOnCv("Demonstrated"), true)
  assert.equal(canClaimSkillOnCv("Verified"), true)
})