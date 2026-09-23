export type CareerRole = "admin" | "finance" | "sales" | "general";

export interface InterviewContext {
  primaryCareer: CareerRole;
  jobTitle?: string;
  company?: string;
  experience?: number;
}

/**
 * Generate interview answer based on career role
 * Adapts tone and content to role-specific expectations
 */
export function generateAnswer(
  question: string,
  context: InterviewContext
): string {
  const role = context.primaryCareer || "general";

  // Role-specific answer templates
  if (role === "admin") {
    return generateAdminAnswer(question, context);
  }

  if (role === "finance") {
    return generateFinanceAnswer(question, context);
  }

  if (role === "sales") {
    return generateSalesAnswer(question, context);
  }

  return generateGeneralAnswer(question, context);
}

function generateAdminAnswer(question: string, context: InterviewContext): string {
  // Common admin interview questions
  const questionLower = question.toLowerCase();

  if (
    questionLower.includes("organize") ||
    questionLower.includes("schedule") ||
    questionLower.includes("workflow")
  ) {
    return `I focus on structured workflow management and accurate data handling. In my experience, I implement simple but effective systems for scheduling and organization. For example, I use templates and checklists to ensure nothing falls through the cracks, and I regularly update calendars and task lists to keep everyone aligned.`;
  }

  if (questionLower.includes("priority") || questionLower.includes("urgent")) {
    return `I prioritize tasks based on deadlines and impact. I assess what's urgent versus important, communicate with stakeholders about realistic timelines, and adjust schedules as needed. When multiple tasks compete for time, I document decisions to keep transparency.`;
  }

  if (questionLower.includes("communication") || questionLower.includes("detail")) {
    return `I believe clear communication is essential. I provide updates proactively, ask clarifying questions upfront to avoid rework, and document key decisions. I focus on precision because details matter in administrative work.`;
  }

  return `I focus on structured workflow management, accurate data handling, and ensuring tasks are completed efficiently. I've improved organization and turnaround times by implementing simple systems and staying detail-oriented.`;
}

function generateFinanceAnswer(question: string, context: InterviewContext): string {
  const questionLower = question.toLowerCase();

  if (
    questionLower.includes("accuracy") ||
    questionLower.includes("reconcil") ||
    questionLower.includes("record")
  ) {
    return `I prioritize accuracy and compliance. My approach includes maintaining clean records, performing regular reconciliations, and ensuring everything is audit-ready at all times. I use double-checks and reconciliation schedules to catch discrepancies early.`;
  }

  if (
    questionLower.includes("vat") ||
    questionLower.includes("tax") ||
    questionLower.includes("report")
  ) {
    return `I'm familiar with VAT reporting and tax compliance requirements. I ensure records are organized by category, maintain supporting documentation, and prepare reports on schedule. I stay current with compliance updates and flag any changes that affect processes.`;
  }

  if (questionLower.includes("software") || questionLower.includes("tool")) {
    return `I'm comfortable learning new accounting software quickly. I've worked with spreadsheets, basic accounting systems, and I understand the importance of data integrity in financial tools.`;
  }

  return `I prioritize accuracy, compliance, and maintaining audit-ready records. My approach is methodical—I verify data, document processes, and ensure everything aligns with financial requirements. I'm detail-oriented because accuracy is non-negotiable in finance.`;
}

function generateSalesAnswer(question: string, context: InterviewContext): string {
  const questionLower = question.toLowerCase();

  if (questionLower.includes("client") || questionLower.includes("understand")) {
    return `I focus on understanding client needs first. I ask questions to uncover what they're really looking for, then position solutions clearly without pressure. My goal is always to create value and earn trust through honest conversations.`;
  }

  if (questionLower.includes("close") || questionLower.includes("negotiat")) {
    return `I believe in consultative selling. I present solutions that genuinely fit the client's needs, and I'm comfortable discussing pricing and terms. I focus on value rather than pressure, which typically results in better outcomes and longer-term relationships.`;
  }

  if (questionLower.includes("target") || questionLower.includes("number")) {
    return `I'm motivated by clear targets. I track my activities, follow up consistently, and adjust my approach based on what's working. I'm comfortable with metrics and accountability.`;
  }

  return `I focus on understanding client needs first, then positioning solutions clearly. My approach is consultative rather than pushy—I create value, earn trust, and close opportunities efficiently without unnecessary pressure.`;
}

function generateGeneralAnswer(question: string, context: InterviewContext): string {
  return `I adapt quickly and focus on delivering consistent, high-quality results. I learn fast, collaborate well, and take responsibility for outcomes. I'd bring that same approach to this role.`;
}

/**
 * Enhance answer with confidence layer
 */
export function enhanceAnswer(answer: string): string {
  const endings = [
    `I'm confident I can deliver results in this role.`,
    `I'm excited about this opportunity and ready to contribute from day one.`,
    `I've successfully handled similar responsibilities before and approach this with confidence.`,
    `I'm committed to bringing that level of diligence and thoroughness to this position.`,
  ];

  const randomEnding = endings[Math.floor(Math.random() * endings.length)];
  return answer + ` ${randomEnding}`;
}

/**
 * Identify question type for more targeted responses
 */
export function getQuestionType(question: string): string {
  const q = question.toLowerCase();

  if (q.includes("why") || q.includes("motivation"))
    return "motivation";
  if (q.includes("challenge") || q.includes("difficult"))
    return "challenge";
  if (q.includes("strength") || q.includes("skill"))
    return "strength";
  if (q.includes("weakness") || q.includes("improve"))
    return "weakness";
  if (q.includes("team") || q.includes("collaboration"))
    return "teamwork";
  if (q.includes("deadline") || q.includes("pressure"))
    return "pressure";
  if (q.includes("salary") || q.includes("compensation"))
    return "compensation";

  return "general";
}

/**
 * Generate answer with question type awareness
 */
export function generateContextualAnswer(
  question: string,
  context: InterviewContext
): string {
  const questionType = getQuestionType(question);
  let base = generateAnswer(question, context);

  // Enhance based on question type
  if (questionType === "weakness") {
    // Show growth mindset
    base = base.replace(
      /$/,
      ` I view challenges as opportunities to improve and I'm actively working on continuous growth.`
    );
  }

  if (questionType === "challenge") {
    // Show problem-solving
    base = base.replace(
      /$/,
      ` I approached it systematically, broke it down, and worked through it step by step.`
    );
  }

  return enhanceAnswer(base);
}
