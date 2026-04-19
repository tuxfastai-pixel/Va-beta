import { supabase } from "@/lib/supabase";

type LeadMessageInput = {
  leadId: string;
  message: string;
  direction?: "inbound" | "outbound" | "system";
};

export async function convertToDeal(leadId: string): Promise<string> {
  const { data, error } = await supabase
    .from("deals")
    .insert({
      lead_id: leadId,
      stage: "proposal",
      value: 0,
      status: "open",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to convert lead to deal (${leadId}): ${error.message}`);
  }

  return String(data?.id || "");
}

export async function trackInteraction(input: LeadMessageInput): Promise<void> {
  const { error } = await supabase.from("interactions").insert({
    lead_id: input.leadId,
    message: input.message,
    direction: input.direction || "outbound",
  });

  if (error) {
    throw new Error(`Failed to store interaction for lead ${input.leadId}: ${error.message}`);
  }
}

export async function markLeadConverted(leadId: string): Promise<void> {
  const { error } = await supabase
    .from("leads")
    .update({ status: "converted" })
    .eq("id", leadId);

  if (error) {
    throw new Error(`Failed to update lead status for ${leadId}: ${error.message}`);
  }
}
