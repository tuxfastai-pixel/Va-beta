"use client"

import { useParams } from "next/navigation"
import { isValidStage } from "@/lib/career/activationContinuity.ts"
import CompleteStage from "@/components/career-activation/CompleteStage"
import CvIntakeStage from "@/components/career-activation/CvIntakeStage"
import ProfileReviewStage from "@/components/career-activation/ProfileReviewStage"
import CvImprovementsStage from "@/components/career-activation/CvImprovementsStage"
import CareerSummaryStage from "@/components/career-activation/CareerSummaryStage"
import JobDiscoveryStage from "@/components/career-activation/JobDiscoveryStage"
import JobAssessmentStage from "@/components/career-activation/JobAssessmentStage"
import ApplicationPackStage from "@/components/career-activation/ApplicationPackStage"
import InterviewPrepStage from "@/components/career-activation/InterviewPrepStage"

export default function CareerActivationPage() {
  const params = useParams()
  const stage = params.stage as string

  if (!isValidStage(stage)) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#ef4444" }}>
        <h2>Invalid Stage</h2>
        <p>The requested stage does not exist.</p>
      </div>
    )
  }

  const componentMap: Record<string, React.ComponentType> = {
    complete: CompleteStage,
    "cv-intake": CvIntakeStage,
    "profile-review": ProfileReviewStage,
    "cv-improvements": CvImprovementsStage,
    "career-summary": CareerSummaryStage,
    "job-discovery": JobDiscoveryStage,
    "job-assessment": JobAssessmentStage,
    "application-pack": ApplicationPackStage,
    "interview-prep": InterviewPrepStage,
  }

  const Component = componentMap[stage]

  if (!Component) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#ef4444" }}>
        <h2>Component Not Found</h2>
        <p>The component for stage &quot;{stage}&quot; could not be loaded.</p>
      </div>
    )
  }

  return <Component />
}
