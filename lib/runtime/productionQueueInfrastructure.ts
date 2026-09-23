import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

const QUEUE_DIR = join(process.cwd(), ".runtime", "production-queues")

export type QueueName =
  | "governance-events"
  | "telemetry-batch"
  | "replay-index"
  | "orchestration-retry"

export type QueueJobStatus = "queued" | "processing" | "succeeded" | "failed" | "dead-lettered"

export type QueueJob = {
  id: string
  queue: QueueName
  tenantId: string
  createdAt: number
  updatedAt: number
  attempts: number
  maxAttempts: number
  status: QueueJobStatus
  lockOwner: string | null
  payload: Record<string, unknown>
  error: string | null
}

export type QueueSnapshot = {
  queue: QueueName
  queued: number
  processing: number
  failed: number
  deadLettered: number
  succeeded: number
}

function sanitize(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "_")
}

function queueFile(queue: QueueName): string {
  return join(QUEUE_DIR, `${queue}.json`)
}

async function readQueue(queue: QueueName): Promise<QueueJob[]> {
  try {
    const raw = await readFile(queueFile(queue), "utf8")
    const parsed = JSON.parse(raw) as QueueJob[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeQueue(queue: QueueName, jobs: QueueJob[]): Promise<void> {
  await mkdir(QUEUE_DIR, { recursive: true })
  await writeFile(queueFile(queue), JSON.stringify(jobs, null, 2), "utf8")
}

export async function enqueueDurableEvent(input: {
  queue: QueueName
  tenantId: string
  payload: Record<string, unknown>
  maxAttempts?: number
}): Promise<QueueJob> {
  const queue = input.queue
  const jobs = await readQueue(queue)

  const job: QueueJob = {
    id: `${queue}:${Date.now().toString(16)}:${Math.random().toString(16).slice(2, 8)}`,
    queue,
    tenantId: sanitize(input.tenantId),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    attempts: 0,
    maxAttempts: Math.max(1, input.maxAttempts ?? 3),
    status: "queued",
    lockOwner: null,
    payload: input.payload,
    error: null,
  }

  jobs.push(job)
  await writeQueue(queue, jobs)
  return job
}

export async function acquireQueueJobLock(input: {
  queue: QueueName
  ownerId: string
}): Promise<QueueJob | null> {
  const jobs = await readQueue(input.queue)
  const job = jobs.find((entry) => entry.status === "queued")
  if (!job) return null

  job.status = "processing"
  job.lockOwner = input.ownerId
  job.updatedAt = Date.now()
  await writeQueue(input.queue, jobs)
  return job
}

export async function completeQueueJob(input: {
  queue: QueueName
  jobId: string
  ownerId: string
}): Promise<boolean> {
  const jobs = await readQueue(input.queue)
  const job = jobs.find((entry) => entry.id === input.jobId)
  if (!job || job.lockOwner !== input.ownerId) return false

  job.status = "succeeded"
  job.updatedAt = Date.now()
  job.lockOwner = null
  await writeQueue(input.queue, jobs)
  return true
}

export async function failQueueJob(input: {
  queue: QueueName
  jobId: string
  ownerId: string
  error: string
}): Promise<boolean> {
  const jobs = await readQueue(input.queue)
  const job = jobs.find((entry) => entry.id === input.jobId)
  if (!job || job.lockOwner !== input.ownerId) return false

  job.attempts += 1
  job.updatedAt = Date.now()
  job.error = input.error

  if (job.attempts >= job.maxAttempts) {
    job.status = "dead-lettered"
    job.lockOwner = null
  } else {
    job.status = "queued"
    job.lockOwner = null
  }

  await writeQueue(input.queue, jobs)
  return true
}

export async function getQueueSnapshot(queue: QueueName): Promise<QueueSnapshot> {
  const jobs = await readQueue(queue)
  return {
    queue,
    queued: jobs.filter((j) => j.status === "queued").length,
    processing: jobs.filter((j) => j.status === "processing").length,
    failed: jobs.filter((j) => j.status === "failed").length,
    deadLettered: jobs.filter((j) => j.status === "dead-lettered").length,
    succeeded: jobs.filter((j) => j.status === "succeeded").length,
  }
}

export async function listQueueJobs(queue: QueueName, limit = 100): Promise<QueueJob[]> {
  const jobs = await readQueue(queue)
  return jobs.slice().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, Math.max(1, limit))
}

export async function batchTelemetryEvents(input: {
  tenantId: string
  events: Array<Record<string, unknown>>
}): Promise<QueueJob> {
  return enqueueDurableEvent({
    queue: "telemetry-batch",
    tenantId: input.tenantId,
    payload: {
      count: input.events.length,
      events: input.events,
      batchedAt: Date.now(),
    },
    maxAttempts: 5,
  })
}

export async function appendReplayIndexRecord(input: {
  tenantId: string
  record: Record<string, unknown>
}): Promise<QueueJob> {
  return enqueueDurableEvent({
    queue: "replay-index",
    tenantId: input.tenantId,
    payload: {
      ...input.record,
      indexedAt: Date.now(),
    },
    maxAttempts: 4,
  })
}
