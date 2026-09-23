export const payoutCurrencies = ["USD", "EUR", "GBP", "CAD", "AUD"] as const

export const paymentAccountOptions = [
  "wise",
  "payoneer",
  "deel",
  "remote",
  "oyster",
  "paypal",
  "revolut",
] as const

export type PaymentAccountOption = (typeof paymentAccountOptions)[number]
export type PayoutCurrency = (typeof payoutCurrencies)[number]

export type InternationalPaymentReadinessInput = {
  existingAccounts: PaymentAccountOption[]
  noneYet?: boolean
  accountHolderName?: string | null
  accountEmail?: string | null
  preferredPayoutCurrency?: string | null
  hasTaxInformation?: boolean
  hasInternationalBankingPreference?: boolean
}

export type InternationalPaymentReadinessScore = {
  score: number
  completed: string[]
  missing: string[]
  normalizedAccounts: PaymentAccountOption[]
  preferredPayoutCurrency: PayoutCurrency | null
}

export type RolePaymentRecommendation = {
  payoutMethods: string[]
  hasRequiredMethod: boolean
  recommendedAction: string
  estimatedSetupMinutes: number
  summary: string
}

const PAYMENT_LABELS: Record<PaymentAccountOption, string> = {
  wise: "Wise Account",
  payoneer: "Payoneer Account",
  deel: "Deel Account",
  remote: "Remote Account",
  oyster: "Oyster Account",
  paypal: "PayPal Account",
  revolut: "Revolut Account",
}

const ESTIMATED_SETUP_MINUTES: Record<string, number> = {
  Wise: 15,
  Payoneer: 20,
  Deel: 18,
  Remote: 15,
  Oyster: 20,
  PayPal: 10,
  Revolut: 12,
}

function isAccountOption(value: string): value is PaymentAccountOption {
  return paymentAccountOptions.includes(value as PaymentAccountOption)
}

function normalizeAccount(value: string): PaymentAccountOption | null {
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  if (normalized === "pay oneer") {
    return "payoneer"
  }

  if (isAccountOption(normalized)) {
    return normalized
  }

  return null
}

function normalizeCurrency(value: string | null | undefined): PayoutCurrency | null {
  const normalized = String(value || "").toUpperCase()
  return (payoutCurrencies as readonly string[]).includes(normalized) ? (normalized as PayoutCurrency) : null
}

function hasEmail(value: string | null | undefined): boolean {
  const text = String(value || "").trim()
  return text.includes("@") && text.includes(".")
}

export function scoreInternationalPaymentReadiness(
  input: InternationalPaymentReadinessInput,
): InternationalPaymentReadinessScore {
  const normalizedAccounts = Array.from(
    new Set(
      (input.existingAccounts || [])
        .map((account) => normalizeAccount(account))
        .filter((account): account is PaymentAccountOption => Boolean(account)),
    ),
  )

  const preferredPayoutCurrency = normalizeCurrency(input.preferredPayoutCurrency)
  const hasBankingPreference =
    input.hasInternationalBankingPreference ?? Boolean(preferredPayoutCurrency)

  const checkpoints = [
    {
      id: "wise",
      label: PAYMENT_LABELS.wise,
      complete: normalizedAccounts.includes("wise"),
    },
    {
      id: "payoneer",
      label: PAYMENT_LABELS.payoneer,
      complete: normalizedAccounts.includes("payoneer"),
    },
    {
      id: "international-platform",
      label: "International Platform Account",
      complete: normalizedAccounts.some((account) => ["deel", "remote", "oyster"].includes(account)),
    },
    {
      id: "account-holder",
      label: "Account Holder Name",
      complete: String(input.accountHolderName || "").trim().length > 1,
    },
    {
      id: "account-email",
      label: "Account Email",
      complete: hasEmail(input.accountEmail),
    },
    {
      id: "currency",
      label: "Preferred Payout Currency",
      complete: Boolean(preferredPayoutCurrency),
    },
    {
      id: "tax",
      label: "Tax Information",
      complete: Boolean(input.hasTaxInformation),
    },
    {
      id: "banking-preference",
      label: "International Banking Preference",
      complete: Boolean(hasBankingPreference),
    },
  ]

  const completed = checkpoints.filter((checkpoint) => checkpoint.complete).map((checkpoint) => checkpoint.label)
  const missing = checkpoints.filter((checkpoint) => !checkpoint.complete).map((checkpoint) => checkpoint.label)
  const score = Math.round((completed.length / checkpoints.length) * 100)

  return {
    score,
    completed,
    missing,
    normalizedAccounts,
    preferredPayoutCurrency,
  }
}

function normalizePayoutMethod(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (normalized === "wise") return "Wise"
  if (normalized === "payoneer") return "Payoneer"
  if (normalized === "paypal") return "PayPal"
  if (normalized === "deel") return "Deel"
  if (normalized === "remote") return "Remote"
  if (normalized === "oyster") return "Oyster"
  if (normalized === "revolut") return "Revolut"
  return value.trim() || "Wise"
}

export function recommendRolePaymentAction(input: {
  payoutMethods: string[]
  readiness: InternationalPaymentReadinessScore
}): RolePaymentRecommendation {
  const payoutMethods = Array.from(
    new Set((input.payoutMethods || []).map((method) => normalizePayoutMethod(method)).filter(Boolean)),
  )

  const requiredAccounts = payoutMethods
    .map((method) => normalizeAccount(method))
    .filter((method): method is PaymentAccountOption => Boolean(method))
  const hasRequiredMethod = requiredAccounts.some((account) => input.readiness.normalizedAccounts.includes(account))
  const recommendedPrimaryMethod = payoutMethods[0] || "Wise"

  if (hasRequiredMethod) {
    return {
      payoutMethods,
      hasRequiredMethod,
      recommendedAction: "Your payout setup is aligned with this role. Apply now.",
      estimatedSetupMinutes: 0,
      summary: `This role pays through ${payoutMethods.join(" or ")}. You already have at least one supported account.`,
    }
  }

  const estimatedSetupMinutes = ESTIMATED_SETUP_MINUTES[recommendedPrimaryMethod] ?? 15

  return {
    payoutMethods,
    hasRequiredMethod,
    recommendedAction: `Create a ${recommendedPrimaryMethod} account before applying.`,
    estimatedSetupMinutes,
    summary: `This role pays through ${payoutMethods.join(" or ")}. You do not currently have a supported account.`,
  }
}

export function parseInternationalPaymentReadinessFromAnswers(
  answers: Record<string, string | boolean | string[] | number | null> | undefined,
): InternationalPaymentReadinessInput {
  const raw = answers?.internationalPaymentReadiness

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const typed = raw as {
      existingAccounts?: unknown
      noneYet?: unknown
      accountHolderName?: unknown
      accountEmail?: unknown
      preferredPayoutCurrency?: unknown
      hasTaxInformation?: unknown
      hasInternationalBankingPreference?: unknown
    }

    const existingAccounts = Array.isArray(typed.existingAccounts)
      ? typed.existingAccounts.map((value) => String(value)).map((value) => normalizeAccount(value)).filter((value): value is PaymentAccountOption => Boolean(value))
      : []

    return {
      existingAccounts,
      noneYet: Boolean(typed.noneYet),
      accountHolderName: typed.accountHolderName == null ? null : String(typed.accountHolderName),
      accountEmail: typed.accountEmail == null ? null : String(typed.accountEmail),
      preferredPayoutCurrency:
        typed.preferredPayoutCurrency == null ? null : String(typed.preferredPayoutCurrency),
      hasTaxInformation: Boolean(typed.hasTaxInformation),
      hasInternationalBankingPreference: Boolean(typed.hasInternationalBankingPreference),
    }
  }

  return {
    existingAccounts: [],
    noneYet: true,
    accountHolderName: null,
    accountEmail: null,
    preferredPayoutCurrency: null,
    hasTaxInformation: false,
    hasInternationalBankingPreference: false,
  }
}

export function inferRolePayoutMethods(input: {
  title: string
  description: string
  location: string
  source?: string | null
}): string[] {
  const text = `${input.title} ${input.description} ${input.location} ${input.source || ""}`.toLowerCase()
  const methods = new Set<string>()

  if (text.includes("wise")) methods.add("Wise")
  if (text.includes("payoneer")) methods.add("Payoneer")
  if (text.includes("paypal")) methods.add("PayPal")
  if (text.includes("deel")) methods.add("Deel")
  if (text.includes("oyster")) methods.add("Oyster")
  if (text.includes("revolut")) methods.add("Revolut")
  if (text.includes("remote.com") || text.includes(" remote ")) methods.add("Remote")

  if (methods.size === 0) {
    methods.add("Wise")
    methods.add("Payoneer")
  }

  return Array.from(methods)
}