import { supabase } from "@/lib/supabase";

type LeadInput = {
  name: string;
  email: string | null;
  company: string | null;
  message: string;
  source: string;
};

export async function storeLeads(leads: LeadInput[]): Promise<number> {
  if (!Array.isArray(leads) || leads.length === 0) {
    return 0;
  }

  const payload = leads.map((lead) => ({
    name: lead.name,
    email: lead.email,
    company: lead.company,
    message: lead.message,
    source: lead.source,
    status: "new",
  }));

  const { error } = await supabase.from("leads").upsert(payload, {
    onConflict: "email",
    ignoreDuplicates: false,
  });

  if (error) {
    throw new Error(`Failed to store leads: ${error.message}`);
  }

  return payload.length;
}
