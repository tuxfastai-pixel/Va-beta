import { supabaseServer } from "@/lib/supabaseServer";
import type { Client } from "@/lib/crm/clientManager";
import type { Deal } from "@/lib/crm/dealManager";

export interface Contract {
  id?: string;
  deal_id: string;
  content: string;
  status?: "draft" | "sent" | "signed" | "expired";
  signed_at?: string;
  signer_name?: string;
  signer_ip?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Generate contract template from deal and client info
 */
export function generateContractContent(
  client: Client,
  deal: Deal,
  company: string = "Digital Hybrid Palms (Pty) Ltd"
): string {
  const date = new Date();
  const startDate = new Date(date.getTime() + 7 * 86400000); // 7 days from now

  return `
SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into as of ${date.toLocaleDateString()}, between:

SERVICE PROVIDER:
${company}
South Africa

CLIENT:
${client.name}
Email: ${client.email}
Phone: ${client.phone || "N/A"}

SCOPE OF WORK:
We will provide services related to: ${deal.title}

Deliverables & Timeline:
Services will commence on ${startDate.toLocaleDateString()} and be delivered according to the agreed schedule.

PAYMENT TERMS:
Total Engagement Value: R${deal.value?.toLocaleString() || "0"}

Payment Schedule:
- Due upon contract signature

TERMS & CONDITIONS:
1. Confidentiality: Both parties agree to maintain confidentiality of proprietary information.
2. Intellectual Property: All work product shall be the property of ${company} until payment is received in full.
3. Termination: Either party may terminate with 7 days written notice.
4. Limitation of Liability: Total liability shall not exceed the contract value.

SIGNATURES:

SERVICE PROVIDER:

Name: _________________________
Date: _________________________
Signature: _________________________

CLIENT:

Name: ${client.name}
Date: _________________________
Signature: _________________________
`;
}

/**
 * Create contract in database
 */
export async function createContract(
  dealId: string,
  content: string,
  status: "draft" | "sent" = "draft"
): Promise<Contract | null> {
  try {
    const { data, error } = await supabaseServer
      .from("contracts")
      .insert([
        {
          deal_id: dealId,
          content,
          status,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("[contractManager] Error creating contract:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[contractManager] Unexpected error:", err);
    return null;
  }
}

/**
 * Get contract by deal
 */
export async function getContractByDeal(dealId: string): Promise<Contract | null> {
  try {
    const { data, error } = await supabaseServer
      .from("contracts")
      .select("*")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found, which is ok
      console.error("[contractManager] Error fetching contract:", error);
      return null;
    }

    return data || null;
  } catch (err) {
    console.error("[contractManager] Unexpected error:", err);
    return null;
  }
}

/**
 * Get contract by ID
 */
export async function getContract(contractId: string): Promise<Contract | null> {
  try {
    const { data, error } = await supabaseServer
      .from("contracts")
      .select("*")
      .eq("id", contractId)
      .single();

    if (error) {
      console.error("[contractManager] Error fetching contract:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[contractManager] Unexpected error:", err);
    return null;
  }
}

/**
 * Update contract status
 */
export async function updateContractStatus(
  contractId: string,
  status: "draft" | "sent" | "signed" | "expired"
): Promise<Contract | null> {
  try {
    const { data, error } = await supabaseServer
      .from("contracts")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contractId)
      .select()
      .single();

    if (error) {
      console.error("[contractManager] Error updating contract:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[contractManager] Unexpected error:", err);
    return null;
  }
}

/**
 * Sign contract (record signature)
 */
export async function signContract(
  contractId: string,
  signerName: string,
  signerIp: string
): Promise<Contract | null> {
  try {
    const { data, error } = await supabaseServer
      .from("contracts")
      .update({
        status: "signed",
        signed_at: new Date().toISOString(),
        signer_name: signerName,
        signer_ip: signerIp,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contractId)
      .select()
      .single();

    if (error) {
      console.error("[contractManager] Error signing contract:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[contractManager] Unexpected error:", err);
    return null;
  }
}

/**
 * Get pending contracts (awaiting signature)
 */
export async function getPendingContracts(): Promise<Contract[]> {
  try {
    const { data, error } = await supabaseServer
      .from("contracts")
      .select("*")
      .in("status", ["draft", "sent"])
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[contractManager] Error fetching pending contracts:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("[contractManager] Unexpected error:", err);
    return [];
  }
}
