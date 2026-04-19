type PitchMetrics = {
  tam?: string | number;
  clients?: string | number;
  period?: string | number;
  arr?: string | number;
  profit_multiplier?: string | number;
};

export function generatePitchDeck(metrics: PitchMetrics) {
  return {
    slides: [
      { title: "Problem", content: "Hiring and execution are slow and expensive." },
      { title: "Solution", content: "Our AI system builds, fixes, and optimizes tasks automatically." },
      { title: "Market", content: `Targeting startups, SaaS, and agencies (~${metrics.tam} TAM).` },
      { title: "Traction", content: `Acquired ${metrics.clients} clients in ${metrics.period}.` },
      { title: "Revenue", content: `ARR: $${metrics.arr}, profit multiplier: ${metrics.profit_multiplier}` },
      { title: "Team", content: "AI agents handle end-to-end operations." },
      { title: "Vision", content: "Autonomous AI business operations globally." }
    ]
  };
}
