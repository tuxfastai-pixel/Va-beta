import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  type FeatureRolloutPolicy,
  type RolloutMode,
} from "../governance/featureRollout.ts"
import { supabaseServer } from "@/lib/supabaseServer"

const RUNTIME_DIR = join(process.cwd(), ".runtime")
const POLICY_FILE = join(RUNTIME_DIR, "personalization-rollout-policy.json")
const ROLLOUT_POLICIES_TABLE = "runtime_rollout_policies"
const PERSONALIZATION_POLICY_KEY = "personalization_rollout"

type RuntimeRolloutPolicyRow = {
  policy_key: string
  policy: Partial<FeatureRolloutPolicy>
}

export const DEFAULT_PERSONALIZATION_ROLLOUT_POLICY: FeatureRolloutPolicy = {
  featureKey: "personalization-intelligence-v1",
  enabled: true,
  mode: "percentage",
  percentage: 100,
  allowedCohorts: [],
  internalUserIds: [],
}

function isMissingRuntimeRolloutPoliciesTable(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase()
  return message.includes(ROLLOUT_POLICIES_TABLE) && message.includes("could not find the table")
}

function normalizePolicy(raw: Partial<FeatureRolloutPolicy>): FeatureRolloutPolicy {
  const mode = raw.mode
  const validMode: RolloutMode =
    mode === "percentage" || mode === "cohort" || mode === "internal-only" || mode === "recovery-only" || mode === "shadow-mode"
      ? mode
      : DEFAULT_PERSONALIZATION_ROLLOUT_POLICY.mode

  return {
    ...DEFAULT_PERSONALIZATION_ROLLOUT_POLICY,
    ...raw,
    mode: validMode,
    percentage: Math.max(0, Math.min(100, Number(raw.percentage ?? DEFAULT_PERSONALIZATION_ROLLOUT_POLICY.percentage))),
    allowedCohorts: Array.isArray(raw.allowedCohorts) ? raw.allowedCohorts : [],
    internalUserIds: Array.isArray(raw.internalUserIds) ? raw.internalUserIds : [],
  }
}

export async function loadPersonalizationRolloutPolicy(): Promise<FeatureRolloutPolicy> {
  const { data, error } = await supabaseServer
    .from(ROLLOUT_POLICIES_TABLE)
    .select("policy_key, policy")
    .eq("policy_key", PERSONALIZATION_POLICY_KEY)
    .maybeSingle()

  if (!error && data) {
    return normalizePolicy((data as RuntimeRolloutPolicyRow).policy)
  }

  if (error && !isMissingRuntimeRolloutPoliciesTable(error)) {
    throw new Error(`Failed to load personalization rollout policy: ${error.message}`)
  }

  await mkdir(RUNTIME_DIR, { recursive: true })
  try {
    const raw = await readFile(POLICY_FILE, "utf8")
    return normalizePolicy(JSON.parse(raw) as Partial<FeatureRolloutPolicy>)
  } catch {
    return { ...DEFAULT_PERSONALIZATION_ROLLOUT_POLICY }
  }
}

export async function savePersonalizationRolloutPolicy(
  partial: Partial<FeatureRolloutPolicy>,
): Promise<FeatureRolloutPolicy> {
  const current = await loadPersonalizationRolloutPolicy()
  const next = normalizePolicy({
    ...current,
    ...partial,
  })

  const { error } = await supabaseServer
    .from(ROLLOUT_POLICIES_TABLE)
    .upsert(
      {
        policy_key: PERSONALIZATION_POLICY_KEY,
        policy: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "policy_key" },
    )

  if (error && !isMissingRuntimeRolloutPoliciesTable(error)) {
    throw new Error(`Failed to persist personalization rollout policy: ${error.message}`)
  }

  if (error && isMissingRuntimeRolloutPoliciesTable(error)) {
    await mkdir(RUNTIME_DIR, { recursive: true })
    await writeFile(POLICY_FILE, JSON.stringify(next, null, 2), "utf8")
  }

  return next
}
