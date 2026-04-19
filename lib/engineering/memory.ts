import { supabase } from "../supabase";

type StoreMemoryInput = {
  agent_type: string;
  category: string;
  content: string;
  metadata?: Record<string, unknown>;
};

type MemoryRow = {
  id: string;
  agent_type: string;
  category: string;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export async function storeMemory({
  agent_type,
  category,
  content,
  metadata = {},
}: StoreMemoryInput): Promise<void> {
  await supabase.from("engineering_agent_memory").insert({
    agent_type,
    category,
    content,
    metadata,
  });
}

export async function getRelevantMemory(agent_type: string, goal: string): Promise<MemoryRow[]> {
  const { data } = await supabase
    .from("engineering_agent_memory")
    .select("*")
    .eq("agent_type", agent_type)
    .order("created_at", { ascending: false })
    .limit(5);

  const rows = (data || []) as MemoryRow[];
  if (!goal.trim()) {
    return rows;
  }

  const normalized = goal.toLowerCase();
  const scoped = rows.filter((row) => row.content.toLowerCase().includes(normalized));
  return scoped.length > 0 ? scoped : rows;
}
