export const MONTHLY_TARGET = {
  revenue: 10000,
  jobs: 40,
  avgJobValue: 250,
} as const;

export const EXPONENTIAL_GROWTH_FLYWHEEL = [
  "Leads (Ads + Scraper + Viral)",
  "CRM + Outreach",
  "Reinforcement Engine",
  "Best Templates Auto-Selected",
  "Deals -> Jobs",
  "Execution System",
  "Revenue",
  "Case Studies",
  "Content Engine (Viral)",
  "More Leads",
  "Referrals",
  "EXPONENTIAL GROWTH",
] as const;

export function getGrowthFlywheel() {
  return EXPONENTIAL_GROWTH_FLYWHEEL.map((step, index) => ({
    step,
    order: index + 1,
  }));
}
