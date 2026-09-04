import type { SupabaseClient } from "@supabase/supabase-js";

export type LeadInsert = {
  name: string;
  email: string | null;
  phone: string | null;
  message: string;
  source: string;
  score: number;
  status: "new";
};

export async function upsertLead(
  supabase: SupabaseClient,
  lead: LeadInsert
) {
  const { data, error } = await supabase
    .from("leads")
    .insert(lead)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
