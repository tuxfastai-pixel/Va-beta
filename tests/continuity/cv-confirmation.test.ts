import test from "node:test"
import assert from "node:assert"
import {
  buildConfirmedEvidence,
  canApproveCvChange,
  validateConfirmationAnswers,
  validateConfirmationQuestions,
} from "../../lib/career/cvConfirmation.ts"

test(
  "confirmation questions are bounded and normalized",
  () => {
    const questions =
      validateConfirmationQuestions([
        {
          id: "Till Balancing",
          prompt:
            "Did you balance or reconcile the till?",
        },
        {
          id: "payment_methods",
          prompt:
            "Did you process both cash and card payments?",
        },
        {
          id: "Till Balancing",
          prompt: "Duplicate question",
        },
      ])

    assert.deepEqual(questions, [
      {
        id: "till-balancing",
        prompt:
          "Did you balance or reconcile the till?",
      },
      {
        id: "payment_methods",
        prompt:
          "Did you process both cash and card payments?",
      },
    ])
  }
)

test(
  "all confirmation questions require factual answers",
  () => {
    const questions =
      validateConfirmationQuestions([
        {
          id: "payments",
          prompt:
            "Which payment methods did you process?",
        },
        {
          id: "records",
          prompt:
            "Did you maintain daily transaction records?",
        },
      ])

    const result =
      validateConfirmationAnswers(
        questions,
        {
          payments: "Cash and card",
        }
      )

    assert.deepEqual(
      result.answers,
      {
        payments: "Cash and card",
      }
    )

    assert.deepEqual(
      result.missingQuestionIds,
      ["records"]
    )
  }
)

test(
  "confirmed evidence preserves source and answers",
  () => {
    const questions =
      validateConfirmationQuestions([
        {
          id: "payments",
          prompt:
            "Which payment methods did you process?",
        },
      ])

    const evidence =
      buildConfirmedEvidence(
        "Position held: Teller. Responsibilities: Cashier.",
        questions,
        {
          payments: "Cash and card payments",
        }
      )

    assert.match(
      evidence,
      /Position held: Teller/
    )

    assert.match(
      evidence,
      /Cash and card payments/
    )
  }
)

test(
  "unconfirmed reconstruction cannot be approved",
  () => {
    assert.equal(
      canApproveCvChange("needs_confirmation"),
      false
    )

    assert.equal(
      canApproveCvChange("confirmed"),
      true
    )

    assert.equal(
      canApproveCvChange("not_required"),
      true
    )
  }
)