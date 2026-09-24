import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Creates the privileged Supabase client only when server code needs it.
 *
 * Returning null keeps missing or malformed deployment configuration from
 * throwing while Next.js evaluates route modules during a production build.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  const url = (
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  ).trim()
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim()

  if (!url || !serviceRoleKey) {
    return null
  }

  try {
    const parsedUrl = new URL(url)
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return null
    }

    return createClient(url, serviceRoleKey)
  } catch {
    return null
  }
}

export function supabaseConfigurationUnavailableResponse(): Response {
  return Response.json(
    { error: "Service temporarily unavailable" },
    { status: 503 }
  )
}
