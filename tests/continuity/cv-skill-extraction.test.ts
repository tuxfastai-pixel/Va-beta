import test from "node:test"
import assert from "node:assert"
import { readFileSync } from "node:fs"

import {
  validateSkillExtractionPayload,
} from "../../lib/career/cvSkillExtraction.ts"
import {
  mergeSkillExtraction,
  structureCvInput,
} from "../../lib/career/cvIntake.ts"

test("industry-neutral skill evidence is accepted only when supported by the CV", () => {
  const source = [
    "Warehouse Experience",
    "Operated handheld barcode scanners for stock receiving.",
    "Healthcare Administration",
    "Scheduled patient appointments using the clinic booking system.",
  ].join("\n")

  const evidence =
    validateSkillExtractionPayload(
      {
        skills: [
          {
            skill: "Inventory Scanning",
            evidence:
              "Operated handheld barcode scanners for stock receiving.",
            sourceSection:
              "Warehouse Experience",
            evidenceType: "explicit",
            confidence: 0.96,
          },
          {
            skill: "Patient Scheduling",
            evidence:
              "Scheduled patient appointments using the clinic booking system.",
            sourceSection:
              "Healthcare Administration",
            evidenceType: "explicit",
            confidence: 0.94,
          },
          {
            skill: "Financial Management",
            evidence:
              "Managed a departmental budget of R2 million.",
            sourceSection: "Finance",
            evidenceType: "explicit",
            confidence: 0.99,
          },
        ],
      },
      source
    )

  assert.deepEqual(
    evidence.map((item) => item.skill),
    [
      "Inventory Scanning",
      "Patient Scheduling",
    ]
  )
})

test("inferred or low-confidence skills require confirmation", () => {
  const source =
    "Position Held: Teller"

  const evidence =
    validateSkillExtractionPayload(
      {
        skills: [
          {
            skill:
              "Transaction Reconciliation",
            evidence:
              "Position Held: Teller",
            sourceSection:
              "Career History",
            evidenceType: "inferred",
            confidence: 0.76,
          },
        ],
      },
      source
    )

  assert.equal(evidence.length, 1)
  assert.equal(
    evidence[0].requiresConfirmation,
    true
  )
})

test("proficiency labels cannot become skills", () => {
  const source =
    "Advanced Solid Expert Intermediate Basic"

  const evidence =
    validateSkillExtractionPayload(
      {
        skills: [
          {
            skill: "Advanced",
            evidence: "Advanced",
            sourceSection: "Skills",
            evidenceType: "explicit",
            confidence: 0.99,
          },
          {
            skill: "Expert",
            evidence: "Expert",
            sourceSection: "Skills",
            evidenceType: "explicit",
            confidence: 0.99,
          },
        ],
      },
      source
    )

  assert.equal(evidence.length, 0)
})

test("confirmed AI skills merge without promoting inferred candidates", () => {
  const structured =
    structureCvInput({
      mode: "paste",
      rawText: [
        "CURRICULUM VITAE OF PILOT USER",
        "Skills",
        "Communication",
        "Career History",
        "Company: Example",
        "Position Held: Operator",
        "Employment period: 2020 to 2024",
        "Career Aspirations",
        "Operations role",
      ].join("\n"),
    })

  const merged =
    mergeSkillExtraction(
      structured,
      {
        confirmedSkills: [
          "Inventory Control",
        ],
        evidence: [
          {
            skill: "Inventory Control",
            evidence:
              "Position Held: Operator",
            sourceSection:
              "Career History",
            evidenceType: "explicit",
            confidence: 0.9,
            requiresConfirmation: false,
          },
          {
            skill:
              "Financial Management",
            evidence:
              "Position Held: Operator",
            sourceSection:
              "Career History",
            evidenceType: "inferred",
            confidence: 0.6,
            requiresConfirmation: true,
          },
        ],
        pendingSkills: [
          {
            skill:
              "Financial Management",
            evidence:
              "Position Held: Operator",
            sourceSection:
              "Career History",
            evidenceType: "inferred",
            confidence: 0.6,
            requiresConfirmation: true,
          },
        ],
        mode: "ai",
      }
    )

  assert.equal(
    merged.skills.includes(
      "Inventory Control"
    ),
    true
  )

  assert.equal(
    merged.skills.includes(
      "Financial Management"
    ),
    false
  )

  assert.equal(
    merged.skillsNeedingConfirmation
      .length,
    1
  )
})

test("numbered employers and work-type headings do not create phantom jobs", () => {
  const structured =
    structureCvInput({
      mode: "paste",
      rawText: [
        "CURRICULUM VITAE OF PILOT USER",
        "Career History",
        "Full time",
        "1) Company: First Employer",
        "Position Held: Technician",
        "Responsibilities: Maintained equipment.",
        "Employment period: 2020 to 2022",
        "Part time",
        "2) Company: Second Employer",
        "Position Held: Teller",
        "Responsibilities: Cashier",
        "Employment period: one year",
        "Career Aspirations",
        "To build a stable career.",
        "Skills",
        "Communication",
      ].join("\n"),
    })

  assert.equal(
    structured.workExperience.length,
    2
  )

  assert.match(
    structured.workExperience[0],
    /First Employer/
  )

  assert.match(
    structured.workExperience[1],
    /Second Employer/
  )
})
test("CV skill extraction request avoids unsupported stored metadata", () => {
  const extractorSource = readFileSync(
    new URL(
      "../../lib/career/cvSkillExtraction.ts",
      import.meta.url
    ),
    "utf8"
  )

  assert.equal(
    extractorSource.includes(
      'operation: "cv_skill_extraction"'
    ),
    false
  )

  assert.equal(
    extractorSource.includes(
      "telemetry:"
    ),
    false
  )
})

test("failed AI extraction cannot masquerade as a successful review", () => {
  const routeSource = readFileSync(
    new URL(
      "../../app/api/career/cv-intake/route.ts",
      import.meta.url
    ),
    "utf8"
  )

  const reviewSource = readFileSync(
    new URL(
      "../../components/career-activation/ProfileReviewStage.tsx",
      import.meta.url
    ),
    "utf8"
  )

  assert.match(
    routeSource,
    /CV_SKILL_EXTRACTION_FAILED/
  )

  assert.match(
    routeSource,
    /status: 502/
  )

  assert.match(
    reviewSource,
    /Limited parser only/
  )
})

test("pending skill evidence is confirmation-gated and approved skills update the profile", async () => {
  const {
    collectPendingSkillReviewCandidates,
    applyApprovedCvChange,
  } = await import(
    "../../lib/career/cvProfilePromotion.ts"
  )

  const profile = {
    skills: ["Microsoft Office"],
    skillEvidence: [
      {
        skill: "Cash Reconciliation",
        evidence:
          "Counted, balanced, and reconciled cash and daily takings.",
        requiresConfirmation: true,
      },
    ],
    skillsNeedingConfirmation: [
      {
        skill: "Cash Reconciliation",
        evidence:
          "Counted, balanced, and reconciled cash and daily takings.",
        requiresConfirmation: true,
      },
    ],
  }

  const candidates =
    collectPendingSkillReviewCandidates(
      profile
    )

  assert.deepEqual(candidates, [
    {
      skill: "Cash Reconciliation",
      sourceEvidence:
        "Counted, balanced, and reconciled cash and daily takings.",
      requiresConfirmation: true,
    },
  ])

  const promoted =
    applyApprovedCvChange(
      profile,
      {
        section: "skills",
        originalText:
          "Cash Reconciliation",
        proposedText:
          "Cash Handling and Reconciliation",
      }
    )

  assert.deepEqual(
    promoted.skills,
    [
      "Microsoft Office",
      "Cash Handling and Reconciliation",
    ]
  )

  assert.deepEqual(
    promoted.skillsNeedingConfirmation,
    []
  )
})

test("approved professional summary replaces the canonical summary", async () => {
  const {
    applyApprovedCvChange,
  } = await import(
    "../../lib/career/cvProfilePromotion.ts"
  )

  const promoted =
    applyApprovedCvChange(
      {
        professionalSummary:
          "Old summary",
      },
      {
        section:
          "professional_summary",
        originalText:
          "Old summary",
        proposedText:
          "Evidence-controlled professional summary",
      }
    )

  assert.equal(
    promoted.professionalSummary,
    "Evidence-controlled professional summary"
  )
})


test("section extraction stops before project and governance headings", () => {
  const structured = structureCvInput({
    mode: "upload",
    rawText: [
      "Kamogelo Omphile Sentle",
      "Skills",
      "- Product vision",
      "- Requirements definition",
      "Selected Project Experience",
      "Founder and AI Product Lead, VA-Beta",
      "- Defined the product roadmap.",
      "Corporate Governance and Evidence Support",
      "- Organised company records.",
    ].join("\n"),
  })

  assert.deepEqual(
    structured.skills,
    [
      "Product vision",
      "Requirements definition",
    ]
  )
  assert.equal(
    structured.skills.some((skill) =>
      /Founder|Governance|Organised/.test(skill)
    ),
    false
  )
})

test("oversized leaked paragraphs cannot become individual skills", () => {
  const structured = structureCvInput({
    mode: "upload",
    rawText: [
      "Kamogelo Omphile Sentle",
      "Skills",
      "Technical support",
      "This is an incorrectly merged paragraph that is intentionally longer than eighty characters and must not be presented as one skill.",
    ].join("\n"),
  })

  assert.deepEqual(
    structured.skills,
    ["Technical support"]
  )
})


test("successful AI extraction becomes authoritative for confirmed skills", () => {
  const structured = structureCvInput({
    mode: "upload",
    rawText: [
      "Pilot User",
      "Skills",
      "Capability",
      "Demonstrated knowledge and experience",
      "Technical Support",
    ].join("\n"),
  })

  const merged = mergeSkillExtraction(structured, {
    confirmedSkills: ["Technical Support"],
    evidence: [{
      skill: "Technical Support",
      evidence: "Technical Support",
      sourceSection: "Skills",
      evidenceType: "explicit",
      confidence: 0.98,
      requiresConfirmation: false,
    }],
    pendingSkills: [],
    mode: "ai",
  })

  assert.deepEqual(merged.skills, ["Technical Support"])
})

test("career profile curation removes headings, groups skills and counts real records", async () => {
  const {
    curateSkillGroups,
    summarizeExperience,
  } = await import("../../lib/career/profileCuration.ts")

  const profile = {
    skills: ["Capability", "React", "Technical Support", "Evidence indexing"],
    skillEvidence: [
      { skill: "React", confidence: 0.95 },
      { skill: "Technical Support", confidence: 0.9 },
    ],
    workExperience: [
      "Company: Example\nPosition: Technician\nResponsibilities: Support",
      "Company: Second\nPosition: Analyst\nResponsibilities: Review",
    ],
  }

  assert.deepEqual(
    curateSkillGroups(profile).flatMap((group) => group.skills),
    ["React", "Technical Support", "Evidence indexing"]
  )
  assert.deepEqual(summarizeExperience(profile), {
    roleCount: 2,
    evidenceCount: 2,
  })
})

test("skill candidates require an explicit user decision", async () => {
  const {
    applySkillCandidateDecision,
  } = await import("../../lib/career/profileCuration.ts")

  const profile = {
    skills: ["React"],
    skillsNeedingConfirmation: [{
      skill: "AI Product Development",
      evidence: "AI product and delivery",
      requiresConfirmation: true,
    }],
    skillEvidence: [{
      skill: "AI Product Development",
      evidence: "AI product and delivery",
      requiresConfirmation: true,
    }],
  }

  const confirmed = applySkillCandidateDecision(profile, {
    skill: "AI Product Development",
    decision: "confirm",
    editedSkill: "AI Product Delivery",
  })

  assert.deepEqual(confirmed.skills, ["React", "AI Product Delivery"])
  assert.deepEqual(confirmed.skillsNeedingConfirmation, [])

  const rejected = applySkillCandidateDecision(profile, {
    skill: "AI Product Development",
    decision: "reject",
  })

  assert.deepEqual(rejected.skills, ["React"])
  assert.deepEqual(rejected.skillsNeedingConfirmation, [])
  assert.deepEqual(rejected.rejectedSkillCandidates, ["AI Product Development"])
})

test("profile details resolve the matching follow-up questions", async () => {
  const {
    applyProfileDetails,
  } = await import("../../lib/career/profileCuration.ts")

  const updated = applyProfileDetails({
    missingFields: ["professional_summary", "preferred_roles"],
    followUpQuestions: [
      "Share a 2-3 sentence professional summary focused on your strongest outcomes.",
      "Which roles are you targeting first in this activation cycle?",
    ],
  }, {
    professionalSummary: "Evidence-led AI product and technical support professional focused on responsible career systems.",
    preferredRoles: ["AI Product Manager", "Technical Support Lead"],
  })

  assert.deepEqual(updated.missingFields, [])
  assert.deepEqual(updated.followUpQuestions, [])
})
