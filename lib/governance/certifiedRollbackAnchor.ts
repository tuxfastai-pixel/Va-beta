/**
 * Certified Rollback Anchor Chain
 *
 * Extends the runtime snapshot system with:
 *   - HMAC-signed snapshot chain (each anchor signs its parent hash)
 *   - Snapshot lineage graph (parent → child navigation)
 *   - Rollback integrity verification
 *   - Runtime restoration simulation (dry-run without side effects)
 *
 * Creates legally auditable governance transitions and enterprise rollback
 * guarantees by maintaining a tamper-evident chain of certified states.
 */

import { createHash, createHmac } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { captureRuntimeSnapshot, exportRuntimeSnapshot, importRuntimeSnapshot, RuntimeSnapshot } from "./runtimeSnapshot.ts"
import { registerCertifiedAnchorPath } from "../runtime/selfHealingEngine.ts"

const RUNTIME_DIR = join(process.cwd(), ".runtime")
const ANCHOR_DIR = join(RUNTIME_DIR, "rollback-anchors")
const LINEAGE_FILE = join(RUNTIME_DIR, "anchor-lineage.jsonl")
const CHAIN_TIP_FILE = join(RUNTIME_DIR, "anchor-chain-tip.json")

// ---------------------------------------------------------------------------
// Signing key (environment variable; falls back to deterministic test value)
// ---------------------------------------------------------------------------

function getSigningKey(): string {
  const key = process.env.GOVERNANCE_SIGNING_KEY
  if (key && key.length >= 32) return key
  // Development/test fallback — not used in production.
  return "va-beta-governance-dev-signing-key-2025"
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RollbackAnchor = {
  anchorId: string
  snapshotId: string
  userId: string
  capturedAt: number
  parentAnchorId: string | null
  parentAnchorHash: string | null  // HMAC of parent anchor body
  selfHash: string                 // HMAC of this anchor's body (excluding selfHash)
  snapshotFilePath: string
  certifiedBy: "deterministic_runner" | "operator" | "self_healing" | "manual"
  governanceVersion: string
  lineageDepth: number
  notes: string[]
}

export type AnchorVerificationResult = {
  anchorId: string
  valid: boolean
  chainIntact: boolean
  errors: string[]
  lineageDepth: number
  capturedAt: number
}

export type RestorationSimulation = {
  anchorId: string
  wouldRestore: Partial<RuntimeSnapshot>
  estimatedRiskLevel: "low" | "medium" | "high"
  simulationWarnings: string[]
  restorationPlan: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hmac(key: string, data: string): string {
  return createHmac("sha256", key).update(data).digest("hex")
}

function anchorBodyString(anchor: Omit<RollbackAnchor, "selfHash">): string {
  // Deterministic stable serialisation for hashing.
  const keys = Object.keys(anchor).sort() as Array<keyof typeof anchor>
  const obj: Record<string, unknown> = {}
  for (const k of keys) obj[k] = anchor[k]
  return JSON.stringify(obj)
}

async function readAnchorById(anchorId: string): Promise<RollbackAnchor | null> {
  try {
    const raw = await readFile(join(ANCHOR_DIR, `${anchorId}.json`), "utf8")
    return JSON.parse(raw) as RollbackAnchor
  } catch {
    return null
  }
}

async function writeAnchor(anchor: RollbackAnchor): Promise<void> {
  await mkdir(ANCHOR_DIR, { recursive: true })
  await writeFile(join(ANCHOR_DIR, `${anchor.anchorId}.json`), JSON.stringify(anchor, null, 2), "utf8")
}

async function appendLineage(entry: { anchorId: string; parentAnchorId: string | null; capturedAt: number; userId: string }): Promise<void> {
  await mkdir(RUNTIME_DIR, { recursive: true })
  await writeFile(LINEAGE_FILE, JSON.stringify(entry) + "\n", { flag: "a", encoding: "utf8" })
}

async function getCurrentChainTip(): Promise<{ anchorId: string; selfHash: string } | null> {
  try {
    const raw = await readFile(CHAIN_TIP_FILE, "utf8")
    return JSON.parse(raw) as { anchorId: string; selfHash: string }
  } catch {
    return null
  }
}

async function saveChainTip(anchorId: string, selfHash: string): Promise<void> {
  await mkdir(RUNTIME_DIR, { recursive: true })
  await writeFile(CHAIN_TIP_FILE, JSON.stringify({ anchorId, selfHash, updatedAt: Date.now() }), "utf8")
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Capture the current runtime state and seal it as a certified rollback anchor.
 * The anchor is signed and chained to the previous anchor (if any).
 */
export async function createCertifiedAnchor(
  userId: string,
  options: {
    certifiedBy?: RollbackAnchor["certifiedBy"]
    notes?: string[]
  } = {},
): Promise<RollbackAnchor> {
  await mkdir(ANCHOR_DIR, { recursive: true })

  const snapshot = await captureRuntimeSnapshot(userId)

  // Write the snapshot file.
  const snapshotFilePath = join(ANCHOR_DIR, `snapshot-${snapshot.id}.json`)
  await exportRuntimeSnapshot(snapshot, snapshotFilePath)

  // Resolve chain tip.
  const tip = await getCurrentChainTip()
  const parentAnchorId = tip?.anchorId ?? null
  const parentAnchorHash = tip?.selfHash ?? null

  const anchorId = `anchor-${Date.now()}-${createHash("sha256").update(snapshot.id).digest("hex").slice(0, 8)}`

  // Read lineage depth from parent.
  let lineageDepth = 0
  if (parentAnchorId) {
    const parent = await readAnchorById(parentAnchorId)
    lineageDepth = (parent?.lineageDepth ?? 0) + 1
  }

  const anchorBody: Omit<RollbackAnchor, "selfHash"> = {
    anchorId,
    snapshotId: snapshot.id,
    userId,
    capturedAt: snapshot.capturedAt,
    parentAnchorId,
    parentAnchorHash,
    snapshotFilePath,
    certifiedBy: options.certifiedBy ?? "manual",
    governanceVersion: "16.0",
    lineageDepth,
    notes: options.notes ?? [],
  }

  const selfHash = hmac(getSigningKey(), anchorBodyString(anchorBody))
  const anchor: RollbackAnchor = { ...anchorBody, selfHash }

  await writeAnchor(anchor)
  await appendLineage({ anchorId, parentAnchorId, capturedAt: anchor.capturedAt, userId })
  await saveChainTip(anchorId, selfHash)
  await registerCertifiedAnchorPath(snapshotFilePath)

  return anchor
}

/**
 * Verify the integrity of an anchor and its parent chain.
 */
export async function verifyAnchorChain(anchorId: string): Promise<AnchorVerificationResult> {
  const errors: string[] = []
  const anchor = await readAnchorById(anchorId)

  if (!anchor) {
    return { anchorId, valid: false, chainIntact: false, errors: ["Anchor not found"], lineageDepth: 0, capturedAt: 0 }
  }

  // 1. Re-compute self hash.
  const { selfHash, ...body } = anchor
  const expectedHash = hmac(getSigningKey(), anchorBodyString(body))
  if (selfHash !== expectedHash) {
    errors.push("Self-hash mismatch — anchor may have been tampered with")
  }

  // 2. Verify parent hash linkage.
  let chainIntact = errors.length === 0
  if (anchor.parentAnchorId && anchor.parentAnchorHash) {
    const parent = await readAnchorById(anchor.parentAnchorId)
    if (!parent) {
      errors.push(`Parent anchor ${anchor.parentAnchorId} missing from store`)
      chainIntact = false
    } else if (parent.selfHash !== anchor.parentAnchorHash) {
      errors.push("Parent anchor hash mismatch — chain broken or tampered")
      chainIntact = false
    }
  }

  return {
    anchorId,
    valid: errors.length === 0,
    chainIntact,
    errors,
    lineageDepth: anchor.lineageDepth,
    capturedAt: anchor.capturedAt,
  }
}

/**
 * List the full lineage graph from JSONL (ordered oldest → newest).
 */
export async function listAnchorLineage(): Promise<Array<{ anchorId: string; parentAnchorId: string | null; capturedAt: number; userId: string }>> {
  try {
    const raw = await readFile(LINEAGE_FILE, "utf8")
    return raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l) as { anchorId: string; parentAnchorId: string | null; capturedAt: number; userId: string }
        } catch {
          return null
        }
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
  } catch {
    return []
  }
}

/**
 * Simulate (dry-run) restoring an anchor without applying any side effects.
 */
export async function simulateRollbackRestoration(anchorId: string): Promise<RestorationSimulation> {
  const anchor = await readAnchorById(anchorId)
  const warnings: string[] = []
  const plan: string[] = []

  if (!anchor) {
    return {
      anchorId,
      wouldRestore: {},
      estimatedRiskLevel: "high",
      simulationWarnings: ["Anchor not found — restoration impossible"],
      restorationPlan: [],
    }
  }

  // Read snapshot payload without applying it.
  let snapshotPreview: Partial<RuntimeSnapshot> = {}
  try {
    const raw = await readFile(anchor.snapshotFilePath, "utf8")
    snapshotPreview = JSON.parse(raw) as Partial<RuntimeSnapshot>
  } catch {
    warnings.push("Snapshot file missing — partial restoration only")
  }

  // Estimate risk based on lineage depth and age.
  const ageMs = Date.now() - anchor.capturedAt
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  let riskLevel: RestorationSimulation["estimatedRiskLevel"] = "low"
  if (ageDays > 7) {
    riskLevel = "medium"
    warnings.push(`Anchor is ${ageDays.toFixed(1)} days old — personalization state may be stale`)
  }
  if (ageDays > 30) {
    riskLevel = "high"
    warnings.push("Anchor >30 days old — restoring may cause significant behavioural regression")
  }

  plan.push(`1. Verify chain integrity for anchor ${anchorId}`)
  plan.push(`2. Snapshot from ${new Date(anchor.capturedAt).toISOString()} by ${anchor.certifiedBy}`)
  plan.push(`3. Apply deploymentSafetyConfig: ${JSON.stringify(snapshotPreview.deploymentSafetyConfig ?? {})}`)
  plan.push(`4. Apply activeRolloutModes: ${JSON.stringify(snapshotPreview.activeRolloutModes ?? {})}`)
  plan.push(`5. Restore orchestrationConstraints`)
  plan.push(`6. Register restored anchor as new chain tip`)

  return {
    anchorId,
    wouldRestore: snapshotPreview,
    estimatedRiskLevel: riskLevel,
    simulationWarnings: warnings,
    restorationPlan: plan,
  }
}

/**
 * Apply a certified rollback anchor (full restore with chain verification).
 * Throws if the chain is broken — requires force=true to override.
 */
export async function applyRollbackAnchor(anchorId: string, options: { force?: boolean } = {}): Promise<void> {
  const verification = await verifyAnchorChain(anchorId)
  if (!verification.valid && !options.force) {
    throw new Error(`Rollback anchor ${anchorId} failed integrity check: ${verification.errors.join("; ")}`)
  }

  const anchor = await readAnchorById(anchorId)
  if (!anchor) throw new Error(`Anchor ${anchorId} not found`)

  await importRuntimeSnapshot({ snapshotOrPath: anchor.snapshotFilePath, replayMode: "off" })
  // Register the restored anchor as the new chain tip to preserve lineage.
  await saveChainTip(anchor.anchorId, anchor.selfHash)
}
