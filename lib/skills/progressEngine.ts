import { supabaseServer } from "@/lib/supabaseServer";

export function evolveSkill(skill: string, usage: number) {
  void skill;
  return Math.min(100, Math.max(0, Math.round(usage * 10)));
}

function isMissingSkillTable(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("skill_progress") && message.includes("could not find the table");
}

function isMissingColumn(error: { message?: string } | null | undefined, column: string) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes(`column skill_progress.${column} does not exist`) ||
    (
      message.includes(`'${column}'`) &&
      message.includes("column") &&
      message.includes("skill_progress") &&
      (message.includes("does not exist") || message.includes("could not find"))
    )
  );
}

export async function recordSkillPractice(input: {
  userId: string;
  skill: string;
  usage: number;
  aiSupported?: boolean;
}) {
  const progress = evolveSkill(input.skill, input.usage);
  const lastPracticed = new Date().toISOString();

  const payloadWithSkillName = {
    user_id: input.userId,
    skill: input.skill,
    skill_name: input.skill,
    progress,
    last_practiced: lastPracticed,
    ai_supported: input.aiSupported ?? true,
  };

  const payloadSkillOnly = {
    user_id: input.userId,
    skill: input.skill,
    progress,
    last_practiced: lastPracticed,
  };

  let lookup = await supabaseServer
    .from("skill_progress")
    .select("id")
    .eq("user_id", input.userId)
    .eq("skill_name", input.skill)
    .maybeSingle();

  let usingSkillNameColumn = true;

  if (lookup.error && isMissingColumn(lookup.error, "skill_name")) {
    usingSkillNameColumn = false;
    lookup = await supabaseServer
      .from("skill_progress")
      .select("id")
      .eq("user_id", input.userId)
      .eq("skill", input.skill)
      .maybeSingle();
  }

  if (lookup.error && !isMissingSkillTable(lookup.error)) {
    throw new Error(`Failed to load skill progress for ${input.userId}: ${lookup.error.message}`);
  }

  if (lookup.error && isMissingSkillTable(lookup.error)) {
    return { ...payloadWithSkillName, persisted: false };
  }

  const operation = lookup.data?.id
    ? supabaseServer
        .from("skill_progress")
        .update(usingSkillNameColumn ? payloadWithSkillName : payloadSkillOnly)
        .eq("id", lookup.data.id)
    : supabaseServer
        .from("skill_progress")
        .insert(usingSkillNameColumn ? payloadWithSkillName : payloadSkillOnly);

  let { error } = await operation;

  if (error && (isMissingColumn(error, "skill_name") || isMissingColumn(error, "ai_supported") || isMissingColumn(error, "last_practiced"))) {
    const payloadMinimal = {
      user_id: input.userId,
      skill: input.skill,
      progress,
    };

    const fallbackOperation = lookup.data?.id
      ? supabaseServer.from("skill_progress").update(payloadMinimal).eq("id", lookup.data.id)
      : supabaseServer.from("skill_progress").insert(payloadMinimal);

    ({ error } = await fallbackOperation);
  }

  if (error && (
    isMissingColumn(error, "progress") ||
    isMissingColumn(error, "skill") ||
    isMissingColumn(error, "skill_name") ||
    isMissingColumn(error, "last_practiced") ||
    isMissingColumn(error, "ai_supported")
  )) {
    return {
      ...payloadWithSkillName,
      persisted: false,
    };
  }

  if (error && !isMissingSkillTable(error)) {
    throw new Error(`Failed to save skill progress for ${input.userId}: ${error.message}`);
  }

  return {
    ...payloadWithSkillName,
    persisted: !error,
  };
}
