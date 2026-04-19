import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function workflowAgent(jobDescription: string) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: "You design automated workflows for remote jobs.",
      },
      {
        role: "user",
        content: `
Job Description:
${jobDescription}

Return list of tasks with:
- task name
- automation level (AI / Human / Hybrid)
`,
      },
    ],
  });

  return completion.choices[0].message.content;
}
