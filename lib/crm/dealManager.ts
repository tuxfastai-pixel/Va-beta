import { supabaseServer } from "@/lib/supabaseServer";

export type DealStage =
  | "lead"
  | "contacted"
  | "interview"
  | "negotiation"
  | "closed_won"
  | "closed_lost";

export interface Deal {
  id?: string;
  client_id: string;
  title: string;
  value: number;
  stage?: DealStage;
  probability?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// Probability mapping for stages
const STAGE_PROBABILITY: Record<DealStage, number> = {
  lead: 20,
  contacted: 40,
  interview: 60,
  negotiation: 80,
  closed_won: 100,
  closed_lost: 0,
};

/**
 * Create a new deal
 */
export async function createDeal(data: Deal): Promise<Deal | null> {
  try {
    const stage = data.stage || "lead";
    const probability = data.probability || STAGE_PROBABILITY[stage];

    const { data: deal, error } = await supabaseServer
      .from("deals")
      .insert([{ ...data, stage, probability }])
      .select()
      .single();

    if (error) {
      console.error("[dealManager] Error creating deal:", error);
      return null;
    }

    return deal;
  } catch (err) {
    console.error("[dealManager] Unexpected error:", err);
    return null;
  }
}

/**
 * Get deal by ID
 */
export async function getDeal(dealId: string): Promise<Deal | null> {
  try {
    const { data, error } = await supabaseServer
      .from("deals")
      .select("*")
      .eq("id", dealId)
      .single();

    if (error) {
      console.error("[dealManager] Error fetching deal:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[dealManager] Unexpected error:", err);
    return null;
  }
}

/**
 * Get all deals for a client
 */
export async function getClientDeals(clientId: string): Promise<Deal[]> {
  try {
    const { data, error } = await supabaseServer
      .from("deals")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[dealManager] Error fetching deals:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("[dealManager] Unexpected error:", err);
    return [];
  }
}

/**
 * Move deal to next stage
 * Automatically updates probability based on stage
 */
export async function moveStage(dealId: string, newStage: DealStage): Promise<Deal | null> {
  try {
    const probability = STAGE_PROBABILITY[newStage];

    const { data, error } = await supabaseServer
      .from("deals")
      .update({
        stage: newStage,
        probability,
        updated_at: new Date().toISOString(),
      })
      .eq("id", dealId)
      .select()
      .single();

    if (error) {
      console.error("[dealManager] Error moving stage:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[dealManager] Unexpected error:", err);
    return null;
  }
}

/**
 * Update deal
 */
export async function updateDeal(
  dealId: string,
  updates: Partial<Deal>
): Promise<Deal | null> {
  try {
    const { data, error } = await supabaseServer
      .from("deals")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", dealId)
      .select()
      .single();

    if (error) {
      console.error("[dealManager] Error updating deal:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[dealManager] Unexpected error:", err);
    return null;
  }
}

/**
 * Get deals by stage
 */
export async function getDealsByStage(stage: DealStage): Promise<Deal[]> {
  try {
    const { data, error } = await supabaseServer
      .from("deals")
      .select("*")
      .eq("stage", stage)
      .order("value", { ascending: false });

    if (error) {
      console.error("[dealManager] Error fetching deals by stage:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("[dealManager] Unexpected error:", err);
    return [];
  }
}

/**
 * Get all active deals (not closed)
 */
export async function getActiveDealsPipeline(): Promise<Deal[]> {
  try {
    const { data, error } = await supabaseServer
      .from("deals")
      .select("*")
      .not("stage", "in", '("closed_won","closed_lost")')
      .order("probability", { ascending: false });

    if (error) {
      console.error("[dealManager] Error fetching active deals:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("[dealManager] Unexpected error:", err);
    return [];
  }
}

/**
 * Calculate total pipeline value
 */
export async function getPipelineValue(): Promise<{
  total: number;
  byStage: Record<DealStage, number>;
}> {
  try {
    const deals = await getActiveDealsPipeline();

    const total = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);

    const byStage: Record<DealStage, number> = {
      lead: 0,
      contacted: 0,
      interview: 0,
      negotiation: 0,
      closed_won: 0,
      closed_lost: 0,
    };

    deals.forEach((deal) => {
      const stage = (deal.stage || "lead") as DealStage;
      byStage[stage] += deal.value || 0;
    });

    return { total, byStage };
  } catch (err) {
    console.error("[dealManager] Error calculating pipeline value:", err);
    return { total: 0, byStage: { lead: 0, contacted: 0, interview: 0, negotiation: 0, closed_won: 0, closed_lost: 0 } };
  }
}
