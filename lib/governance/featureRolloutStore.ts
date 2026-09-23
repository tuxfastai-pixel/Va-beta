import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  DEFAULT_FEATURE_ROLLOUT_POLICY,
  type FeatureRolloutPolicy,
} from "@/lib/governance/featureRollout"
import { supabaseServer } from "@/lib/supabaseServer"

const RUNTIME_DIR = join(process.cwd(), ".runtime")
const POLICY_FILE = join(RUNTIME_DIR, "feature-rollout-policy.json")
const ROLLOUT_POLICIES_TABLE = "runtime_rollout_policies"
const FEATURE_POLICY_KEY = "feature_rollout"

type RuntimeRolloutPolicyRow = {
  policy_key: string
  policy: Partial<FeatureRolloutPolicy>
}

function isMissingRuntimeRolloutPoliciesTable(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase()
  return message.includes(ROLLOUT_POLICIES_TABLE) && message.includes("could not find the table")
}

export async function loadFeatureRolloutPolicy(): Promise<FeatureRolloutPolicy> {
  const { data, error } = await supabaseServer
    .from(ROLLOUT_POLICIES_TABLE)
    .select("policy_key, policy")
    .eq("policy_key", FEATURE_POLICY_KEY)
    .maybeSingle()

  if (!error && data) {
    const parsed = (data as RuntimeRolloutPolicyRow).policy
    const validMode =
      parsed.mode === "percentage" ||
      parsed.mode === "cohort" ||
      parsed.mode === "internal-only" ||
      parsed.mode === "recovery-only" ||
      parsed.mode === "shadow-mode"
        ? parsed.mode
        : DEFAULT_FEATURE_ROLLOUT_POLICY.mode

    return {
      ...DEFAULT_FEATURE_ROLLOUT_POLICY,
      ...parsed,
      mode: validMode,
      percentage: Math.max(0, Math.min(100, Number(parsed.percentage ?? DEFAULT_FEATURE_ROLLOUT_POLICY.percentage))),
      allowedCohorts: Array.isArray(parsed.allowedCohorts) ? parsed.allowedCohorts : [],
      internalUserIds: Array.isArray(parsed.internalUserIds) ? parsed.internalUserIds : [],
    }
  }

  if (error && !isMissingRuntimeRolloutPoliciesTable(error)) {
    throw new Error(`Failed to load feature rollout policy: ${error.message}`)
  }

  await mkdir(RUNTIME_DIR, { recursive: true })
  try {
    const raw = await readFile(POLICY_FILE, "utf8")
    const parsed = JSON.parse(raw) as Partial<FeatureRolloutPolicy>
    const validMode =
      parsed.mode === "percentage" ||
      parsed.mode === "cohort" ||
      parsed.mode === "internal-only" ||
      parsed.mode === "recovery-only" ||
      parsed.mode === "shadow-mode"
        ? parsed.mode
        : DEFAULT_FEATURE_ROLLOUT_POLICY.mode

    return {
      ...DEFAULT_FEATURE_ROLLOUT_POLICY,
      ...parsed,
      mode: validMode,
      percentage: Math.max(0, Math.min(100, Number(parsed.percentage ?? DEFAULT_FEATURE_ROLLOUT_POLICY.percentage))),
      allowedCohorts: Array.isArray(parsed.allowedCohorts) ? parsed.allowedCohorts : [],
      internalUserIds: Array.isArray(parsed.internalUserIds) ? parsed.internalUserIds : [],
    }
  } catch {
    return { ...DEFAULT_FEATURE_ROLLOUT_POLICY }
  }
}

export async function saveFeatureRolloutPolicy(partial: Partial<FeatureRolloutPolicy>) {
  const current = await loadFeatureRolloutPolicy()
  const validMode =
    partial.mode === "percentage" ||
    partial.mode === "cohort" ||
    partial.mode === "internal-only" ||
    partial.mode === "recovery-only" ||
    partial.mode === "shadow-mode"
      ? partial.mode
      : current.mode

  const next: FeatureRolloutPolicy = {
    ...current,
    ...partial,
    mode: validMode,
    percentage: Math.max(0, Math.min(100, Number(partial.percentage ?? current.percentage))),
    allowedCohorts: Array.isArray(partial.allowedCohorts) ? partial.allowedCohorts : current.allowedCohorts,
    internalUserIds: Array.isArray(partial.internalUserIds) ? partial.internalUserIds : current.internalUserIds,
  }

  const { error } = await supabaseServer
    .from(ROLLOUT_POLICIES_TABLE)
    .upsert(
      {
        policy_key: FEATURE_POLICY_KEY,
        policy: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "policy_key" },
    )

  if (error && !isMissingRuntimeRolloutPoliciesTable(error)) {
    throw new Error(`Failed to persist feature rollout policy: ${error.message}`)
  }

  if (error && isMissingRuntimeRolloutPoliciesTable(error)) {
    await mkdir(RUNTIME_DIR, { recursive: true })
    await writeFile(POLICY_FILE, JSON.stringify(next, null, 2), "utf8")
  }

  return next
}
