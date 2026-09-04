"use client";

import { useEffect, useState } from "react";

type MatchJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  salaryRange: string | null;
  description: string;
};

type MatchItem = {
  job: MatchJob;
  trustScore: number;
  suitability: {
    fit: number;
    burnoutRisk: number;
    interviewProbability: number;
  };
  whyMatched: string[];
  matchedSkills: string[];
  salaryEstimate: string;
  probabilityScore: number;
  explainability: {
    matchedSkillsCount: number;
    requiredSkillsCount: number;
    requiredSkills: string[];
    qualificationAligned: boolean;
    interviewReadinessPercent: number;
  };
};

type ProfileImprovementItem = {
  id: string;
  title: string;
  detail: string;
  priority: "high" | "medium";
};

type PaymentReadinessSummary = {
  score: number;
  completed: string[];
  missing: string[];
  recommendation: string;
  estimatedSetupMinutes: number;
};

type ApplyPreviewResponse = {
  action: "ACCEPT" | "SKIP" | "SAVE_FOR_LATER" | "TRAIN_ME_FIRST";
  submissionAllowed: boolean;
  preview?: {
    skillGapAnalysis?: string[];
    interviewPreparation?: {
      rehearsalQuestions?: string[];
    };
  };
};

type InterviewPrepResponse = {
  prep?: {
    rehearsalQuestions?: string[];
    preparationReminders?: string[];
    stressPacingTips?: string[];
  };
  coaching?: {
    mode?: string;
    prompts?: string[];
  };
};

export default function JobsDashboard() {
  const [jobs, setJobs] = useState<MatchItem[]>([]);
  const [profileImprovement, setProfileImprovement] = useState<ProfileImprovementItem[]>([]);
  const [paymentReadiness, setPaymentReadiness] = useState<PaymentReadinessSummary | null>(null);
  const [status, setStatus] = useState("Loading pilot-safe job recommendations...");
  const [error, setError] = useState<string | null>(null);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [decisionByJobId, setDecisionByJobId] = useState<Record<string, "ACCEPTED" | "REJECTED">>({});
  const [interviewPrepByJobId, setInterviewPrepByJobId] = useState<Record<string, InterviewPrepResponse>>({});
  const [skillGapsByJobId, setSkillGapsByJobId] = useState<Record<string, string[]>>({});
  const completedReadinessItems = paymentReadiness?.completed ?? [];
  const missingReadinessItems = paymentReadiness?.missing ?? [];

  useEffect(() => {
    const loadJobs = async () => {
      setError(null);

      const response = await fetch("/api/jobs/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setJobs([]);
        setError(payload.error || "Could not load recommendations.");
        setStatus("Complete onboarding profile intake to unlock recommendations.");
        return;
      }

      const payload = (await response.json()) as {
        matches?: MatchItem[];
        profileImprovement?: ProfileImprovementItem[];
        paymentReadiness?: PaymentReadinessSummary;
      };
      const matches = Array.isArray(payload.matches) ? payload.matches : [];
      const guidance = Array.isArray(payload.profileImprovement) ? payload.profileImprovement : [];
      setJobs(matches);
      setProfileImprovement(guidance);
      setPaymentReadiness(payload.paymentReadiness || null);
      setStatus(matches.length > 0 ? "Manual application mode is active. Choose Accept or Reject for each job." : "No matches available yet.");
    };

    void loadJobs();
  }, []);

  const handleDecision = async (job: MatchItem, action: "ACCEPT" | "SKIP") => {
    setBusyJobId(job.job.id);
    setError(null);

    try {
      const previewResponse = await fetch("/api/jobs/apply-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job: job.job,
          action,
        }),
      });

      if (!previewResponse.ok) {
        const payload = (await previewResponse.json().catch(() => ({}))) as { error?: string };
        setError(payload.error || "Could not save manual decision.");
        return;
      }

      const previewPayload = (await previewResponse.json()) as ApplyPreviewResponse;
      setSkillGapsByJobId((current) => ({
        ...current,
        [job.job.id]: previewPayload.preview?.skillGapAnalysis || [],
      }));

      if (action === "SKIP") {
        setDecisionByJobId((current) => ({ ...current, [job.job.id]: "REJECTED" }));
        setStatus(`Rejected ${job.job.title}. No application submitted.`);
        return;
      }

      if (!previewPayload.submissionAllowed) {
        setError("Application approval was not granted. Please retry.");
        return;
      }

      setDecisionByJobId((current) => ({ ...current, [job.job.id]: "ACCEPTED" }));

      const interviewResponse = await fetch("/api/interview/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: job.job.title,
          job: job.job,
        }),
      });

      if (!interviewResponse.ok) {
        setStatus(`Accepted ${job.job.title}. Interview prep could not be loaded yet.`);
        return;
      }

      const interviewPayload = (await interviewResponse.json()) as InterviewPrepResponse;
      setInterviewPrepByJobId((current) => ({
        ...current,
        [job.job.id]: interviewPayload,
      }));
      setStatus(`Accepted ${job.job.title}. Interview coach is now ready.`);
    } catch {
      setError("Network issue while processing manual decision.");
    } finally {
      setBusyJobId(null);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Pilot Job Recommendations</h1>
      <p className="mb-2 text-sm text-slate-600">{status}</p>
      <p className="mb-6 text-sm text-slate-500">Auto-apply is disabled. Every decision requires explicit Accept or Reject.</p>

      {profileImprovement.length > 0 && (
        <section className="mb-6 rounded border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-lg font-semibold text-amber-900">Profile Improvement Engine</h2>
          <p className="mt-1 text-sm text-amber-800">Based on your profile, here are areas that would strengthen your employability.</p>
          <ul className="mt-3 list-disc pl-5 text-sm text-amber-900">
            {profileImprovement.map((item) => (
              <li key={item.id}>
                <span className="font-medium">{item.title}</span>: {item.detail}
                <span className="ml-2 rounded bg-amber-200 px-2 py-0.5 text-xs uppercase tracking-wide">{item.priority}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {paymentReadiness && (
        <section className="mb-6 rounded border border-sky-200 bg-sky-50 p-4">
          <h2 className="text-lg font-semibold text-sky-900">International Payment Readiness</h2>
          <p className="mt-1 text-sm text-sky-800">Profile score: {paymentReadiness.score}%</p>
          <p className="mt-1 text-sm text-sky-800">Estimated setup time: {paymentReadiness.estimatedSetupMinutes} minutes</p>
          <p className="mt-2 text-sm text-sky-900">{paymentReadiness.recommendation}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Completed</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-sky-900">
                {completedReadinessItems.length > 0 ? completedReadinessItems.map((item) => <li key={item}>{item}</li>) : <li>No payment readiness fields completed yet.</li>}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Missing</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-sky-900">
                {missingReadinessItems.length > 0 ? missingReadinessItems.map((item) => <li key={item}>{item}</li>) : <li>All payment readiness fields completed.</li>}
              </ul>
            </div>
          </div>
        </section>
      )}

      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {jobs.length === 0 && !error && (
        <div className="rounded border border-dashed p-4 text-sm text-slate-600">
          No recommendations yet. Complete your onboarding profile to generate pilot matches.
        </div>
      )}

      {jobs.map((job) => (
        <div
          key={job.job.id}
          className="border p-4 rounded mb-4"
        >
          <h2 className="font-semibold">{job.job.title || "Untitled opportunity"}</h2>

          <p>{job.job.company || "Unknown company"} · {job.job.location || "Unknown location"}</p>

          <p>Why matched: {(job.whyMatched || []).join("; ") || "Role alignment detected"}</p>
          <p>Salary estimate: {job.salaryEstimate || "Not provided"}</p>
          <p>Probability score: {Math.round((job.probabilityScore || 0) * 100)}%</p>
          <p>Skills matched: {(job.matchedSkills || []).length > 0 ? job.matchedSkills.join(", ") : "No direct skill overlaps detected yet"}</p>

          <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
            <p className="font-medium">Recommended because:</p>
            <ul className="mt-1 list-disc pl-5">
              <li>
                {job.explainability?.matchedSkillsCount ?? 0} of {job.explainability?.requiredSkillsCount ?? 0} detected role skills align with your profile
              </li>
              <li>
                Relevant strengths: {(job.explainability?.requiredSkills || []).slice(0, 4).join(", ") || "core role capabilities"}
              </li>
              <li>
                {job.explainability?.qualificationAligned ? "Your profile background appears to meet baseline role requirements" : "Your profile can still qualify with stronger evidence examples"}
              </li>
              <li>
                Estimated interview readiness: {job.explainability?.interviewReadinessPercent ?? Math.round((job.probabilityScore || 0) * 100)}%
              </li>
            </ul>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded bg-emerald-600 px-3 py-2 text-white disabled:opacity-60"
              onClick={() => void handleDecision(job, "ACCEPT")}
              disabled={busyJobId === job.job.id}
            >
              Accept
            </button>
            <button
              type="button"
              className="rounded border border-slate-300 px-3 py-2 text-slate-700 disabled:opacity-60"
              onClick={() => void handleDecision(job, "SKIP")}
              disabled={busyJobId === job.job.id}
            >
              Reject
            </button>
          </div>

          {decisionByJobId[job.job.id] && (
            <p className="mt-2 text-sm text-slate-700">Decision: {decisionByJobId[job.job.id]}</p>
          )}

          {(skillGapsByJobId[job.job.id] || []).length > 0 && (
            <div className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">Profile improvement suggestions</p>
              <ul className="list-disc pl-5">
                {skillGapsByJobId[job.job.id].map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </div>
          )}

          {interviewPrepByJobId[job.job.id]?.prep && (
            <div className="mt-3 rounded bg-blue-50 p-3 text-sm text-blue-900">
              <p className="font-medium">Interview Coach</p>
              <p className="mt-1">Mode: {interviewPrepByJobId[job.job.id]?.coaching?.mode || "standard-mode"}</p>
              <p className="mt-2 font-medium">Common and role-specific questions</p>
              <ul className="list-disc pl-5">
                {(interviewPrepByJobId[job.job.id]?.prep?.rehearsalQuestions || []).map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
              <p className="mt-2 font-medium">Confidence coaching</p>
              <ul className="list-disc pl-5">
                {(interviewPrepByJobId[job.job.id]?.coaching?.prompts || []).map((prompt) => (
                  <li key={prompt}>{prompt}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
