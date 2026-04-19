import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export type FilePatch = {
  file_path: string;
  action: "create" | "update" | "delete";
  content?: string;
};

const BLOCKED_SEGMENTS = new Set(["node_modules", ".next", "dist", "build"]);
const ALLOWED_ROOT_SEGMENTS = new Set(["app", "lib", "workers"]);

function assertSafePath(filePath: string) {
  const normalized = path.normalize(filePath).replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error(`Unsafe patch path: ${filePath}`);
  }

  const segments = normalized.split("/").filter(Boolean);
  if (segments.some((segment) => BLOCKED_SEGMENTS.has(segment))) {
    throw new Error(`Blocked patch path: ${filePath}`);
  }

  const firstSegment = segments[0] || "";
  if (!ALLOWED_ROOT_SEGMENTS.has(firstSegment)) {
    throw new Error(`Patch must target app/, lib/, or workers/: ${filePath}`);
  }

  const lowerPath = normalized.toLowerCase();
  if (lowerPath.endsWith(".env") || lowerPath.includes("/.env")) {
    throw new Error(`Blocked patch path (.env protected): ${filePath}`);
  }

  return normalized;
}

export async function applyPatch(patch: FilePatch) {
  const safePath = assertSafePath(patch.file_path);
  const root = process.cwd();
  const fullPath = path.resolve(root, safePath);

  if (!fullPath.startsWith(path.resolve(root))) {
    throw new Error(`Patch resolved outside repository: ${patch.file_path}`);
  }

  if (patch.action === "delete") {
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
    return;
  }

  if (patch.action === "create" || patch.action === "update") {
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, patch.content || "", "utf-8");
    return;
  }

  throw new Error(`Unsupported patch action: ${(patch as { action?: string }).action || "unknown"}`);
}

export async function applyPatches(patches: FilePatch[]) {
  for (const patch of patches) {
    await applyPatch(patch);
  }
}

export async function safeApply(patches: FilePatch[]): Promise<{ success: boolean; error?: string }> {
  try {
    await applyPatches(patches);
    return { success: true };
  } catch (e) {
    try {
      await execAsync("git reset --hard HEAD");
    } catch {
      // rollback is best-effort
    }
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
