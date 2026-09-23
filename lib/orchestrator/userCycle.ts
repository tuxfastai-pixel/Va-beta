import { fetchAllJobs } from "@/lib/agents/jobAggregator";
import { ensureOfficeWorkspace } from "@/lib/office/automations";
import { processJob } from "@/lib/orchestrator/jobProcessor";
import { supabaseServer } from "@/lib/supabaseServer";
import { refreshGoogleToken } from "@/lib/google/refresh";
import { getGoogleClient } from "@/lib/google/client";
import { createCRM } from "@/lib/google/sheets";

export async function runUserCycle(user: {
  id: string;
  careers: string[];
  primary_career?: string | null;
  safe_mode?: boolean | null;
  resume?: string | null;
  profile?: string | null;
  provider?: string | null;
  google_access_token?: string | null;
  google_refresh_token?: string | null;
  google_sheet_id?: string | null;
  system_paused?: boolean | null;
}) {
  if (user.safe_mode || user.system_paused) {
    return {
      skipped: true,
      reason: user.system_paused ? "system_paused" : "safe_mode",
    };
  }

  if (user.google_access_token) {
    const refreshed = await refreshGoogleToken(user);

    if (refreshed?.access_token) {
      const { error } = await supabaseServer
        .from("profiles")
        .update({ google_access_token: refreshed.access_token })
        .eq("id", user.id);

      if (!error) {
        user.google_access_token = refreshed.access_token;
      }
    }
  }

  let googleSheetId = user.google_sheet_id || "";
  if (user.google_access_token && !googleSheetId) {
    try {
      const { sheets } = getGoogleClient(user.google_access_token);
      googleSheetId = await createCRM(sheets as unknown as {
        spreadsheets: {
          create: (args: Record<string, unknown>) => Promise<{ data: { spreadsheetId?: string | null } }>;
          values: { append: (args: Record<string, unknown>) => Promise<unknown> };
        };
      });

      if (googleSheetId) {
        await supabaseServer
          .from("profiles")
          .update({ google_sheet_id: googleSheetId })
          .eq("id", user.id);
      }
    } catch {
      googleSheetId = "";
    }
  }

  const workspace = await ensureOfficeWorkspace({
    id: user.id,
    provider: String(user.provider || "google"),
  });

  const jobs = await fetchAllJobs({
    id: user.id,
    resume: user.resume,
    profile: user.profile,
    careers: user.careers,
  });

  const results = [] as Array<Record<string, unknown>>;

  for (const job of jobs.slice(0, 20)) {
    results.push(
      await processJob(
        {
          ...user,
          jobTrackerId: workspace.jobTrackerId,
          crmSheetId: googleSheetId || workspace.crmSheetId,
        },
        job
      )
    );
  }

  return {
    jobsFetched: jobs.length,
    jobsProcessed: results.length,
    workspace,
    results,
  };
}
