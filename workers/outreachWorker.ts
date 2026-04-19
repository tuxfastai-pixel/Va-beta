import { discoverClients } from "../lib/agents/clientDiscoveryAgent.ts";
import { generateOutreach } from "../lib/agents/outreachAgent.ts";
import { sendOutreachEmail } from "../lib/clients/sendOutreach.ts";
import { storeProspects } from "../lib/clients/storeProspects.ts";

export async function runClientAcquisition() {
  const prospects = await discoverClients();

  await storeProspects(prospects);

  for (const prospect of prospects) {
    const email = await generateOutreach(prospect);

    await sendOutreachEmail(prospect, email || "");
  }
}
