export type TaskType =
  | "COMPLIANCE_TASK"
  | "BOOKKEEPING_TASK"
  | "DOCUMENT_PROCESSING"
  | "JOB_DISCOVERY"
  | "JOB_MATCHING"
  | "JOB_APPLICATION";

export type BillingCurrency = "USD" | "GBP" | "EUR" | "AED";

type FeeInput = {
  taskType: TaskType;
  country?: string;
  documentCount?: number;
  priority?: number;
  currency?: string;
};

type FeeBreakdown = {
  amount: number;
  amount_usd: number;
  currency: BillingCurrency;
  complexity_score: number;
  volume_score: number;
  priority_score: number;
  country_multiplier: number;
  base_usd: number;
};

const usdToCurrency: Record<BillingCurrency, number> = {
  USD: 1,
  GBP: 0.79,
  EUR: 0.92,
  AED: 3.67,
};

const baseUsdByTask: Record<TaskType, number> = {
  COMPLIANCE_TASK: 55,
  BOOKKEEPING_TASK: 45,
  DOCUMENT_PROCESSING: 35,
  JOB_DISCOVERY: 15,
  JOB_MATCHING: 20,
  JOB_APPLICATION: 25,
};

const complexityByTask: Record<TaskType, number> = {
  COMPLIANCE_TASK: 1.35,
  BOOKKEEPING_TASK: 1.2,
  DOCUMENT_PROCESSING: 1.1,
  JOB_DISCOVERY: 0.9,
  JOB_MATCHING: 1,
  JOB_APPLICATION: 1.05,
};

export function normalizeCurrency(currency?: string): BillingCurrency {
  const normalized = String(currency || "USD").toUpperCase();

  if (normalized === "GBP" || normalized === "EUR" || normalized === "AED") {
    return normalized;
  }

  return "USD";
}

function countryMultiplier(country?: string) {
  const normalized = String(country || "").trim().toUpperCase();

  if (!normalized) {
    return 1;
  }

  if (normalized === "UK" || normalized === "GB" || normalized === "UNITED KINGDOM") {
    return 1.08;
  }

  if (normalized === "UAE" || normalized === "AE" || normalized === "UNITED ARAB EMIRATES") {
    return 1.05;
  }

  if (normalized === "US" || normalized === "USA" || normalized === "UNITED STATES") {
    return 1.12;
  }

  if (normalized === "EU" || normalized === "EUROPE" || normalized === "DE" || normalized === "FR") {
    return 1.04;
  }

  return 1;
}

export function calculateTaskFee(input: FeeInput): FeeBreakdown {
  const currency = normalizeCurrency(input.currency);
  const baseUsd = baseUsdByTask[input.taskType] ?? 30;
  const complexityScore = complexityByTask[input.taskType] ?? 1;
  const documentCount = Math.max(0, Number(input.documentCount || 0));
  const volumeScore = Math.min(2, 1 + documentCount * 0.05);
  const boundedPriority = Math.max(0, Math.min(10, Number(input.priority || 0)));
  const priorityScore = 1 + boundedPriority * 0.025;
  const geo = countryMultiplier(input.country);

  const totalUsd = baseUsd * complexityScore * volumeScore * priorityScore * geo;
  const total = totalUsd * usdToCurrency[currency];

  return {
    amount: Number(total.toFixed(2)),
    amount_usd: Number(totalUsd.toFixed(2)),
    currency,
    complexity_score: Number(complexityScore.toFixed(2)),
    volume_score: Number(volumeScore.toFixed(2)),
    priority_score: Number(priorityScore.toFixed(2)),
    country_multiplier: Number(geo.toFixed(2)),
    base_usd: baseUsd,
  };
}

export function convertToUsd(amount: number, currency?: string) {
  const normalized = normalizeCurrency(currency);
  const rate = usdToCurrency[normalized];

  if (!rate) {
    return amount;
  }

  return Number((amount / rate).toFixed(2));
}

export function convertFromUsd(usdAmount: number, currency?: string) {
  const normalized = normalizeCurrency(currency);
  return Number((usdAmount * usdToCurrency[normalized]).toFixed(2));
}
