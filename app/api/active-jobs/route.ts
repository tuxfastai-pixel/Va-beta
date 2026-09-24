import { getSessionUser } from "@/lib/auth/sessionUser";
import {
  getSupabaseAdminClient,
  supabaseConfigurationUnavailableResponse,
} from "@/lib/server/supabaseAdmin";

export async function GET() {
  const session = await getSessionUser();

  if (!session?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return supabaseConfigurationUnavailableResponse();
  }

  const { data, error } = await supabase
    .from("active_jobs")
    .select("*")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
