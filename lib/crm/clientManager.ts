import { supabaseServer } from "@/lib/supabaseServer";

export interface Client {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  region?: "south_africa" | "global";
  source?: "indeed" | "linkedin" | "tender" | "inbound" | "referral";
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Create a new client
 */
export async function createClient(data: Client): Promise<Client | null> {
  try {
    const { data: client, error } = await supabaseServer
      .from("clients")
      .insert([data])
      .select()
      .single();

    if (error) {
      console.error("[clientManager] Error creating client:", error);
      return null;
    }

    return client;
  } catch (err) {
    console.error("[clientManager] Unexpected error:", err);
    return null;
  }
}

/**
 * Get client by ID
 */
export async function getClient(clientId: string): Promise<Client | null> {
  try {
    const { data, error } = await supabaseServer
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();

    if (error) {
      console.error("[clientManager] Error fetching client:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[clientManager] Unexpected error:", err);
    return null;
  }
}

/**
 * Get or create client (by email)
 * Useful for deduplication when receiving new opportunities
 */
export async function getOrCreateClient(
  data: Client
): Promise<Client | null> {
  try {
    // Check if client exists by email
    const { data: existing } = await supabaseServer
      .from("clients")
      .select("*")
      .eq("email", data.email)
      .single();

    if (existing) {
      return existing;
    }

    // Create new client
    return createClient(data);
  } catch (err) {
    console.error("[clientManager] Error in getOrCreateClient:", err);
    return null;
  }
}

/**
 * Update client
 */
export async function updateClient(
  clientId: string,
  updates: Partial<Client>
): Promise<Client | null> {
  try {
    const { data, error } = await supabaseServer
      .from("clients")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", clientId)
      .select()
      .single();

    if (error) {
      console.error("[clientManager] Error updating client:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[clientManager] Unexpected error:", err);
    return null;
  }
}

/**
 * List all clients
 */
export async function listClients(
  limit: number = 100,
  offset: number = 0
): Promise<Client[]> {
  try {
    const { data, error } = await supabaseServer
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[clientManager] Error listing clients:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("[clientManager] Unexpected error:", err);
    return [];
  }
}

/**
 * Get clients by source
 */
export async function getClientsBySource(source: string): Promise<Client[]> {
  try {
    const { data, error } = await supabaseServer
      .from("clients")
      .select("*")
      .eq("source", source)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[clientManager] Error fetching clients by source:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("[clientManager] Unexpected error:", err);
    return [];
  }
}
