const regionalWorkflows: Record<string, string[]> = {
  "UK admin jobs": [
    "email management",
    "calendar scheduling",
    "customer support",
    "CRM updates",
  ],
  "Dubai business support": [
    "proposal drafting",
    "client communications",
    "data tracking",
    "market research",
  ],
};

export function getRegionalWorkflow(region: string) {
  return regionalWorkflows[region] || [];
}

export function getAllRegionalWorkflows() {
  return regionalWorkflows;
}
