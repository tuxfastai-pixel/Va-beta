import { supabaseServer } from "@/lib/supabaseServer";
import { formatDeckAsText, generateEnterpriseDeck } from "@/lib/enterprise/deckGenerator";
import { generateEnterpriseProposal } from "@/lib/enterprise/proposal";

type EnterpriseLead = {
  id: string;
  company: string;
  contact_email: string;
};

export async function runEnterpriseOutreach() {
  const { data: leads, error } = await supabaseServer
    .from("enterprise_leads")
    .select("id, company, contact_email");

  if (error) {
    throw new Error(`Failed to load enterprise leads: ${error.message}`);
  }

  const sent: Array<{
    company: string;
    contact_email: string;
    message: string;
    deck: ReturnType<typeof generateEnterpriseDeck>;
    deckText: string;
  }> = [];

  for (const lead of (leads || []) as EnterpriseLead[]) {
    const message = generateEnterpriseProposal(lead.company);
    const deck = generateEnterpriseDeck(lead.company);
    const deckText = formatDeckAsText(deck);

    // Placeholder for email/LinkedIn sending integration.
    console.log("Sending to:", lead.contact_email);

    sent.push({
      company: lead.company,
      contact_email: lead.contact_email,
      message,
      deck,
      deckText,
    });
  }

  return {
    count: sent.length,
    sent,
  };
}
