import { createHash } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { spawn } from "node:child_process"

type CertificationStage = {
  id: string
  label: string
  command: string
  args: string[]
}

type StageResult = {
  id: string
  label: string
  ok: boolean
  exitCode: number
  durationMs: number
  command: string
  error?: string
}

type RuntimeCertificationReport = {
  id: string
  generatedAt: string
  stages: StageResult[]
  summary: {
    totalStages: number
    passedStages: number
    failedStages: number
    totalDurationMs: number
    certified: boolean
  }
  checksum: string
}

const projectRoot = process.cwd()
const reportDir = join(projectRoot, "governance-certification-reports")

const stages: CertificationStage[] = [
  {
    id: "deterministic-validation",
    label: "Deterministic validation",
    command: "node",
    args: ["--loader", "ts-node/esm", "scripts/run-deterministic-validation.ts"],
  },
  {
    id: "constitutional-simulation",
    label: "Constitutional simulation",
    command: "node",
    args: ["--loader", "ts-node/esm", "--test", "tests/governance/constitutional-simulation.test.ts"],
  },
  {
    id: "human-trust-regression",
    label: "Human trust regression",
    command: "node",
    args: ["--loader", "ts-node/esm", "--test", "tests/trust/human-trust-regression.test.ts"],
  },
  {
    id: "governance-chaos",
    label: "Governance chaos testing",
    command: "node",
    args: ["--loader", "ts-node/esm", "--test", "tests/governance/governance-chaos.test.ts"],
  },
  {
    id: "replay-certification",
    label: "Replay certification",
    command: "node",
    args: ["--loader", "ts-node/esm", "--test", "tests/replay/*.test.ts"],
  },
]

function runStage(stage: CertificationStage): Promise<StageResult> {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    const child = spawn(stage.command, stage.args, {
      cwd: projectRoot,
      stdio: "inherit",
      shell: false,
      env: {
        ...process.env,
      },
    })

    child.on("error", (error) => {
      resolve({
        id: stage.id,
        label: stage.label,
        ok: false,
        exitCode: 1,
        durationMs: Date.now() - startedAt,
        command: `${stage.command} ${stage.args.join(" ")}`,
        error: error.message,
      })
    })

    child.on("exit", (code) => {
      const exitCode = typeof code === "number" ? code : 1
      resolve({
        id: stage.id,
        label: stage.label,
        ok: exitCode === 0,
        exitCode,
        durationMs: Date.now() - startedAt,
        command: `${stage.command} ${stage.args.join(" ")}`,
        error: exitCode === 0 ? undefined : `${stage.label} failed with exit code ${exitCode}`,
      })
    })
  })
}

function checksumFor(report: Omit<RuntimeCertificationReport, "checksum">): string {
  const hash = createHash("sha256")
  hash.update(JSON.stringify(report))
  return hash.digest("hex")
}

function markdownFor(report: RuntimeCertificationReport): string {
  const rows = report.stages
    .map((stage) => `| ${stage.id} | ${stage.ok ? "pass" : "fail"} | ${stage.exitCode} | ${stage.durationMs} |`)
    .join("\n")

  const failures = report.stages.filter((stage) => !stage.ok)
  const failureText = failures.length
    ? `\n## Failures\n\n${failures.map((failure) => `- ${failure.id}: ${failure.error ?? "unknown error"}`).join("\n")}\n`
    : ""

  return [
    "# Runtime Certification Pass",
    "",
    `- Report ID: ${report.id}`,
    `- Generated At: ${report.generatedAt}`,
    `- Certified: ${report.summary.certified ? "yes" : "no"}`,
    `- Checksum: ${report.checksum}`,
    "",
    "## Summary",
    "",
    `- Total Stages: ${report.summary.totalStages}`,
    `- Passed Stages: ${report.summary.passedStages}`,
    `- Failed Stages: ${report.summary.failedStages}`,
    `- Total Duration (ms): ${report.summary.totalDurationMs}`,
    "",
    "## Stage Results",
    "",
    "| Stage | Status | Exit Code | Duration (ms) |",
    "|---|---:|---:|---:|",
    rows,
    failureText,
  ].join("\n")
}

async function writeReport(stagesRun: StageResult[]): Promise<RuntimeCertificationReport> {
  await mkdir(reportDir, { recursive: true })

  const body: Omit<RuntimeCertificationReport, "checksum"> = {
    id: `runtime-certification-${Date.now().toString(16)}`,
    generatedAt: new Date().toISOString(),
    stages: stagesRun,
    summary: {
      totalStages: stagesRun.length,
      passedStages: stagesRun.filter((stage) => stage.ok).length,
      failedStages: stagesRun.filter((stage) => !stage.ok).length,
      totalDurationMs: stagesRun.reduce((sum, stage) => sum + stage.durationMs, 0),
      certified: stagesRun.every((stage) => stage.ok),
    },
  }

  const report: RuntimeCertificationReport = {
    ...body,
    checksum: checksumFor(body),
  }

  const jsonPath = join(reportDir, `${report.id}.json`)
  const mdPath = join(reportDir, `${report.id}.md`)
  await writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8")
  await writeFile(mdPath, markdownFor(report), "utf8")
  return report
}

async function main() {
  const results: StageResult[] = []

  for (const stage of stages) {
    const result = await runStage(stage)
    results.push(result)
    if (!result.ok) {
      break
    }
  }

  const report = await writeReport(results)

  if (!report.summary.certified) {
    process.exitCode = 1
    return
  }

  console.log("Runtime certification pass completed successfully.")
}

main().catch((error) => {
  console.error("Runtime certification pass failed unexpectedly:", error)
  process.exitCode = 1
})
