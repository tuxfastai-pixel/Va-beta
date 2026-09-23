/**
 * Follow-up stages in the job hunting pipeline
 */
export type FollowUpStage =
  | "post_application"
  | "post_interview"
  | "no_response"
  | "interview_scheduled";

export interface FollowUpSchedule {
  stage: FollowUpStage;
  message: string;
  delayDays: number;
}

/**
 * Generate follow-up message based on stage and job context
 */
export function generateFollowUp(
  stage: FollowUpStage,
  jobTitle: string,
  company?: string
): string {
  if (stage === "post_application") {
    return generatePostApplicationFollowUp(jobTitle, company);
  }

  if (stage === "post_interview") {
    return generatePostInterviewFollowUp(company);
  }

  if (stage === "no_response") {
    return generateNoResponseFollowUp(jobTitle, company);
  }

  if (stage === "interview_scheduled") {
    return generateInterviewScheduledFollowUp(company);
  }

  return "";
}

function generatePostApplicationFollowUp(
  jobTitle: string,
  company?: string
): string {
  return `Hi,

I wanted to follow up on my application for the ${jobTitle} role${
    company ? ` at ${company}` : ""
  }.

I'm very interested in this opportunity and confident I can contribute effectively. I'm available to discuss further at your convenience.

Looking forward to hearing from you.

Best regards`;
}

function generatePostInterviewFollowUp(company?: string): string {
  return `Hi,

Thank you for taking the time to interview me${company ? ` at ${company}` : ""}.

I really enjoyed our conversation and learning more about the role and team. I'm excited about the opportunity and confident I can deliver strong results.

I'd love to hear next steps if you have any additional questions.

Best regards`;
}

function generateNoResponseFollowUp(
  jobTitle: string,
  company?: string
): string {
  return `Hi,

Just following up on my application for the ${jobTitle} role${
    company ? ` at ${company}` : ""
  }.

I remain interested and would appreciate an update if possible. I'm available to discuss further details whenever suits you.

Thank you for your time.

Best regards`;
}

function generateInterviewScheduledFollowUp(company?: string): string {
  return `Hi,

Thank you for scheduling the interview${company ? ` with ${company}` : ""}.

I'm looking forward to our conversation and have prepared thoroughly. I'm ready to discuss how I can contribute to your team.

See you then.

Best regards`;
}

/**
 * Calculate follow-up schedule for an application
 * Returns list of planned follow-ups with timing
 */
export function scheduleFollowUps(applicationDate: Date): FollowUpSchedule[] {
  return [
    {
      stage: "post_application",
      message: "Check in on application status",
      delayDays: 2,
    },
    {
      stage: "no_response",
      message: "Send follow-up if no response",
      delayDays: 5,
    },
    {
      stage: "no_response",
      message: "Final follow-up attempt",
      delayDays: 10,
    },
  ];
}

/**
 * Get next follow-up date for an application
 */
export function getNextFollowUpDate(applicationDate: Date, stage: FollowUpStage): Date {
  const delayMap: Record<FollowUpStage, number> = {
    post_application: 2,
    post_interview: 1,
    no_response: 5,
    interview_scheduled: 0,
  };

  const days = delayMap[stage] || 0;
  const nextDate = new Date(applicationDate);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

/**
 * Determine if follow-up should be sent based on application age
 */
export function shouldSendFollowUp(
  applicationDate: Date,
  stage: FollowUpStage,
  lastFollowUpDate?: Date
): boolean {
  const now = new Date();
  const nextFollowUp = getNextFollowUpDate(applicationDate, stage);

  // If we already sent this follow-up, don't send again
  if (lastFollowUpDate && lastFollowUpDate.getTime() >= nextFollowUp.getTime()) {
    return false;
  }

  // Send if we've reached or passed the target date
  return now.getTime() >= nextFollowUp.getTime();
}

/**
 * Build follow-up batch for daily orchestrator run
 */
export async function buildFollowUpBatch(
  applications: Array<{
    id: string;
    jobTitle: string;
    company?: string;
    appliedAt: Date;
    lastFollowUpAt?: Date;
  }>
) {
  const followUps = [];

  for (const app of applications) {
    // Check if we should send post-application follow-up
    if (shouldSendFollowUp(app.appliedAt, "post_application", app.lastFollowUpAt)) {
      followUps.push({
        applicationId: app.id,
        stage: "post_application" as FollowUpStage,
        message: generateFollowUp("post_application", app.jobTitle, app.company),
        scheduledFor: new Date(),
      });
    }

    // Check if we should send no-response follow-up
    if (shouldSendFollowUp(app.appliedAt, "no_response", app.lastFollowUpAt)) {
      followUps.push({
        applicationId: app.id,
        stage: "no_response" as FollowUpStage,
        message: generateFollowUp("no_response", app.jobTitle, app.company),
        scheduledFor: new Date(),
      });
    }
  }

  return followUps;
}
