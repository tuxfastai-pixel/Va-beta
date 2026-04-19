import { discoverClients } from "@/lib/agents/clientDiscoveryAgent";

type ScrapedLead = {
  name: string;
  email: string | null;
  company: string | null;
  message: string;
  source: string;
};

type ProspectRecord = {
  company_name?: string | null;
  name?: string | null;
  contact_email?: string | null;
};

export async function scrapeLeads(): Promise<ScrapedLead[]> {
  const prospects = (await discoverClients()) as ProspectRecord[] | null;

  return (prospects || []).map((prospect, index: number) => ({
    name: String(prospect.company_name || prospect.name || `Lead ${index + 1}`),
    email: prospect.contact_email ? String(prospect.contact_email) : null,
    company: prospect.company_name ? String(prospect.company_name) : null,
    message: "Discovered via automated lead scraper",
    source: "client_discovery",
  }));
}
