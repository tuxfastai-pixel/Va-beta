import { createClient } from "@supabase/supabase-js";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const session = await getSessionUser();

  if (!session?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(20);

  return Response.json(data);
}
