import { supabaseServer } from "@/lib/supabaseServer";

export type LoadedUser = {
  id: string;
  careers: string[];
  primary_career?: string | null;
  secondary_careers?: string[] | null;
  resume?: string | null;
  profile?: string | null;
  safe_mode?: boolean | null;
  system_paused?: boolean | null;
  provider?: string | null;
  google_access_token?: string | null;
  google_refresh_token?: string | null;
  google_sheet_id?: string | null;
};

function normalizeLoadedUser(user: LoadedUser): LoadedUser {
  const careers = Array.isArray(user.careers)
    ? user.careers.filter((career): career is string => typeof career === "string" && career.trim().length > 0)
    : [];

  const primary = String(user.primary_career || "").trim() || careers[0] || "admin";
  const secondary = Array.isArray(user.secondary_careers)
    ? user.secondary_careers.filter((career): career is string => typeof career === "string" && career.trim().length > 0)
    : careers.slice(1);

  return {
    ...user,
    careers: Array.from(new Set([primary, ...secondary])).slice(0, 3),
    primary_career: primary,
    secondary_careers: secondary,
  };
}

export async function getActiveUsers(limit = 50) {
  const { data, error } = await supabaseServer
    .from("profiles")
    .select("id, careers, primary_career, secondary_careers, resume, profile, safe_mode, system_paused, provider, google_access_token, google_refresh_token, google_sheet_id")
    .limit(limit);

  if (error) {
    return [] as LoadedUser[];
  }

  return ((data || []) as LoadedUser[]).map(normalizeLoadedUser);
}

export async function loadActiveUsers(limit = 50) {
  return getActiveUsers(limit);
}

export async function loadUserById(userId: string) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return null;
  }

  const { data, error } = await supabaseServer
    .from("profiles")
    .select("id, careers, primary_career, secondary_careers, resume, profile, safe_mode, system_paused, provider, google_access_token, google_refresh_token, google_sheet_id")
    .eq("id", normalizedUserId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeLoadedUser(data as LoadedUser);
}
