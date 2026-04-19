import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function storeProspects(prospects: Array<Record<string, unknown>>) {
  for (const prospect of prospects) {
    await supabase
      .from("client_prospects")
      .insert(prospect);
  }
}
