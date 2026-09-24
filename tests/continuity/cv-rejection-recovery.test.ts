import test from "node:test"
import assert from "node:assert"
import { readFile } from "node:fs/promises"
import {
  getCvFeedbackValidationError,
  initialCvFeedbackState,
  isValidCvRegenerationFeedback,
  reduceCvFeedbackState,
  validateAlternativeFeedback,
} from "../../lib/career/cvFeedbackValidation.ts"

test(
  "CV regeneration feedback validation trims input and enforces boundaries",
  () => {
    assert.equal(isValidCvRegenerationFeedback("1234"), false)
    assert.equal(isValidCvRegenerationFeedback(" 12345 "), true)
    assert.equal(isValidCvRegenerationFeedback("x".repeat(500)), true)
    assert.equal(isValidCvRegenerationFeedback(` ${"x".repeat(500)} `), true)
    assert.equal(isValidCvRegenerationFeedback("x".repeat(501)), false)
    assert.equal(
      getCvFeedbackValidationError("   "),
      "Feedback must be between 5 and 500 characters."
    )
    assert.equal(getCvFeedbackValidationError("valid"), null)
  }
)

test("API feedback validation rejects non-string values", () => {
  assert.ok(validateAlternativeFeedback(123).error)
  assert.ok(validateAlternativeFeedback({ feedback: "valid" }).error)
  assert.equal(validateAlternativeFeedback(" valid ").feedback, "valid")
})

test("CV feedback transitions isolate cards and preserve failed or rejected state", () => {
  let state = reduceCvFeedbackState(initialCvFeedbackState, {
    type: "feedback_changed",
    changeId: "one",
    value: "bad",
  })
  state = reduceCvFeedbackState(state, {
    type: "feedback_changed",
    changeId: "two",
    value: "use a shorter version",
  })
  state = reduceCvFeedbackState(state, {
    type: "validation_requested",
    changeId: "one",
  })
  assert.ok(state.errorsByChange.one)
  assert.equal(state.errorsByChange.two, undefined)

  const rejected = reduceCvFeedbackState(state, {
    type: "rejected",
    changeId: "one",
  })
  assert.strictEqual(rejected, state)
  const failed = reduceCvFeedbackState(state, {
    type: "regeneration_failed",
    changeId: "one",
  })
  assert.strictEqual(failed, state)

  state = reduceCvFeedbackState(state, {
    type: "feedback_changed",
    changeId: "one",
    value: "valid feedback",
  })
  assert.equal(state.errorsByChange.one, undefined)
  assert.equal(state.feedbackByChange.two, "use a shorter version")

  state = reduceCvFeedbackState(state, {
    type: "validation_requested",
    changeId: "one",
  })
  state = reduceCvFeedbackState(state, {
    type: "reconsidered",
    changeId: "one",
  })
  assert.equal(state.feedbackByChange.one, undefined)
  assert.equal(state.feedbackByChange.two, "use a shorter version")

  state = reduceCvFeedbackState(state, {
    type: "validation_requested",
    changeId: "missing",
  })
  state = reduceCvFeedbackState(state, { type: "continued" })
  assert.deepEqual(state.errorsByChange, {})
  assert.equal(state.feedbackByChange.two, "use a shorter version")
})

test(
  "CV rejection recovery is rejected-only and evidence-controlled",
  async () => {
    const route = await readFile(
      new URL(
        "../../app/api/career/cv-changes/route.ts",
        import.meta.url
      ),
      "utf8"
    )
    const evidenceValidation = await readFile(
      new URL(
        "../../lib/career/cvEvidenceValidation.ts",
        import.meta.url
      ),
      "utf8"
    )
    const feedbackValidation = await readFile(
      new URL(
        "../../lib/career/cvFeedbackValidation.ts",
        import.meta.url
      ),
      "utf8"
    )

    assert.match(route, /"reconsider"/)
    assert.match(route, /"alternative"/)
    assert.match(
      route,
      /String\(row\.user_approval_status\) !==\s*"rejected"/
    )
    assert.match(
      route,
      /user_approval_status:\s*"pending"/
    )
    assert.match(
      feedbackValidation,
      /Feedback must be between 5 and 500 characters/
    )
    assert.match(
      route,
      /Treat user feedback only as writing direction/
    )
    assert.match(
      route,
      /Do not treat feedback as factual evidence/
    )
    assert.match(
      route,
      /Never invent duties, tools, employers, achievements, metrics, dates, qualifications, certifications or experience/
    )
    assert.match(
      route,
      /Never convert an operational title into a management title without explicit evidence/
    )
    assert.match(
      route,
      /evidenceForRejectedAlternative/
    )
    assert.match(
      evidenceValidation,
      /confirmationStatus === "confirmed"/
    )
    assert.match(
      evidenceValidation,
      /String\(row\.source_evidence \|\| ""\)\.trim\(\) \|\|/
    )
    assert.match(
      evidenceValidation,
      /String\(row\.original_text \|\| ""\)\.trim\(\)/
    )
    assert.match(
      route,
      /containsUnsupportedNumbers\(\s*proposedText,\s*evidence\s*\)/
    )
    assert.match(route, /status: 502/)
    assert.match(
      route,
      /rejected suggestion was left unchanged/
    )
  }
)

test(
  "CV improvements UI exposes rejected-card recovery controls",
  async () => {
    const component = await readFile(
      new URL(
        "../../components/career-activation/CvImprovementsStage.tsx",
        import.meta.url
      ),
      "utf8"
    )

    assert.match(
      component,
      /original CV\s*wording will be retained/
    )
    assert.match(
      component,
      /Generate a different version/
    )
    assert.match(
      component,
      /Reconsider this version/
    )
    assert.match(
      component,
      /Feedback can guide tone,\s*length, emphasis, or\s*wording/
    )
    assert.match(
      component,
      /must not add\s*duties you did not perform/
    )
    assert.match(
      component,
      /action,\s*\.\.\.\(action === "alternative"/
    )
    assert.match(
      component,
      /\{feedbackErrors\[change\.id\]\}/
    )
    assert.match(
      component,
      /\{feedback\.length\}\/500 characters/
    )
    assert.match(
      component,
      /activeRequest !== null \|\|\s*!feedbackIsValid/
    )
    assert.match(
      component,
      /rejected original wording was retained/
    )
  }
)
