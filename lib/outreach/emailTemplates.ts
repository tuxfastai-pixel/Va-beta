/**
 * Cold email templates with personalization
 * Focus on pain points + value proposition
 */

interface PersonalizationData {
  name: string;
  company: string;
  industry?: string;
  title?: string;
  painPoint?: string;
}

export type TemplateId =
  | "painPointFocused"
  | "socialProofFocused"
  | "curiosityLoop"
  | "specificOffer"
  | "caseStudy";

/**
 * Template variants for A/B testing
 */
export const EMAIL_TEMPLATES = {
  // Template A: Pain point focused
  painPointFocused: (data: PersonalizationData) => ({
    subject: `Quick question about ${data.company}`,
    text: `Hi ${data.name},

I was researching ${data.company} and noticed you're scaling your operations.

Most teams at your stage struggle with:
- Development bottlenecks
- Manual process overhead
- Execution delays

We've built an autonomous system that handles this end-to-end:
- Deploys agents for development & automation
- Fixes issues in hours, not weeks
- Scales without hiring

Would you be open to a 15-min conversation about how this works?

Best,
VA Team
P.S. No obligation—just exploring fit.`,
  }),

  // Template B: Social proof focused
  socialProofFocused: (data: PersonalizationData) => ({
    subject: `${data.company} + autonomous execution`,
    text: `Hi ${data.name},

Quick context: We help companies like yours automate their execution layer.

Recent wins:
- 40% faster delivery for a 20-person startup
- Reduced overhead by $15k/month for a scaling agency
- 24/7 autonomous task handling for a dev shop

The core insight: You don't need more staff. You need smarter automation.

Open to a quick chat?

Best,
VA Team`,
  }),

  // Template C: Curiosity loop (highest engagement)
  curiosityLoop: (data: PersonalizationData) => ({
    subject: `This might sound crazy...`,
    text: `Hi ${data.name},

This might sound crazy, but hear me out:

What if your business could execute tasks 24/7 without hiring a larger team?

Most founders think it's impossible. We've built the system that makes it possible.

I'd love to show you how (takes 15 min).

Are you open?

Best,
VA Team`,
  }),

  // Template D: Specific offer
  specificOffer: (data: PersonalizationData) => ({
    subject: `Free audit: ${data.company} execution gaps`,
    text: `Hi ${data.name},

We're auditing 10 companies this month for execution efficiency.

In the audit, we identify:
- Bottlenecks in your workflow
- Tasks that could be automated
- Revenue impact of faster execution

Takes 30 min, no cost.

Interested?

Best,
VA Team`,
  }),

  // Template E: Case study angle
  caseStudy: (data: PersonalizationData) => ({
    subject: `We helped a ${data.industry} company 3x output. Details inside.`,
    text: `Hi ${data.name},

We just finished a case study with a ${data.industry} company similar to yours.

Their challenge: Team was buried in execution work. Limited capacity to innovate.

Solution: Deployed autonomous agents for routine tasks.

Result: 3x output increase, 60% cost reduction.

Happy to share the full case study + discuss how it applies to ${data.company}.

Best,
VA Team`,
  }),
};

export function pickTemplateIdForTarget(data: PersonalizationData): TemplateId {
  if (data.painPoint) return "painPointFocused";
  if (data.industry) return "caseStudy";
  if (data.title?.toLowerCase().includes("founder") || data.title?.toLowerCase().includes("ceo")) {
    return "curiosityLoop";
  }
  return "painPointFocused";
}

/**
 * Select template variant (A/B or rotation)
 */
export function selectTemplate(
  variant: keyof typeof EMAIL_TEMPLATES,
  data: PersonalizationData
) {
  const template = EMAIL_TEMPLATES[variant];
  if (!template) {
    return EMAIL_TEMPLATES.painPointFocused(data);
  }
  return template(data);
}

/**
 * Randomly select template for distribution
 */
export function getRandomTemplate(data: PersonalizationData) {
  const templates = Object.keys(EMAIL_TEMPLATES) as Array<keyof typeof EMAIL_TEMPLATES>;
  const selected = templates[Math.floor(Math.random() * templates.length)];
  return selectTemplate(selected, data);
}

/**
 * Rotate template based on account sending history
 */
export function rotateTemplate(
  accountIndex: number,
  data: PersonalizationData
) {
  const templates = Object.keys(EMAIL_TEMPLATES) as Array<keyof typeof EMAIL_TEMPLATES>;
  const selected = templates[accountIndex % templates.length];
  return selectTemplate(selected, data);
}

/**
 * Get template with max personalization
 */
export function getPersonalizedTemplate(
  data: PersonalizationData
): { templateId: TemplateId; subject: string; text: string } {
  // Choose template based on data availability
  if (data.painPoint) {
    // If we know their pain point, use specific message
    return {
      templateId: "painPointFocused",
      subject: `Quick question about ${data.company}`,
      text: `Hi ${data.name},

I was researching ${data.company} and noticed something: ${data.painPoint}

We've built an autonomous system that specifically addresses this:
- Handles execution without manual overhead
- Scales as you grow
- Reduces costs by 40-60%

Would you be open to seeing how it works?

Best,
VA Team`,
    };
  }

  if (data.industry) {
    return {
      templateId: "caseStudy",
      ...selectTemplate("caseStudy", data),
    };
  }

  if (data.title?.toLowerCase().includes("founder") ||
    data.title?.toLowerCase().includes("ceo")) {
    return {
      templateId: "curiosityLoop",
      ...selectTemplate("curiosityLoop", data),
    };
  }

  // Default to pain point focused
  return {
    templateId: "painPointFocused",
    ...selectTemplate("painPointFocused", data),
  };
}

/**
 * Generate batch of personalized emails
 */
export interface OutreachTarget {
  id: string;
  name: string;
  email: string;
  company: string;
  industry?: string;
  title?: string;
  painPoint?: string;
}

export function generatePersonalizedBatch(
  targets: OutreachTarget[]
): Array<{ target: OutreachTarget; subject: string; text: string }> {
  return targets.map((target, index) => ({
    target,
    ...rotateTemplate(index, target),
  }));
}

/**
 * Clean up subject line (remove special chars that might trigger spam filters)
 */
export function sanitizeSubject(subject: string): string {
  return subject
    .replace(/[!@#$%^&*()]/g, "")
    .replace(/https?:\/\//g, "")
    .substring(0, 60);
}

/**
 * Add footer + unsubscribe option
 */
export function addEmailFooter(text: string, accountEmail: string): string {
  return `${text}

---
This email was sent to you because we think your company might benefit from autonomous execution systems.
Sender: ${accountEmail}
Not interested? Reply with "unsubscribe" and we'll remove you.`;
}
