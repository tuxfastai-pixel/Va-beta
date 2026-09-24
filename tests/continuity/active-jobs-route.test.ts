import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"
import {
  getSupabaseAdminClient,
  supabaseConfigurationUnavailableResponse,
} from "../../lib/server/supabaseAdmin.ts"

test("active-jobs route evaluation does not require Supabase configuration", async () => {
  const previousUrl = process.env.SUPABASE_URL
  const previousPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  delete process.env.SUPABASE_URL
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY

  try {
    const route = await import(
      `../../app/api/active-jobs/route.ts?missing-supabase=${Date.now()}`
    )
    assert.equal(typeof route.GET, "function")
  } finally {
    restoreEnvironmentVariable("SUPABASE_URL", previousUrl)
    restoreEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL", previousPublicUrl)
    restoreEnvironmentVariable(
      "SUPABASE_SERVICE_ROLE_KEY",
      previousServiceRoleKey
    )
  }
})

test("active-jobs authenticates before resolving private configuration", async () => {
  const routeSource = await readFile(
    new URL("../../app/api/active-jobs/route.ts", import.meta.url),
    "utf8"
  )

  const authentication = routeSource.indexOf("await getSessionUser()")
  const configuration = routeSource.indexOf("getSupabaseAdminClient()")

  assert.ok(authentication >= 0)
  assert.ok(configuration > authentication)
  assert.match(routeSource, /supabaseConfigurationUnavailableResponse\(\)/)
  assert.doesNotMatch(routeSource, /SUPABASE_SERVICE_ROLE_KEY/)
})

test("admin client factory handles missing, malformed, and valid configuration", () => {
  const previousUrl = process.env.SUPABASE_URL
  const previousPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  try {
    delete process.env.SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    assert.equal(getSupabaseAdminClient(), null)

    process.env.SUPABASE_URL = "not a URL"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "private-test-key"
    assert.equal(getSupabaseAdminClient(), null)

    process.env.SUPABASE_URL = "https://example.supabase.co"
    const configuredClient = getSupabaseAdminClient()
    assert.ok(configuredClient)
    assert.equal(configuredClient.supabaseUrl, "https://example.supabase.co")
  } finally {
    restoreEnvironmentVariable("SUPABASE_URL", previousUrl)
    restoreEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL", previousPublicUrl)
    restoreEnvironmentVariable(
      "SUPABASE_SERVICE_ROLE_KEY",
      previousServiceRoleKey
    )
  }
})

test("missing Supabase configuration has a generic 503 response", async () => {
  const response = supabaseConfigurationUnavailableResponse()

  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), {
    error: "Service temporarily unavailable",
  })
})

function restoreEnvironmentVariable(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}
