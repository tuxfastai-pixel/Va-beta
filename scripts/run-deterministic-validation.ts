import { createHash } from "node:crypto"
import { mkdir, rename, rm, writeFile, readFile, cp, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { spawn } from "node:child_process"

const projectRoot = process.cwd()
const runtimeDir = join(projectRoot, ".runtime")
const backupDir = join(projectRoot, ".runtime.backup-deterministic")
const seedDir = join(projectRoot, ".runtime.seed-deterministic")
const pidFile = join(projectRoot, ".deterministic-validation.pid")
const reportDir = join(projectRoot, "governance-certification-reports")

const deterministicNow = process.env.DETERMINISTIC_NOW ?? "1735689600000"
const deterministicSeed = process.env.DETERMINISTIC_SEED ?? "20260524"

const testPatterns = [
  "tests/governance/*.test.ts",
  "tests/trust/*.test.ts",
  "tests/replay/*.test.ts",
  "tests/autonomy/*.test.ts",
]

type SuiteRunResult = {
  pattern: string
  ok: boolean
  exitCode: number
  durationMs: number
  command: string
  error?: string
}

type DeterministicCertificationReport = {
  id: string
  generatedAt: string
  deterministic: {
    fixedNow: number
    seed: number
  }
  environment: {
    cwd: string
    runtimeIsolated: boolean
    singleThread: boolean
  }
  suites: SuiteRunResult[]
  summary: {
    totalSuites: number
    passedSuites: number
    failedSuites: number
    totalDurationMs: number
    certified: boolean
  }
  checksum: string
}

async function removeIfExists(path: string) {
  if (existsSync(path)) {
    await rm(path, { recursive: true, force: true })
  }
}

async function safeRestoreRuntime() {
  await removeIfExists(runtimeDir)
  if (existsSync(backupDir)) {
    await rename(backupDir, runtimeDir)
  }
}

async function cleanupStaleRunner() {
  if (!existsSync(pidFile)) {
    return
  }

  try {
    const raw = await readFile(pidFile, "utf8")
    const pid = Number(raw.trim())
    if (Number.isFinite(pid) && pid > 0 && pid !== process.pid) {
      try {
        process.kill(pid, "SIGTERM")
      } catch {
        // Ignore stale or inaccessible process.
      }
    }
  } catch {
    // Ignore malformed pid file.
  }

  await rm(pidFile, { force: true })
}

async function setupDeterministicRuntime() {
  await cleanupStaleRunner()
  await writeFile(pidFile, String(process.pid), "utf8")

  await removeIfExists(backupDir)
  if (existsSync(runtimeDir)) {
    await rename(runtimeDir, backupDir)
  }

  await mkdir(runtimeDir, { recursive: true })

  if (existsSync(seedDir)) {
    await cp(seedDir, runtimeDir, { recursive: true })
  }

  // Isolated telemetry stores and replay seed reset.
  await writeFile(join(runtimeDir, "equilibrium-events.jsonl"), "", "utf8")
  await writeFile(join(runtimeDir, "shadow-mode-decisions.jsonl"), "", "utf8")
  await writeFile(join(runtimeDir, "invariant-audit-log.jsonl"), "", "utf8")
  await writeFile(join(runtimeDir, "decision-provenance.jsonl"), "", "utf8")

  // Touch deterministic marker for audit traceability.
  await writeFile(
    join(runtimeDir, "deterministic-run-meta.json"),
    JSON.stringify(
      {
        fixedNow: Number(deterministicNow),
        seed: Number(deterministicSeed),
        initializedAt: Date.now(),
      },
      null,
      2,
    ),
    "utf8",
  )
}

function runCommand(command: string, args: string[], env: Record<string, string>): Promise<{ ok: boolean; exitCode: number; error?: string; durationMs: number }> {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: "inherit",
      shell: false,
      env: {
        ...process.env,
        ...env,
      },
    })

    child.on("error", (error) => {
      resolve({
        ok: false,
        exitCode: 1,
        error: error.message,
        durationMs: Date.now() - startedAt,
      })
    })

    child.on("exit", (code) => {
      resolve({
        ok: code === 0,
        exitCode: typeof code === "number" ? code : 1,
        error: code === 0 ? undefined : `${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}`,
        durationMs: Date.now() - startedAt,
      })
    })
  })
}

async function assertNoOtherNodeLoad() {
  // A lightweight indicator to ensure temp runtime is isolated and available.
  await stat(runtimeDir)
}

function computeReportChecksum(report: Omit<DeterministicCertificationReport, "checksum">): string {
  const hash = createHash("sha256")
  hash.update(JSON.stringify(report))
  return hash.digest("hex")
}

function toMarkdownReport(report: DeterministicCertificationReport): string {
  const lines: string[] = []
  lines.push("# Deterministic Governance Certification Report")
  lines.push("")
  lines.push(`- Report ID: ${report.id}`)
  lines.push(`- Generated At: ${report.generatedAt}`)
  lines.push(`- Deterministic Clock: ${report.deterministic.fixedNow}`)
  lines.push(`- Seed: ${report.deterministic.seed}`)
  lines.push(`- Certified: ${report.summary.certified ? "yes" : "no"}`)
  lines.push(`- Checksum: ${report.checksum}`)
  lines.push("")
  lines.push("## Summary")
  lines.push("")
  lines.push(`- Total Suites: ${report.summary.totalSuites}`)
  lines.push(`- Passed Suites: ${report.summary.passedSuites}`)
  lines.push(`- Failed Suites: ${report.summary.failedSuites}`)
  lines.push(`- Total Duration (ms): ${report.summary.totalDurationMs}`)
  lines.push("")
  lines.push("## Suites")
  lines.push("")
  lines.push("| Pattern | Status | Exit Code | Duration (ms) |")
  lines.push("|---|---:|---:|---:|")
  for (const suite of report.suites) {
    lines.push(`| ${suite.pattern} | ${suite.ok ? "pass" : "fail"} | ${suite.exitCode} | ${suite.durationMs} |`)
  }

  const failures = report.suites.filter((suite) => !suite.ok)
  if (failures.length > 0) {
    lines.push("")
    lines.push("## Failures")
    lines.push("")
    for (const failure of failures) {
      lines.push(`- ${failure.pattern}: ${failure.error ?? "unknown failure"}`)
    }
  }

  return `${lines.join("\n")}\n`
}

async function writeCertificationReport(input: {
  suites: SuiteRunResult[]
  runtimeIsolated: boolean
}): Promise<{ jsonPath: string; markdownPath: string; report: DeterministicCertificationReport }> {
  await mkdir(reportDir, { recursive: true })
  const reportId = `deterministic-${Date.now().toString(16)}`
  const totalDurationMs = input.suites.reduce((sum, suite) => sum + suite.durationMs, 0)
  const passedSuites = input.suites.filter((suite) => suite.ok).length
  const failedSuites = input.suites.length - passedSuites

  const reportBody: Omit<DeterministicCertificationReport, "checksum"> = {
    id: reportId,
    generatedAt: new Date().toISOString(),
    deterministic: {
      fixedNow: Number(deterministicNow),
      seed: Number(deterministicSeed),
    },
    environment: {
      cwd: projectRoot,
      runtimeIsolated: input.runtimeIsolated,
      singleThread: true,
    },
    suites: input.suites,
    summary: {
      totalSuites: input.suites.length,
      passedSuites,
      failedSuites,
      totalDurationMs,
      certified: failedSuites === 0,
    },
  }

  const report: DeterministicCertificationReport = {
    ...reportBody,
    checksum: computeReportChecksum(reportBody),
  }

  const jsonPath = join(reportDir, `${reportId}.json`)
  const markdownPath = join(reportDir, `${reportId}.md`)

  await writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8")
  await writeFile(markdownPath, toMarkdownReport(report), "utf8")

  return {
    jsonPath,
    markdownPath,
    report,
  }
}

async function runDeterministicSuite(): Promise<SuiteRunResult[]> {
  const env = {
    DETERMINISTIC_NOW: deterministicNow,
    DETERMINISTIC_SEED: deterministicSeed,
  }

  const results: SuiteRunResult[] = []

  for (const pattern of testPatterns) {
    const args = [
      "--import",
      "./scripts/deterministic-bootstrap.mjs",
      "--loader",
      "ts-node/esm",
      "--test",
      "--test-concurrency=1",
      pattern,
    ]

    const result = await runCommand(
      "node",
      args,
      env,
    )

    results.push({
      pattern,
      ok: result.ok,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      command: `node ${args.join(" ")}`,
      error: result.error,
    })

    if (!result.ok) {
      break
    }
  }

  return results
}

async function main() {
  let runtimeIsolated = false
  let results: SuiteRunResult[] = []

  try {
    await setupDeterministicRuntime()
    await assertNoOtherNodeLoad()
    runtimeIsolated = true
    results = await runDeterministicSuite()

    const reportOutput = await writeCertificationReport({
      suites: results,
      runtimeIsolated,
    })

    if (reportOutput.report.summary.certified) {
      console.log("Deterministic governance validation completed successfully.")
    } else {
      console.error("Deterministic governance validation failed.")
      process.exitCode = 1
    }

    console.log(`Governance certification report (json): ${reportOutput.jsonPath}`)
    console.log(`Governance certification report (markdown): ${reportOutput.markdownPath}`)
  } finally {
    await rm(pidFile, { force: true })
    await safeRestoreRuntime()
  }
}

main().catch((error) => {
  console.error("Deterministic validation failed:", error)
  process.exitCode = 1
})
