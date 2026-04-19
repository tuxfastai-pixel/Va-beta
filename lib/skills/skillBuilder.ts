export type SkillClassification = "ai_executable" | "human_required";

export type MicroLesson = {
  title: string;
  example: string;
  action: string;
  classification: SkillClassification;
};

const careerAliases: Record<string, string> = {
  teaching: "writing",
  writing: "writing",
  "project-management": "general",
  general: "general",
  "admin-crm": "admin",
  admin: "admin",
  "finance-compliance": "admin",
};

const lessonLibrary: Record<string, { example: string; action: string }> = {
  "Basic communication": {
    example: 'Example: "Hello Sarah — I understand the task, timeline, and outcome you need. I can start today and keep you updated."',
    action: "Use AI to draft a clean response, then personalize it before sending.",
  },
  "Task understanding": {
    example: "Example: turn a client brief into a 3-point checklist: deliverable, deadline, and success measure.",
    action: "Paste one real task into AI and ask for a simple action plan you can execute immediately.",
  },
  "Using AI tools": {
    example: "Example: ask AI to summarize notes, draft content, or structure a spreadsheet in seconds.",
    action: "Pick one job task and complete the first draft with AI support today.",
  },
  "Client handling": {
    example: "Example: send a progress update that confirms what is done, what is next, and when delivery is expected.",
    action: "Create a reusable update template for client communication.",
  },
  "Content writing basics": {
    example: "Example: write a short introduction, clear body, and strong call-to-action for a client article.",
    action: "Draft a 150-word sample using AI, then edit it into your own tone.",
  },
  "Using AI for writing": {
    example: "Example: turn bullet points into a polished blog post, caption, or proposal.",
    action: "Generate one writing sample that you can reuse in your portfolio today.",
  },
  "Editing and proofreading": {
    example: "Example: fix grammar, tighten sentences, and make the final version easier to read.",
    action: "Review one AI-generated sample and improve clarity line by line.",
  },
  "Data entry": {
    example: "Example: organize names, emails, and dates neatly into a spreadsheet with the right columns.",
    action: "Practice by cleaning a small table and checking it for accuracy.",
  },
  "Spreadsheet basics": {
    example: "Example: sort rows, use simple formulas, and highlight missing values quickly.",
    action: "Create a basic tracker sheet with totals and status columns.",
  },
  "Email handling": {
    example: "Example: categorize inbox messages into urgent, follow-up, and completed.",
    action: "Use AI to draft a professional reply to a sample support email.",
  },
};

export function classifySkill(skill: string): SkillClassification {
  const aiCapable = ["writing", "data entry", "email handling", "research", "using ai tools"];

  if (aiCapable.includes(skill.toLowerCase())) {
    return "ai_executable";
  }

  return "human_required";
}

export function generateSkillPath(career: string) {
  const normalizedCareer = careerAliases[career.toLowerCase()] || "general";

  const paths: Record<string, string[]> = {
    general: ["Basic communication", "Task understanding", "Using AI tools", "Client handling"],
    writing: ["Content writing basics", "Using AI for writing", "Editing and proofreading"],
    admin: ["Data entry", "Spreadsheet basics", "Email handling"],
  };

  return paths[normalizedCareer] || paths.general;
}

export function buildMicroLessons(career: string): MicroLesson[] {
  return generateSkillPath(career).map((title) => {
    const lesson = lessonLibrary[title] || {
      example: `Example: practice ${title.toLowerCase()} on one real task today.`,
      action: `Complete one fast exercise for ${title.toLowerCase()} and save the result to your portfolio.`,
    };

    return {
      title,
      example: lesson.example,
      action: lesson.action,
      classification: classifySkill(title),
    };
  });
}
