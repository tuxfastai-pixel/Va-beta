import test from "node:test"
import assert from "node:assert"

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