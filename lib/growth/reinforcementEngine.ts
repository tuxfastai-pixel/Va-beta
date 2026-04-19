import { supabaseServer } from "@/lib/supabaseServer";

export async function mutateTemplate(templateId: string) {
  const now = new Date().toISOString();

  const { error: strategyError } = await supabaseServer
    .from("template_strategy")
    .upsert(
      {
        template_id: templateId,
        status: "mutating",
        updated_at: now,
        last_updated: now,
      },
      { onConflict: "template_id" }
    );

  if (strategyError) {
    throw new Error(`Failed to mutate template ${templateId}: ${strategyError.message}`);
  }
}

export async function runReinforcementCycle() {
  const { data: weakTemplates, error } = await supabaseServer
    .from("outreach_templates")
    .select("id, success_rate")
    .lt("success_rate", 0.05);

  if (error) {
    throw new Error(`Failed to load weak templates: ${error.message}`);
  }

  const improvements: Array<{ template_id: string; avg_reply_rate: number }> = [];

  for (const template of weakTemplates || []) {
    const { error: strategyError } = await supabaseServer
      .from("template_strategy")
      .upsert(
        {
          template_id: template.id,
          avg_reply_rate: template.success_rate,
          status: "iterating",
          updated_at: new Date().toISOString(),
          last_updated: new Date().toISOString(),
        },
        { onConflict: "template_id" }
      );

    if (strategyError) {
      throw new Error(`Failed to insert reinforcement action for ${template.id}: ${strategyError.message}`);
    }

    console.log("Improving template:", template.id);
    improvements.push({
      template_id: template.id,
      avg_reply_rate: Number(template.success_rate || 0),
    });
  }

  return {
    weakTemplateCount: weakTemplates?.length || 0,
    improvements,
  };
}

export async function runDailyReinforcementMutation() {
  const { data: weakTemplates, error } = await supabaseServer
    .from("outreach_templates")
    .select("id, success_rate")
    .lt("success_rate", 0.05);

  if (error) {
    throw new Error(`Failed to load templates for daily mutation: ${error.message}`);
  }

  for (const template of weakTemplates || []) {
    await mutateTemplate(String(template.id));
  }

  return {
    mutatedTemplates: (weakTemplates || []).map((t) => t.id),
    count: weakTemplates?.length || 0,
  };
}
