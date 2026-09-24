import { test } from "node:test"
import assert from "node:assert"
import { readFile } from "node:fs/promises"
import { structureCvInput } from "../../lib/career/cvIntake.ts"
import {
  assessJobFit,
  parseJobDescription,
} from "../../lib/career/jobAssessment.ts"
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
test("Traditional CV headings produce an evidence-based structured profile", () => {
  const structured = structureCvInput({
    mode: "paste",
    rawText: [
      "CURRICULUM VITAE OF KAMOGELO OMPHILE SENTLE",
      "Career History",
      "- Technical Support Technician at Example Company",
      "Computer Literacy",
      "- Technical support",
      "- PC networking",
      "Career Aspirations",
      "To provide systems support and develop reliable software.",
      "Preferred Roles",
      "- Technical Support Specialist",
    ].join("\n"),
  })

  assert.equal(
    structured.fullName,
    "KAMOGELO OMPHILE SENTLE"
  )
  assert.equal(structured.workExperience.length, 1)
  assert.equal(
    structured.workExperience[0],
    "Technical Support Technician at Example Company"
  )
  assert.equal(
    structured.skills.includes("Technical support"),
    true
  )
  assert.equal(
    structured.skills.includes("PC networking"),
    true
  )
  assert.match(
    structured.professionalSummary,
    /systems support/i
  )
})

test("Labelled career history is grouped into complete employment records", () => {
  const structured = structureCvInput({
    mode: "paste",
    rawText: [
      "CURRICULUM VITAE OF PILOT USER",
      "Career History",
      "Company:",
      "Lesedi Restaurant and Liquor Store",
      "Position Held:",
      "Teller",
      "Responsibilities:",
      "Cashier",
      "Employment Period:",
      "One year",
      "Company:",
      "Example Technology",
      "Position Held:",
      "Technician",
      "Responsibilities:",
      "Hardware and software support",
      "Employment Period:",
      "2020 - 2021",
      "Computer Literacy",
      "Technical support",
    ].join("\n"),
  })

  assert.equal(
    structured.workExperience.length,
    2
  )

  assert.match(
    structured.workExperience[0],
    /Company: Lesedi Restaurant and Liquor Store/
  )

  assert.match(
    structured.workExperience[0],
    /Position: Teller/
  )

  assert.match(
    structured.workExperience[0],
    /Responsibilities: Cashier/
  )

  assert.match(
    structured.workExperience[0],
    /Employment period: One year/
  )

  assert.match(
    structured.workExperience[1],
    /Position: Technician/
  )
})

test("Empty CV input remains visibly incomplete", () => {
  const structured = structureCvInput({
    mode: "paste",
    rawText: "",
    onboardingFallback: {
      name: "Pilot User",
      selectedCareers: [],
    },
  })

  assert.equal(structured.workExperience.length, 0)
  assert.equal(structured.skills.length, 0)
  assert.equal(
    structured.missingFields.includes("work_experience"),
    true
  )
  assert.equal(
    structured.followUpQuestions.length > 0,
    true
  )
})
test("Proficiency legends become individual ATS skills", () => {
  const structured = structureCvInput({
    mode: "paste",
    rawText: [
      "CURRICULUM VITAE OF PILOT USER",
      "Computer Literacy",
      "Advanced, Solid, Subject Matter Expert (SME), Intermediate or Basic: MS Office XP (Word, Excel, PowerPoint, Outlook) (Advanced), Internet (Solid), MS Project '98 (Basic), Visio 2007",
      "Preferred Roles",
      "Technical Support Specialist",
    ].join("\n"),
  })

  assert.deepEqual(
    structured.skills,
    [
      "MS Office XP (Word, Excel, PowerPoint, Outlook) (Advanced)",
      "Internet (Solid)",
      "MS Project '98 (Basic)",
      "Visio 2007",
    ]
  )
})

test("CV enhancement uses stable evidence IDs and never presents a cosmetic fallback", async () => {
  const route = await readFile(
    new URL(
      "../../app/api/career/cv-enhance/route.ts",
      import.meta.url
    ),
    "utf8"
  )

  const intake = await readFile(
    new URL(
      "../../components/career-activation/CvIntakeStage.tsx",
      import.meta.url
    ),
    "utf8"
  )

  const review = await readFile(
    new URL(
      "../../components/career-activation/CvImprovementsStage.tsx",
      import.meta.url
    ),
    "utf8"
  )

  assert.match(route, /evidenceId/)
  assert.match(route, /generationMode: "failed"/)
  assert.doesNotMatch(
    route,
    /telemetry:/
  )
  assert.match(route, /status: 502/)
  assert.doesNotMatch(
    route,
    /deterministicFallback/
  )
  assert.doesNotMatch(
    route,
    /Normalize spacing while preserving/
  )
  assert.match(
    intake,
    /generationMode !== "ai"/
  )
  assert.match(
    review,
    /View supporting CV evidence/
  )
})


test("job assessment separates transferable sales evidence from unsupported CRM and leadership", () => {
  const parsedJob = parseJobDescription({
    title: "Inbound Sales Consultant",
    description: [
      "Required skills:",
      "Sales experience and CRM proficiency.",
      "Leadership experience is required.",
    ].join("\n"),
  })

  const result = assessJobFit({
    parsedJob,
    profile: {
      translatedSkills: ["Customer Service"],
      hiddenSkills: [],
      evidenceText: [
        "Position: Teller",
        "Processed customer transactions using cash at the till point.",
        "Handled sales and provided customer service.",
        "Counted, balanced and reconciled daily cash takings.",
      ],
      profileConfidence: 0.85,
      internationalPaymentReadinessScore: 50,
    },
  })

  assert.deepEqual(result.verifiedSkills, [])
  assert.deepEqual(result.transferableSkills, ["Sales"])
  assert.deepEqual(result.missingSkills, ["CRM", "Leadership"])
  assert.ok(result.scores.matchScore > 15)
})

test("preferred skills are not penalised as required job gaps", () => {
  const parsedJob = parseJobDescription({
    title: "Support Consultant",
    description: [
      "Requirements:",
      "Customer service and technical support experience.",
      "Leadership would be an advantage.",
    ].join("\n"),
  })

  assert.deepEqual(parsedJob.requiredSkills, [
    "Customer Service",
    "Technical Support",
  ])
  assert.deepEqual(parsedJob.preferredSkills, [
    "Leadership",
  ])
})

test("job requirement sections include unmarked lines and stop before benefits", () => {
  const parsedJob = parseJobDescription({
    title: "Support Analyst",
    description: [
      "Requirements:",
      "Technical support and customer service",
      "Microsoft Excel",
      "Preferred skills:",
      "Leadership",
      "Benefits:",
      "Project management training",
    ].join("\n"),
  })

  assert.deepEqual(parsedJob.requiredSkills, [
    "Microsoft Excel",
    "Customer Service",
    "Technical Support",
  ])
  assert.deepEqual(parsedJob.preferredSkills, ["Leadership"])
  assert.equal(parsedJob.requiredSkills.includes("Project Management"), false)
})


test("Jobs stage uses automatic approved-feed discovery before manual fallback", async () => {
  const route = await readFile(
    new URL(
      "../../app/api/career/recommended-jobs/route.ts",
      import.meta.url
    ),
    "utf8"
  )

  const hunter = await readFile(
    new URL(
      "../../lib/jobs/opportunityHunter.ts",
      import.meta.url
    ),
    "utf8"
  )

  const stage = await readFile(
    new URL(
      "../../components/career-activation/JobDiscoveryStage.tsx",
      import.meta.url
    ),
    "utf8"
  )

  assert.match(route, /runOpportunityHunter/)
  assert.match(hunter, /https:\/\/remotive\.com\/api\/remote-jobs/)
  assert.match(hunter, /https:\/\/remoteok\.com\/api/)
  assert.doesNotMatch(hunter, /playwright|indeed|upwork/i)
  assert.match(stage, /await searchForJobs\(true\)/)
  assert.match(stage, /Manual fallback: paste a job/)
  assert.match(stage, /never submits an application without your review and approval/i)
})
