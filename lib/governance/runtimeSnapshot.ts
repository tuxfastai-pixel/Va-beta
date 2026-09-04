import { createHash, createHmac } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { supabaseServer } from "@/lib/supabaseServer"

import { loadAutonomyProfile, summarizeAutonomyProfile } from "../autonomy/autonomyProfile.ts"
import { loadSessionContinuityRecord } from "../continuity/sessionContinuityStore.ts"
import { applyDeploymentSafety } from "./deploymentSafety.ts"
import { loadDeploymentSafetyConfig, saveDeploymentSafetyConfig } from "./deploymentSafetyStore.ts"
import { loadFeatureRolloutPolicy, saveFeatureRolloutPolicy } from "./featureRolloutStore.ts"
import { loadPersonalizationRolloutPolicy, savePersonalizationRolloutPolicy } from "../personalization/personalizationRolloutStore.ts"
import { getPersonalizationState, loadPersonalizationStates, savePersonalizationStates } from "../personalization/personalizationStore.ts"
import { loadTrustHistoryRecord, summarizeTrustHistory } from "../trust/trustHistoryStore.ts"

export type RuntimeSnapshotReplayMode = "off" | "replay"

export type CertifiedRollbackAnchor = {
  anchorId: string
  snapshotId: string
  userId: string
  createdAt: number
  snapshotPath: string
  checksum: string
  parentAnchorId: string | null
  lineageDepth: number
  reason: string
  signature: string
}

export type SnapshotLineageGraph = {
  nodes: Array<{
    anchorId: string
    snapshotId: string
    userId: string
    createdAt: number
    lineageDepth: number
  }>
  edges: Array<{
    fromAnchorId: string
    toAnchorId: string
  }>
}

export type RollbackIntegrityVerification = {
  valid: boolean
  reasons: string[]
  anchor: CertifiedRollbackAnchor | null
}

export type RuntimeRestorationSimulation = {
  ok: boolean
  anchorId: string
  replayMode: RuntimeSnapshotReplayMode
  checksumValid: boolean
  signatureValid: boolean
  parentIntegrityValid: boolean
  warnings: string[]
}

export type RuntimeSnapshot = {
  id: string
  capturedAt: number
  userId: string
  deploymentSafetyConfig: Awaited<ReturnType<typeof loadDeploymentSafetyConfig>>
  trustRegime: ReturnType<typeof summarizeTrustHistory>["trustRegime"]
  autonomyTier: ReturnType<typeof summarizeAutonomyProfile>["tier"]
  personalizationState: {
    profileConfidence: number
    trustConfidence: number
    identityFingerprint: string
    updatedAt: number
  } | null
  continuityConfidence: number
  activeRolloutModes: {
    featureRolloutMode: string
    personalizationRolloutMode: string
    operationalMode: string
  }
  orchestrationConstraints: {
    orchestrationEnabled: boolean
    autonomousPacingEnabled: boolean
    workspaceAdaptiveEnabled: boolean
    notificationMode: "normal" | "quiet"
    rationale: string[]
  }
  equilibriumPosture: "stable" | "guarded" | "recovery"
  fatiguePredictionState: {
    risk: number
    sourceSignal: number
  }
  notificationCadenceState: {
    cadence: "quiet" | "balanced" | "normal"
    dismissalPressure: number
  }
  checksum: string
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`
  }

  const object = value as Record<string, unknown>
  const keys = Object.keys(object).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(",")}}`
}

function computeChecksumFromBody(snapshot: Omit<RuntimeSnapshot, "checksum">): string {
  const hash = createHash("sha256")
  hash.update(stableStringify(snapshot))
  return hash.digest("hex")
}

const SNAPSHOT_ANCHOR_DIR = join(process.cwd(), ".runtime", "certified-snapshots")
const SNAPSHOT_ANCHOR_CHAIN_LOG = join(SNAPSHOT_ANCHOR_DIR, "anchor-chain.jsonl")
const RUNTIME_SNAPSHOTS_TABLE = "runtime_snapshots"
const RUNTIME_SNAPSHOT_ANCHORS_TABLE = "runtime_snapshot_anchors"

type RuntimeSnapshotRow = {
  snapshot_id: string
  user_id: string
  captured_at: number
  checksum: string
  snapshot_path: string | null
  payload: RuntimeSnapshot
}

type RuntimeSnapshotAnchorRow = {
  anchor_id: string
  snapshot_id: string
  user_id: string
  created_at_ms: number
  snapshot_path: string
  checksum: string
  parent_anchor_id: string | null
  lineage_depth: number
  reason: string
  signature: string
}

function isMissingRuntimeSnapshotsTable(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase()
  return message.includes(RUNTIME_SNAPSHOTS_TABLE) && message.includes("could not find the table")
}

function isMissingRuntimeSnapshotAnchorsTable(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase()
  return message.includes(RUNTIME_SNAPSHOT_ANCHORS_TABLE) && message.includes("could not find the table")
}

async function upsertRuntimeSnapshot(snapshot: RuntimeSnapshot, snapshotPath?: string): Promise<void> {
  const { error } = await supabaseServer
    .from(RUNTIME_SNAPSHOTS_TABLE)
    .upsert(
      {
        snapshot_id: snapshot.id,
        user_id: snapshot.userId,
        captured_at: snapshot.capturedAt,
        checksum: snapshot.checksum,
        snapshot_path: snapshotPath ?? null,
        payload: snapshot,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "snapshot_id" },
    )

  if (error && !isMissingRuntimeSnapshotsTable(error)) {
    throw new Error(`Failed to persist runtime snapshot: ${error.message}`)
  }
}

async function loadRuntimeSnapshotById(snapshotId: string): Promise<RuntimeSnapshot | null> {
  const { data, error } = await supabaseServer
    .from(RUNTIME_SNAPSHOTS_TABLE)
    .select("snapshot_id, user_id, captured_at, checksum, snapshot_path, payload")
    .eq("snapshot_id", snapshotId)
    .maybeSingle()

  if (error && !isMissingRuntimeSnapshotsTable(error)) {
    throw new Error(`Failed to load runtime snapshot: ${error.message}`)
  }

  if (!data) {
    return null
  }

  return (data as RuntimeSnapshotRow).payload
}

function toAnchorRow(anchor: CertifiedRollbackAnchor): RuntimeSnapshotAnchorRow {
  return {
    anchor_id: anchor.anchorId,
    snapshot_id: anchor.snapshotId,
    user_id: anchor.userId,
    created_at_ms: anchor.createdAt,
    snapshot_path: anchor.snapshotPath,
    checksum: anchor.checksum,
    parent_anchor_id: anchor.parentAnchorId,
    lineage_depth: anchor.lineageDepth,
    reason: anchor.reason,
    signature: anchor.signature,
  }
}

function fromAnchorRow(row: RuntimeSnapshotAnchorRow): CertifiedRollbackAnchor {
  return {
    anchorId: row.anchor_id,
    snapshotId: row.snapshot_id,
    userId: row.user_id,
    createdAt: row.created_at_ms,
    snapshotPath: row.snapshot_path,
    checksum: row.checksum,
    parentAnchorId: row.parent_anchor_id,
    lineageDepth: row.lineage_depth,
    reason: row.reason,
    signature: row.signature,
  }
}

function anchorSigningKey(): string {
  return process.env.RUNTIME_SNAPSHOT_SIGNING_KEY?.trim() || "dev-runtime-snapshot-signing-key"
}

function anchorSigningPayload(anchor: Omit<CertifiedRollbackAnchor, "signature">): string {
  return stableStringify({
    anchorId: anchor.anchorId,
    snapshotId: anchor.snapshotId,
    userId: anchor.userId,
    createdAt: anchor.createdAt,
    snapshotPath: anchor.snapshotPath,
    checksum: anchor.checksum,
    parentAnchorId: anchor.parentAnchorId,
    lineageDepth: anchor.lineageDepth,
    reason: anchor.reason,
  })
}

function signAnchor(anchor: Omit<CertifiedRollbackAnchor, "signature">): string {
  const hmac = createHmac("sha256", anchorSigningKey())
  hmac.update(anchorSigningPayload(anchor))
  return hmac.digest("hex")
}

function validateAnchorSignature(anchor: CertifiedRollbackAnchor): boolean {
  const { signature, ...body } = anchor
  return signature === signAnchor(body)
}

async function loadAnchorChain(limit = 500): Promise<CertifiedRollbackAnchor[]> {
  const { data, error } = await supabaseServer
    .from(RUNTIME_SNAPSHOT_ANCHORS_TABLE)
    .select("anchor_id, snapshot_id, user_id, created_at_ms, snapshot_path, checksum, parent_anchor_id, lineage_depth, reason, signature")
    .order("created_at_ms", { ascending: false })
    .limit(Math.max(1, limit))

  if (!error && Array.isArray(data)) {
    return (data as RuntimeSnapshotAnchorRow[]).map((row) => fromAnchorRow(row))
  }

  if (error && !isMissingRuntimeSnapshotAnchorsTable(error)) {
    throw new Error(`Failed to load rollback anchors: ${error.message}`)
  }

  try {
    const raw = await readFile(SNAPSHOT_ANCHOR_CHAIN_LOG, "utf8")
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as CertifiedRollbackAnchor
        } catch {
          return null
        }
      })
      .filter((entry): entry is CertifiedRollbackAnchor => entry !== null)
      .slice(-Math.max(1, limit))
      .sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

export function computeRuntimeSnapshotChecksum(snapshot: RuntimeSnapshot): string {
  const { checksum, ...body } = snapshot
  void checksum
  return computeChecksumFromBody(body)
}

export function validateRuntimeSnapshotChecksum(snapshot: RuntimeSnapshot): boolean {
  return snapshot.checksum === computeRuntimeSnapshotChecksum(snapshot)
}

function continuityConfidence(record: Awaited<ReturnType<typeof loadSessionContinuityRecord>>): number {
  const history = record.equilibriumRecoveryHistory.slice(-10)
  if (history.length <= 0) {
    return 0.5
  }
  return clamp01(history.reduce((sum, item) => sum + item.confidence, 0) / history.length)
}

function equilibriumPostureFor(input: {
  trustRegime: ReturnType<typeof summarizeTrustHistory>["trustRegime"]
  continuityConfidence: number
  safeMode: boolean
}): RuntimeSnapshot["equilibriumPosture"] {
  if (input.safeMode || input.continuityConfidence < 0.45 || input.trustRegime === "guarded") {
    return "recovery"
  }
  if (input.continuityConfidence < 0.65) {
    return "guarded"
  }
  return "stable"
}

export async function captureRuntimeSnapshot(userId: string): Promise<RuntimeSnapshot> {
  const deploymentSafety = await loadDeploymentSafetyConfig()
  const featureRollout = await loadFeatureRolloutPolicy()
  const personalizationRollout = await loadPersonalizationRolloutPolicy()
  const trustRecord = await loadTrustHistoryRecord(userId)
  const trustSummary = summarizeTrustHistory(trustRecord)
  const autonomy = summarizeAutonomyProfile(await loadAutonomyProfile(userId))
  const personalization = await getPersonalizationState(userId)
  const continuity = await loadSessionContinuityRecord(userId)

  const continuityScore = continuityConfidence(continuity)
  const uiSafety = applyDeploymentSafety(
    trustSummary.trustRegime === "guarded" ? "recovery" : "balanced",
    deploymentSafety,
  )

  const fatigueSignal = trustSummary.latestSignals?.sessionHesitationRate ?? 0.5
  const dismissalPressure = trustSummary.latestSignals?.notificationDismissalRate ?? 0.5

  const snapshotBody: Omit<RuntimeSnapshot, "checksum"> = {
    id: `runtime-snapshot:${userId}:${Date.now().toString(16)}`,
    capturedAt: Date.now(),
    userId,
    deploymentSafetyConfig: deploymentSafety,
    trustRegime: trustSummary.trustRegime,
    autonomyTier: autonomy.tier,
    personalizationState: personalization
      ? {
          profileConfidence: clamp01(personalization.profile.stabilityIndex),
          trustConfidence: clamp01(personalization.trust.trustStability),
          identityFingerprint: personalization.identity.fingerprint,
          updatedAt: personalization.updatedAt,
        }
      : null,
    continuityConfidence: continuityScore,
    activeRolloutModes: {
      featureRolloutMode: featureRollout.mode,
      personalizationRolloutMode: personalizationRollout.mode,
      operationalMode: deploymentSafety.operationalMode,
    },
    orchestrationConstraints: {
      orchestrationEnabled: uiSafety.orchestrationEnabled,
      autonomousPacingEnabled: uiSafety.autonomousPacingEnabled,
      workspaceAdaptiveEnabled: uiSafety.workspaceAdaptiveEnabled,
      notificationMode: uiSafety.notificationMode,
      rationale: uiSafety.rationale,
    },
    equilibriumPosture: equilibriumPostureFor({
      trustRegime: trustSummary.trustRegime,
      continuityConfidence: continuityScore,
      safeMode: deploymentSafety.safeMode,
    }),
    fatiguePredictionState: {
      risk: clamp01(fatigueSignal * 0.65 + (1 - continuityScore) * 0.35),
      sourceSignal: clamp01(fatigueSignal),
    },
    notificationCadenceState: {
      cadence: uiSafety.notificationMode === "quiet" ? "quiet" : trustSummary.trustRegime === "progressive" ? "normal" : "balanced",
      dismissalPressure: clamp01(dismissalPressure),
    },
  }

  return {
    ...snapshotBody,
    checksum: computeChecksumFromBody(snapshotBody),
  }
}

export async function exportRuntimeSnapshot(snapshot: RuntimeSnapshot, filePath: string): Promise<{ filePath: string; checksum: string }> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf8")
  await upsertRuntimeSnapshot(snapshot, filePath)
  return {
    filePath,
    checksum: snapshot.checksum,
  }
}

export async function readRuntimeSnapshot(filePath: string): Promise<RuntimeSnapshot> {
  const raw = await readFile(filePath, "utf8")
  const parsed = JSON.parse(raw) as RuntimeSnapshot
  return parsed
}

export async function importRuntimeSnapshot(params: {
  snapshotOrPath: RuntimeSnapshot | string
  replayMode?: RuntimeSnapshotReplayMode
}): Promise<{ replayMode: RuntimeSnapshotReplayMode; checksumValid: boolean }> {
  const replayMode = params.replayMode ?? "replay"
  const snapshot = typeof params.snapshotOrPath === "string"
    ? await readRuntimeSnapshot(params.snapshotOrPath)
    : params.snapshotOrPath

  const checksumValid = validateRuntimeSnapshotChecksum(snapshot)
  if (!checksumValid) {
    throw new Error("Runtime snapshot checksum validation failed")
  }

  await saveDeploymentSafetyConfig({
    ...snapshot.deploymentSafetyConfig,
    updatedAt: new Date(snapshot.capturedAt),
    reason: replayMode === "replay" ? "runtime-snapshot-import" : snapshot.deploymentSafetyConfig.reason,
  })

  await saveFeatureRolloutPolicy({
    mode: snapshot.activeRolloutModes.featureRolloutMode as "percentage" | "cohort" | "internal-only" | "recovery-only" | "shadow-mode",
  })

  await savePersonalizationRolloutPolicy({
    mode: snapshot.activeRolloutModes.personalizationRolloutMode as "percentage" | "cohort" | "internal-only" | "recovery-only" | "shadow-mode",
  })

  if (snapshot.personalizationState) {
    const states = await loadPersonalizationStates()
    const existing = states[snapshot.userId]
    if (existing) {
      existing.identity = {
        ...existing.identity,
        fingerprint: snapshot.personalizationState.identityFingerprint,
      }
      existing.updatedAt = snapshot.personalizationState.updatedAt
      states[snapshot.userId] = existing
      await savePersonalizationStates(states)
    }
  }

  return {
    replayMode,
    checksumValid,
  }
}

export async function snapshotReplayMode(filePath: string): Promise<RuntimeSnapshot> {
  const snapshot = await readRuntimeSnapshot(filePath)
  await importRuntimeSnapshot({ snapshotOrPath: snapshot, replayMode: "replay" })
  return snapshot
}

export async function defaultSnapshotPath(userId: string): Promise<string> {
  const runtimeDir = join(process.cwd(), ".runtime", "snapshots")
  await mkdir(runtimeDir, { recursive: true })
  return join(runtimeDir, `${userId}-${Date.now().toString(16)}.snapshot.json`)
}

export async function createCertifiedRollbackAnchor(input: {
  snapshot: RuntimeSnapshot
  snapshotPath: string
  reason?: string
}): Promise<CertifiedRollbackAnchor> {
  await upsertRuntimeSnapshot(input.snapshot, input.snapshotPath)
  await mkdir(SNAPSHOT_ANCHOR_DIR, { recursive: true })
  const chain = await loadAnchorChain(10_000)
  const latestForUser = chain.find((item) => item.userId === input.snapshot.userId) ?? null

  const unsignedAnchor: Omit<CertifiedRollbackAnchor, "signature"> = {
    anchorId: `anchor:${input.snapshot.userId}:${Date.now().toString(16)}`,
    snapshotId: input.snapshot.id,
    userId: input.snapshot.userId,
    createdAt: Date.now(),
    snapshotPath: input.snapshotPath,
    checksum: input.snapshot.checksum,
    parentAnchorId: latestForUser?.anchorId ?? null,
    lineageDepth: latestForUser ? latestForUser.lineageDepth + 1 : 0,
    reason: input.reason ?? "certified rollback anchor",
  }

  const anchor: CertifiedRollbackAnchor = {
    ...unsignedAnchor,
    signature: signAnchor(unsignedAnchor),
  }

  const { error } = await supabaseServer
    .from(RUNTIME_SNAPSHOT_ANCHORS_TABLE)
    .upsert(toAnchorRow(anchor), { onConflict: "anchor_id" })

  if (!error) {
    return anchor
  }

  if (error && !isMissingRuntimeSnapshotAnchorsTable(error)) {
    throw new Error(`Failed to persist rollback anchor: ${error.message}`)
  }

  await writeFile(SNAPSHOT_ANCHOR_CHAIN_LOG, `${JSON.stringify(anchor)}\n`, { flag: "a", encoding: "utf8" })
  return anchor
}

export async function listCertifiedRollbackAnchors(options?: {
  userId?: string
  limit?: number
}): Promise<CertifiedRollbackAnchor[]> {
  const entries = await loadAnchorChain(options?.limit ?? 200)
  const userId = options?.userId?.trim()
  return userId ? entries.filter((entry) => entry.userId === userId) : entries
}

export async function buildSnapshotLineageGraph(options?: {
  userId?: string
  limit?: number
}): Promise<SnapshotLineageGraph> {
  const chain = await listCertifiedRollbackAnchors(options)
  const nodes = chain.map((item) => ({
    anchorId: item.anchorId,
    snapshotId: item.snapshotId,
    userId: item.userId,
    createdAt: item.createdAt,
    lineageDepth: item.lineageDepth,
  }))
  const edges = chain
    .filter((item) => item.parentAnchorId)
    .map((item) => ({
      fromAnchorId: item.parentAnchorId as string,
      toAnchorId: item.anchorId,
    }))

  return { nodes, edges }
}

export async function verifyRollbackAnchorIntegrity(anchorOrId: string | CertifiedRollbackAnchor): Promise<RollbackIntegrityVerification> {
  const reasons: string[] = []
  const chain = await listCertifiedRollbackAnchors({ limit: 10_000 })
  const anchor = typeof anchorOrId === "string"
    ? chain.find((entry) => entry.anchorId === anchorOrId) ?? null
    : anchorOrId

  if (!anchor) {
    return { valid: false, reasons: ["anchor not found"], anchor: null }
  }

  if (!validateAnchorSignature(anchor)) {
    reasons.push("anchor signature mismatch")
  }

  try {
    const snapshot = (await loadRuntimeSnapshotById(anchor.snapshotId)) ?? (await readRuntimeSnapshot(anchor.snapshotPath))
    if (!validateRuntimeSnapshotChecksum(snapshot)) {
      reasons.push("snapshot checksum invalid")
    }
    if (snapshot.id !== anchor.snapshotId) {
      reasons.push("snapshot id does not match anchor")
    }
    if (snapshot.checksum !== anchor.checksum) {
      reasons.push("anchor checksum does not match snapshot")
    }
  } catch {
    reasons.push("snapshot file missing or unreadable")
  }

  if (anchor.parentAnchorId) {
    const parent = chain.find((entry) => entry.anchorId === anchor.parentAnchorId)
    if (!parent) {
      reasons.push("parent anchor missing")
    } else if (!validateAnchorSignature(parent)) {
      reasons.push("parent anchor signature invalid")
    }
  }

  return {
    valid: reasons.length === 0,
    reasons,
    anchor,
  }
}

export async function simulateRuntimeRestorationFromAnchor(params: {
  anchorOrId: string | CertifiedRollbackAnchor
  replayMode?: RuntimeSnapshotReplayMode
}): Promise<RuntimeRestorationSimulation> {
  const verification = await verifyRollbackAnchorIntegrity(params.anchorOrId)
  if (!verification.valid || !verification.anchor) {
    return {
      ok: false,
      anchorId: typeof params.anchorOrId === "string" ? params.anchorOrId : params.anchorOrId.anchorId,
      replayMode: params.replayMode ?? "off",
      checksumValid: false,
      signatureValid: false,
      parentIntegrityValid: false,
      warnings: verification.reasons,
    }
  }

  const anchor = verification.anchor
  const replayMode = params.replayMode ?? "off"
  const signatureValid = validateAnchorSignature(anchor)
  const parentIntegrityValid = anchor.parentAnchorId
    ? (await verifyRollbackAnchorIntegrity(anchor.parentAnchorId)).valid
    : true

  const snapshot = (await loadRuntimeSnapshotById(anchor.snapshotId)) ?? anchor.snapshotPath
  const imported = await importRuntimeSnapshot({ snapshotOrPath: snapshot, replayMode })

  return {
    ok: imported.checksumValid && signatureValid && parentIntegrityValid,
    anchorId: anchor.anchorId,
    replayMode,
    checksumValid: imported.checksumValid,
    signatureValid,
    parentIntegrityValid,
    warnings: verification.reasons,
  }
}
