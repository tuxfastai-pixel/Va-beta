const TEST_SUPABASE_HOST = "va-beta-test.invalid";
const originalFetch = globalThis.fetch;

process.env.VA_BETA_TEST_MODE = "1";
process.env.SUPABASE_URL = `https://${TEST_SUPABASE_HOST}`;
process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${TEST_SUPABASE_HOST}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = "va-beta-isolated-test-key";

globalThis.fetch = async (input, init) => {
  const rawUrl =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  const url = new URL(rawUrl);

  if (url.hostname !== TEST_SUPABASE_HOST) {
    return originalFetch(input, init);
  }

  const marker = "/rest/v1/";
  const markerIndex = url.pathname.indexOf(marker);
  const table =
    markerIndex >= 0
      ? decodeURIComponent(
          url.pathname.slice(markerIndex + marker.length).split("/")[0] || "unknown"
        )
      : "unknown";

  return new Response(
    JSON.stringify({
      code: "PGRST205",
      details: null,
      hint: null,
      message: `Could not find the table 'public.${table}' in the schema cache`,
    }),
    {
      status: 404,
      headers: { "content-type": "application/json" },
    }
  );
};
