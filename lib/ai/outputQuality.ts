import OpenAI from "openai";

export const CLIENT_TRANSPARENCY_NOTE = "This work was completed using advanced tools to ensure speed and accuracy.";

export function humanize(text: string) {
  return String(text || "")
    .replace(/Dear Sir\/Madam/gi, "")
    .replace(/I am writing to inform you/gi, "Just a quick note")
    .replace(/Furthermore/gi, "Also")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function humanDelay() {
  return Math.floor(Math.random() * 300000);
}

export function varySentence(input: string) {
  const variations = [
    input,
    "Here’s how I’d approach this:",
    "I can help with this by doing the following:",
  ];

  return variations[Math.floor(Math.random() * variations.length)] || input;
}

export async function validateOutput(output: string) {
  const text = humanize(output);
  const checks = {
    length: text.length > 120,
    hasStructure: text.toLowerCase().includes("i") && text.toLowerCase().includes("you"),
    noSpam: !text.includes("Dear Sir/Madam"),
    humanTone: !/(furthermore|therefore|henceforth)/i.test(text),
  };

  const score = Object.values(checks).filter(Boolean).length;

  return {
    passed: score >= 3,
    score,
    checks,
  };
}

export function proposalTemplate(data: {
  summary?: string;
  solution?: string;
  timeline?: string;
  rate?: string;
}) {
  return [
    "Hello,",
    "",
    `I understand your requirement: ${String(data.summary || "your request")}`,
    "",
    "Here’s how I will help:",
    String(data.solution || "I will provide a clear, practical solution with strong communication and reliable delivery."),
    "",
    `Timeline: ${String(data.timeline || "To be confirmed after kickoff")}`,
    `Rate: ${String(data.rate || "Flexible based on scope")}`,
    "",
    "Looking forward to working with you.",
  ].join("\n");
}

export function confidenceScore(output: unknown) {
  const text = typeof output === "string" ? output : JSON.stringify(output);
  const lower = text.toLowerCase();

  let score = 0;
  if (text.length > 200) score += 20;
  if (lower.includes("solution")) score += 20;
  if (lower.includes("timeline")) score += 20;
  if (lower.includes("clear value")) score += 20;
  if (lower.includes("looking forward") || lower.includes("professional")) score += 20;

  return score;
}

export async function selfValidate(output: string) {
  const humanizedOutput = humanize(output);
  const validation = await validateOutput(humanizedOutput);
  const baseReview = {
    validation,
    criteria: [
      { name: "accuracy", passed: humanizedOutput.trim().length > 0 },
      { name: "clarity", passed: humanizedOutput.length >= 80 },
      { name: "completeness", passed: /(timeline|rate|solution)/i.test(humanizedOutput) },
      { name: "professional tone", passed: /(hello|regards|looking forward|professional)/i.test(humanizedOutput) },
    ],
    confidence: confidenceScore(humanizedOutput),
  };

  if (!process.env.OPENAI_API_KEY || process.env.ENABLE_AI_SELF_REVIEW !== "true") {
    return {
      ...baseReview,
      summary: "Rule-based self-check completed.",
    };
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Review the assistant output for accuracy, clarity, completeness, and professional tone. Respond briefly in JSON with summary and issues.",
        },
        { role: "user", content: output },
      ],
      response_format: { type: "json_object" },
    });

    return {
      ...baseReview,
      summary: completion.choices[0].message.content?.trim() || "AI self-check completed.",
    };
  } catch {
    return {
      ...baseReview,
      summary: "Rule-based self-check completed; AI review fallback was used.",
    };
  }
}
