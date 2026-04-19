import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type AgentType = "PLANNER" | "ENGINEER" | "REVIEWER" | "TESTER" | "OPTIMIZER";

const ALLOWED_AGENT_TYPES = new Set<AgentType>([
  "PLANNER",
  "ENGINEER",
  "REVIEWER",
  "TESTER",
  "OPTIMIZER",
]);

const MAX_PATCHES = 5;
const MAX_FILE_SIZE = 50_000; // 50KB per file
const MAX_TOTAL_SIZE = 200_000; // 200KB total

function parsePriority(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function validatePatch(patch: unknown) {
  if (!patch || typeof patch !== "object") {
    return false;
  }

  const candidate = patch as Record<string, unknown>;
  const filePath = String(candidate.file_path || "").trim();
  const action = String(candidate.action || "").trim();

  if (!filePath || !action) {
    return false;
  }

  const blocked = ["node_modules", ".next", "dist", "build", ".env"];
  if (blocked.some((value) => filePath.includes(value))) {
    return false;
  }

  const normalizedPath = filePath.replace(/\\/g, "/");
  const root = normalizedPath.split("/").filter(Boolean)[0] || "";
  if (!["app", "lib", "workers"].includes(root)) {
    return false;
  }

  if (!["create", "update", "delete"].includes(action)) {
    return false;
  }

  if (action !== "delete" && typeof candidate.content !== "string") {
    return false;
  }

  return true;
}

function validatePatchSet(patches: unknown[]): boolean {
  if (!Array.isArray(patches)) return false;

  if (patches.length > MAX_PATCHES) return false;

  let totalSize = 0;

  for (const patch of patches) {
    if (!validatePatch(patch)) return false;

    const candidate = patch as Record<string, unknown>;
    if (candidate.content && typeof candidate.content === "string") {
      const size = Buffer.byteLength(candidate.content, "utf-8");
      if (size > MAX_FILE_SIZE) return false;
      totalSize += size;
    }
  }

  if (totalSize > MAX_TOTAL_SIZE) return false;

  return true;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const taskType = String(body.task_type || "").trim();
  const agentType = String(body.agent_type || "").trim().toUpperCase() as AgentType;
  const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
  const priority = parsePriority(body.priority);
  const requiresHumanApproval = Boolean(body.requires_human_approval);

  const payloadPatches =
    payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>).patches)
      ? ((payload as Record<string, unknown>).patches as unknown[])
      : null;

  if (!taskType) {
    return NextResponse.json({ error: "task_type is required" }, { status: 400 });
  }

  if (!ALLOWED_AGENT_TYPES.has(agentType)) {
    return NextResponse.json({ error: "agent_type is invalid" }, { status: 400 });
  }

  if (payloadPatches && !validatePatchSet(payloadPatches)) {
    return new Response("Patch payload exceeds limits", { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("engineering_tasks")
    .insert({
      task_type: taskType,
      agent_type: agentType,
      status: "pending",
      priority,
      payload,
      requires_human_approval: requiresHumanApproval,
    })
    .select("id, task_type, agent_type, status, priority, payload, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    status: "accepted",
    task: data,
  });
}
