/**
 * Geographic Expansion Logic
 * Isolates currency, compliance rules, platform weighting, timezone, and pricing
 * per region so the orchestrator and agents adapt automatically.
 */

export type Region = "ZA" | "US" | "UK" | "EU" | "AU" | "GLOBAL";

export interface RegionProfile {
  code:              Region;
  label:             string;
  currency:          string;
  currencySymbol:    string;
  timezone:          string;
  /** Platform names with weight (0-1). Higher = more aggressive sourcing. */
  platformWeights:   Record<string, number>;
  /** Pricing baselines in local currency */
  pricingBaseline: {
    hourlyRate:    number;
    projectMin:    number;
    retainerMin:   number;
  };
  /** Compliance rules that apply */
  complianceFlags:   string[];
  /** High-margin niches for this region */
  topNiches:         string[];
  /** Typical working hours (24h range) */
  workingHours: {
    start: number;
    end:   number;
  };
  /** Payment methods preferred in this region */
  paymentMethods:    string[];
}

export const REGION_PROFILES: Record<Region, RegionProfile> = {
  ZA: {
    code:           "ZA",
    label:          "South Africa",
    currency:       "ZAR",
    currencySymbol: "R",
    timezone:       "Africa/Johannesburg",
    platformWeights: {
      pnet:          0.95,
      careers24:     0.90,
      careerjunction: 0.85,
      indeed:        0.70,
      linkedin:      0.60,
    },
    pricingBaseline: {
      hourlyRate:  350,
      projectMin:  5_000,
      retainerMin: 8_000,
    },
    complianceFlags: [
      "POPIA",          // Protection of Personal Information Act
      "BBBEE",          // Broad-Based Black Economic Empowerment
      "VAT_15",         // 15% VAT
      "SARS_REPORTING", // South African Revenue Service
      "GOVERNMENT_TENDER_REQUIREMENTS",
    ],
    topNiches: [
      "finance_cleanup",
      "tender_documentation",
      "crm_admin",
      "compliance_admin",
      "va_operations",
    ],
    workingHours: { start: 8, end: 17 },
    paymentMethods: ["payfast", "eft", "bank_transfer"],
  },

  US: {
    code:           "US",
    label:          "United States",
    currency:       "USD",
    currencySymbol: "$",
    timezone:       "America/New_York",
    platformWeights: {
      linkedin:  0.95,
      indeed:    0.90,
      flexjobs:  0.85,
      upwork:    0.70,
    },
    pricingBaseline: {
      hourlyRate:  75,
      projectMin:  2_000,
      retainerMin: 3_500,
    },
    complianceFlags: [
      "GDPR_ADEQUACY",
      "W9_CONTRACTOR",
      "1099_REPORTING",
    ],
    topNiches: [
      "sales_follow_up",
      "crm_admin",
      "tech_admin",
      "executive_assistant",
      "revenue_operations",
    ],
    workingHours: { start: 9, end: 18 },
    paymentMethods: ["wise", "stripe", "ach"],
  },

  UK: {
    code:           "UK",
    label:          "United Kingdom",
    currency:       "GBP",
    currencySymbol: "£",
    timezone:       "Europe/London",
    platformWeights: {
      reed:      0.90,
      totaljobs: 0.85,
      linkedin:  0.80,
      indeed:    0.75,
    },
    pricingBaseline: {
      hourlyRate:  45,
      projectMin:  1_500,
      retainerMin: 2_500,
    },
    complianceFlags: [
      "GDPR_UK",
      "ICO_REGISTRATION",
      "IR35_CHECK",
      "VAT_20",
    ],
    topNiches: [
      "admin_support",
      "customer_service",
      "finance_admin",
      "compliance_reporting",
      "hr_admin",
    ],
    workingHours: { start: 9, end: 17 },
    paymentMethods: ["wise", "stripe", "bacs"],
  },

  EU: {
    code:           "EU",
    label:          "European Union",
    currency:       "EUR",
    currencySymbol: "€",
    timezone:       "Europe/Berlin",
    platformWeights: {
      linkedin: 0.85,
      indeed:   0.75,
      xing:     0.65,
    },
    pricingBaseline: {
      hourlyRate:  55,
      projectMin:  1_800,
      retainerMin: 3_000,
    },
    complianceFlags: [
      "GDPR_EU",
      "VAT_MOSS",
      "DATA_RESIDENCY_EU",
    ],
    topNiches: [
      "multilingual_support",
      "compliance_admin",
      "finance_admin",
      "customer_success",
      "project_admin",
    ],
    workingHours: { start: 9, end: 18 },
    paymentMethods: ["wise", "stripe", "sepa"],
  },

  AU: {
    code:           "AU",
    label:          "Australia",
    currency:       "AUD",
    currencySymbol: "A$",
    timezone:       "Australia/Sydney",
    platformWeights: {
      seek:     0.95,
      linkedin: 0.75,
      indeed:   0.65,
    },
    pricingBaseline: {
      hourlyRate:  85,
      projectMin:  2_500,
      retainerMin: 4_000,
    },
    complianceFlags: [
      "PRIVACY_ACT_AU",
      "GST_10",
      "ABN_REQUIRED",
      "SUPER_REPORTING",
    ],
    topNiches: [
      "va_operations",
      "sales_admin",
      "bookkeeping",
      "project_admin",
      "customer_success",
    ],
    workingHours: { start: 8, end: 17 },
    paymentMethods: ["wise", "paypal", "bank_transfer"],
  },

  GLOBAL: {
    code:           "GLOBAL",
    label:          "Global / Remote",
    currency:       "USD",
    currencySymbol: "$",
    timezone:       "UTC",
    platformWeights: {
      flexjobs: 0.90,
      linkedin: 0.85,
      indeed:   0.75,
      upwork:   0.70,
    },
    pricingBaseline: {
      hourlyRate:  50,
      projectMin:  1_500,
      retainerMin: 2_500,
    },
    complianceFlags: [
      "GDPR_AWARENESS",
      "CONTRACTOR_TERMS",
    ],
    topNiches: [
      "remote_admin",
      "crm_admin",
      "sales_follow_up",
      "executive_assistant",
      "content_admin",
    ],
    workingHours: { start: 0, end: 24 },
    paymentMethods: ["wise", "paypal", "stripe"],
  },
};

/** Detect region from job metadata or user profile */
export function detectRegion(input: {
  country?: string;
  currency?: string;
  platform?: string;
}): Region {
  const country  = (input.country  ?? "").toUpperCase();
  const currency = (input.currency ?? "").toUpperCase();

  if (country === "ZA" || currency === "ZAR") return "ZA";
  if (country === "US" || currency === "USD") return "US";
  if (country === "GB" || country === "UK" || currency === "GBP") return "UK";
  if (currency === "EUR") return "EU";
  if (country === "AU" || currency === "AUD") return "AU";

  // Platform heuristics
  const platform = (input.platform ?? "").toLowerCase();
  if (["pnet", "careers24", "careerjunction"].includes(platform)) return "ZA";
  if (["reed", "totaljobs"].includes(platform)) return "UK";
  if (["seek"].includes(platform)) return "AU";

  return "GLOBAL";
}

/** Get platform weight for a given region */
export function getPlatformWeight(platform: string, region: Region): number {
  const profile = REGION_PROFILES[region];
  return profile.platformWeights[platform.toLowerCase()] ?? 0.5;
}

/** Convert an amount to a target currency (simple fixed-rate stub — swap for live FX in production) */
const FX_RATES: Record<string, number> = {
  ZAR: 18.5,
  USD: 1,
  GBP: 0.79,
  EUR: 0.92,
  AUD: 1.52,
};

export function convertCurrency(amount: number, from: string, to: string): number {
  const fromRate = FX_RATES[from] ?? 1;
  const toRate   = FX_RATES[to]   ?? 1;
  return (amount / fromRate) * toRate;
}

/** Is now inside the region's working hours? */
export function isWorkingHours(region: Region): boolean {
  const profile = REGION_PROFILES[region];
  const now     = new Date();
  const formatter = new Intl.DateTimeFormat("en", {
    hour:     "numeric",
    hour12:   false,
    timeZone: profile.timezone,
  });
  const hour = parseInt(formatter.format(now), 10);
  return hour >= profile.workingHours.start && hour < profile.workingHours.end;
}

/** Adjust a price to region baseline if it seems too low */
export function normalisePrice(amount: number, region: Region, type: "hourly" | "project" | "retainer"): number {
  const baseline = REGION_PROFILES[region].pricingBaseline;
  const min = type === "hourly" ? baseline.hourlyRate :
              type === "project" ? baseline.projectMin :
              baseline.retainerMin;
  return Math.max(amount, min);
}
