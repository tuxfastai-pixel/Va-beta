type EnterpriseDeck = {
  title: string;
  slides: Array<{ title: string; content: string }>;
};

export function generateEnterpriseDeck(company: string): EnterpriseDeck {
  return {
    title: `AI Execution System for ${company}`,
    slides: [
      {
        title: "Problem",
        content: "Execution delays, inefficiencies, and scaling limitations",
      },
      {
        title: "Solution",
        content: "AI-driven engineering + automation system",
      },
      {
        title: "Capabilities",
        content: `
- Automated development tasks
- Self-fixing workflows
- Continuous optimization
`,
      },
      {
        title: "Impact",
        content: `
- Faster delivery
- Lower costs
- Scalable execution
`,
      },
      {
        title: "Offer",
        content: "Pilot project to demonstrate measurable ROI",
      },
    ],
  };
}

export function formatDeckAsText(deck: EnterpriseDeck) {
  return deck.slides.map((slide) => `${slide.title}\n${slide.content}`).join("\n\n");
}
