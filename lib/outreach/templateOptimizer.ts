import { supabaseServer } from "@/lib/supabaseServer";

type TemplateStats = {
  template_id: string;
  sent: number;
  replied: number;
  rate: number;
};

export type OutreachTemplateRow = {
  id: string;
  name: string;
  success_rate: number;
  usage_count: number;
  status: string;
  updated_at?: string;
};

const agent = {
  async promoteTemplate(template_id: string) {
    await supabaseServer
      .from("template_strategy")
      .upsert({
        template_id,
        status: "promoted",
        updated_at: new Date().toISOString(),
      }, { onConflict: "template_id" });
  },

  async iterateTemplate(template_id: string) {
    await supabaseServer
      .from("template_strategy")
      .upsert({
        template_id,
        status: "iterating",
        updated_at: new Date().toISOString(),
      }, { onConflict: "template_id" });
  },
};

async function getTemplateResponseRates(): Promise<TemplateStats[]> {
  const { data, error } = await supabaseServer
    .from("cold_email_sends")
    .select("template_id, status")
    .not("template_id", "is", null);

  if (error || !data) {
    return [];
  }

  const grouped = new Map<string, { sent: number; replied: number }>();

  for (const row of data) {
    const templateId = String(row.template_id || "unknown");
    const current = grouped.get(templateId) || { sent: 0, replied: 0 };
    current.sent += 1;
    if (row.status === "replied") {
      current.replied += 1;
    }
    grouped.set(templateId, current);
  }

  return Array.from(grouped.entries()).map(([template_id, counts]) => ({
    template_id,
    sent: counts.sent,
    replied: counts.replied,
    rate: counts.sent > 0 ? counts.replied / counts.sent : 0,
  }));
}

export async function updateTemplatePerformance(templateId: string) {
  const { data, error } = await supabaseServer
    .from("email_logs")
    .select("status")
    .eq("template_id", templateId);

  if (error) {
    throw new Error(`Failed to load template stats for ${templateId}: ${error.message}`);
  }

  const total = Math.max(1, data?.length || 0);
  const replies = (data || []).filter((row) => row.status === "replied").length;
  const rate = replies / total;

  const { error: updateError } = await supabaseServer.rpc("upsert_outreach_template_performance", {
    p_template_id: templateId,
    p_success_rate: rate,
  });

  if (updateError) {
    const { data: existing } = await supabaseServer
      .from("outreach_templates")
      .select("usage_count")
      .eq("id", templateId)
      .maybeSingle();

    const nextUsageCount = Number(existing?.usage_count || 0) + 1;

    const { error: fallbackError } = await supabaseServer
      .from("outreach_templates")
      .upsert(
        {
          id: templateId,
          success_rate: rate,
          usage_count: nextUsageCount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (fallbackError) {
      throw new Error(`Failed to update template performance for ${templateId}: ${fallbackError.message}`);
    }
  }

  return { templateId, total, replies, rate };
}

export async function selectBestTemplate() {
  const { data, error } = await supabaseServer
    .from("outreach_templates")
    .select("id, name, success_rate, usage_count, status, updated_at")
    .eq("status", "active")
    .order("success_rate", { ascending: false })
    .order("usage_count", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to select best template: ${error.message}`);
  }

  return (data as OutreachTemplateRow | null) || null;
}

export async function runSelfImprovementLoop() {
  const stats = await getTemplateResponseRates();
  const actions: Array<{ template_id: string; rate: number; action: "promote" | "iterate" }> = [];

  for (const response of stats) {
    await updateTemplatePerformance(response.template_id);

    if (response.rate > 0.15) {
      await agent.promoteTemplate(response.template_id);
      actions.push({ template_id: response.template_id, rate: response.rate, action: "promote" });
    } else {
      await agent.iterateTemplate(response.template_id);
      actions.push({ template_id: response.template_id, rate: response.rate, action: "iterate" });
    }
  }

  const bestTemplate = await selectBestTemplate();

  return {
    actions,
    bestTemplate,
    loop: "Send -> Track -> Measure -> Improve -> Repeat",
  };
}

export async function optimizeTemplateByResponseRate() {
  const improved = await runSelfImprovementLoop();
  return improved.actions;
}
