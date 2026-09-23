import { runCapability } from "@/lib/office/capabilityEngine";
import { supabaseServer } from "@/lib/supabaseServer";

type UserContext = {
  id: string;
  provider?: string;
};

type OfficeWorkspace = {
  jobTrackerId?: string;
  crmSheetId?: string;
};

async function loadWorkspace(userId: string): Promise<OfficeWorkspace> {
  const { data } = await supabaseServer
    .from("ai_memory")
    .select("content")
    .eq("user_id", userId)
    .eq("memory_type", "office_workspace")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data || typeof data.content !== "object" || data.content === null) {
    return {};
  }

  return data.content as OfficeWorkspace;
}

async function saveWorkspace(userId: string, workspace: OfficeWorkspace) {
  await supabaseServer.from("ai_memory").insert({
    user_id: userId,
    memory_type: "office_workspace",
    content: workspace,
  });
}

export async function createJobTracker(user: UserContext) {
  return runCapability(
    "spreadsheet.create",
    {
      title: "Job Tracker",
      headers: ["Date", "Platform", "Job Title", "Status", "Budget"],
    },
    user
  );
}

export async function createCRM(user: UserContext) {
  return runCapability(
    "spreadsheet.create",
    {
      title: "Client CRM",
      headers: ["Client", "Status", "Last Contact", "Deal Value"],
    },
    user
  );
}

export async function ensureOfficeWorkspace(user: UserContext) {
  const workspace = await loadWorkspace(user.id);
  let changed = false;

  if (!workspace.jobTrackerId) {
    const tracker = await createJobTracker(user);
    workspace.jobTrackerId = String((tracker as { sheetId?: string }).sheetId || "");
    changed = true;
  }

  if (!workspace.crmSheetId) {
    const crm = await createCRM(user);
    workspace.crmSheetId = String((crm as { sheetId?: string }).sheetId || "");
    changed = true;
  }

  if (changed) {
    await saveWorkspace(user.id, workspace);
  }

  return workspace;
}

export async function logApplication(
  user: UserContext & { jobTrackerId?: string },
  job: { platform?: string; title?: string; budget?: { max?: number } }
) {
  if (!user.jobTrackerId) {
    return { success: false, reason: "missing_job_tracker" };
  }

  return runCapability(
    "spreadsheet.append",
    {
      sheetId: user.jobTrackerId,
      row: [
        new Date().toISOString(),
        job.platform || "unknown",
        job.title || "Untitled",
        "Applied",
        Number(job.budget?.max || 0),
      ],
    },
    user
  );
}
