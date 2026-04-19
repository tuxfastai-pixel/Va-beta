export function generateReferralCode(seed: string): string {
  const cleaned = seed.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const base = cleaned.slice(0, 6) || "EARNER";
  const suffix = Date.now().toString(36).toUpperCase().slice(-4);
  return `${base}-${suffix}`;
}

export function buildReferralLink(origin: string | undefined, referralCode: string): string {
  const safeOrigin = origin?.trim() ? origin.trim() : "http://localhost:3000";
  return `${safeOrigin}/signup?ref=${encodeURIComponent(referralCode)}`;
}

export function calculateReferralBoost(amount: number, boostPercent = 10): number {
  return Number((amount * (boostPercent / 100)).toFixed(2));
}

export function generateSuccessPost(name: string): string {
  return `${name} just activated an AI worker that finds clients, sends proposals, and tracks payments automatically. If you want to build global income too, join through my referral link.`;
}
