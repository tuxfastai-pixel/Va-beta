import { supabaseServer } from "@/lib/supabaseServer";

type ViralMetrics = {
  time?: string | number;
  savings?: string | number;
  [key: string]: unknown;
};

export function generateContent(metrics: ViralMetrics) {
  return `
We replaced 3 developers with an AI system.

Results:
- Tasks completed in ${metrics.time}
- Cost reduced by ${metrics.savings}%
- Output increased significantly

This is where execution is going.
`;
}

export async function createViralContent(input: {
  clientId?: string;
  platform?: string;
  metrics: ViralMetrics;
}) {
  const content = generateContent(input.metrics || {});

  const { data, error } = await supabaseServer
    .from("viral_content_logs")
    .insert({
      client_id: input.clientId || null,
      platform: input.platform || "linkedin",
      content,
      metrics: input.metrics || {},
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create viral content: ${error.message}`);
  }

  return data;
}
