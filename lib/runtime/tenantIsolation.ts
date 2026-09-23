import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

const TENANT_ROOT = join(process.cwd(), ".runtime", "tenants")

export type TenantIsolationNamespace =
  | "runtime-state"
  | "personalization-memory"
  | "telemetry"
  | "replay-chain"
  | "recovery-history"

export type TenantPartitionPaths = {
  tenantId: string
  rootDir: string
  namespaces: Record<TenantIsolationNamespace, string>
}

export type TenantIsolationRecord = {
  tenantId: string
  userId: string
  namespace: TenantIsolationNamespace
  key: string
  updatedAt: number
  value: Record<string, unknown>
}

function sanitizeSegment(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "_")
}

function namespaceFilePath(tenantId: string, namespace: TenantIsolationNamespace): string {
  const safeTenant = sanitizeSegment(tenantId)
  return join(TENANT_ROOT, safeTenant, `${namespace}.json`)
}

async function readNamespaceStore(
  tenantId: string,
  namespace: TenantIsolationNamespace,
): Promise<Record<string, TenantIsolationRecord>> {
  const filePath = namespaceFilePath(tenantId, namespace)
  try {
    const raw = await readFile(filePath, "utf8")
    const parsed = JSON.parse(raw) as Record<string, TenantIsolationRecord>
    return typeof parsed === "object" && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

async function writeNamespaceStore(
  tenantId: string,
  namespace: TenantIsolationNamespace,
  store: Record<string, TenantIsolationRecord>,
): Promise<void> {
  const filePath = namespaceFilePath(tenantId, namespace)
  await mkdir(join(TENANT_ROOT, sanitizeSegment(tenantId)), { recursive: true })
  await writeFile(filePath, JSON.stringify(store, null, 2), "utf8")
}

export async function ensureTenantIsolation(tenantId: string): Promise<TenantPartitionPaths> {
  const safeTenant = sanitizeSegment(tenantId)
  const rootDir = join(TENANT_ROOT, safeTenant)
  await mkdir(rootDir, { recursive: true })

  const namespaces: Record<TenantIsolationNamespace, string> = {
    "runtime-state": join(rootDir, "runtime-state.json"),
    "personalization-memory": join(rootDir, "personalization-memory.json"),
    telemetry: join(rootDir, "telemetry.json"),
    "replay-chain": join(rootDir, "replay-chain.json"),
    "recovery-history": join(rootDir, "recovery-history.json"),
  }

  await Promise.all(
    Object.values(namespaces).map(async (filePath) => {
      try {
        await readFile(filePath, "utf8")
      } catch {
        await writeFile(filePath, "{}", "utf8")
      }
    }),
  )

  return {
    tenantId: safeTenant,
    rootDir,
    namespaces,
  }
}

export async function writeTenantIsolatedRecord(input: {
  tenantId: string
  userId: string
  namespace: TenantIsolationNamespace
  key: string
  value: Record<string, unknown>
}): Promise<TenantIsolationRecord> {
  const tenantId = sanitizeSegment(input.tenantId)
  await ensureTenantIsolation(tenantId)
  const store = await readNamespaceStore(tenantId, input.namespace)

  const record: TenantIsolationRecord = {
    tenantId,
    userId: input.userId,
    namespace: input.namespace,
    key: input.key,
    updatedAt: Date.now(),
    value: input.value,
  }

  store[input.key] = record
  await writeNamespaceStore(tenantId, input.namespace, store)
  return record
}

export async function readTenantIsolatedRecord(input: {
  tenantId: string
  namespace: TenantIsolationNamespace
  key: string
}): Promise<TenantIsolationRecord | null> {
  const store = await readNamespaceStore(sanitizeSegment(input.tenantId), input.namespace)
  return store[input.key] ?? null
}

export async function listTenantIsolatedRecords(input: {
  tenantId: string
  namespace: TenantIsolationNamespace
  limit?: number
}): Promise<TenantIsolationRecord[]> {
  const store = await readNamespaceStore(sanitizeSegment(input.tenantId), input.namespace)
  return Object.values(store)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, Math.max(1, input.limit ?? 100))
}
