import test from "node:test"
import assert from "node:assert"
import { readFile } from "node:fs/promises"

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
      route,
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
      route,
      /confirmationStatus === "confirmed"/
    )
    assert.match(
      route,
      /String\(row\.source_evidence \|\| ""\)\.trim\(\) \|\|/
    )
    assert.match(
      route,
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
  }
)
