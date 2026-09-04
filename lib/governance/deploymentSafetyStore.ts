import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  DEFAULT_DEPLOYMENT_SAFETY_CONFIG,
  mergeDeploymentSafetyConfig,
  normalizeOperationalGovernanceMode,
  type DeploymentSafetyConfig,
} from "./deploymentSafety.ts"

const RUNTIME_DIR = join(process.cwd(), ".runtime")
const CONFIG_FILE = join(RUNTIME_DIR, "deployment-safety-config.json")

function normalizeConfig(raw: Partial<DeploymentSafetyConfig>): DeploymentSafetyConfig {
  return {
    ...DEFAULT_DEPLOYMENT_SAFETY_CONFIG,
    ...raw,
    operationalMode: normalizeOperationalGovernanceMode(raw.operationalMode),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date(),
  }
}

export async function loadDeploymentSafetyConfig(): Promise<DeploymentSafetyConfig> {
  await mkdir(RUNTIME_DIR, { recursive: true })

  try {
    const raw = await readFile(CONFIG_FILE, "utf8")
    return normalizeConfig(JSON.parse(raw) as Partial<DeploymentSafetyConfig>)
  } catch {
    return { ...DEFAULT_DEPLOYMENT_SAFETY_CONFIG, updatedAt: new Date() }
  }
}

export async function saveDeploymentSafetyConfig(
  partial: Partial<DeploymentSafetyConfig>,
): Promise<DeploymentSafetyConfig> {
  const current = await loadDeploymentSafetyConfig()
  const merged = mergeDeploymentSafetyConfig(current, partial)

  await mkdir(RUNTIME_DIR, { recursive: true })
  await writeFile(
    CONFIG_FILE,
    JSON.stringify(
      {
        ...merged,
        updatedAt: merged.updatedAt.toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  )

  return merged
}
