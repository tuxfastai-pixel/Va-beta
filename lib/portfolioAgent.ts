export function buildPortfolio(skills: unknown[], simulations: unknown[]) {
  const skillCount = skills.length;
  const simulationCount = simulations.length;

  return {
    projects: [
      {
        title: "Email Workflow Management",
        description:
        `Organized client communication using Gmail filters (${skillCount} tracked skills).`
      },

      {
        title: "CRM Contact Management",
        description:
        `Managed contacts using CRM pipelines (${simulationCount} simulations).`
      }

    ]

  }
}
