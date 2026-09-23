import { createClient } from "@supabase/supabase-js";
import { config as loadDotenv } from "dotenv";

// Load local env for direct script execution outside Next.js runtime.
loadDotenv({ path: ".env.local" });
loadDotenv();

type CheckResult = {
  name: string;
  ok: boolean;
  detail?: string;
};

const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "CRON_SECRET",
  "JWT_SECRET",
  "NEXT_PUBLIC_APP_URL",
] as const;

const REQUIRED_TABLES = [
  "career_profiles",
  "trust_history_records",
  "user_personalization_states",
  "equilibrium_events",
  "runtime_rollout_policies",
  "runtime_snapshots",
  "runtime_snapshot_anchors",
] as const;

function boolMark(ok: boolean): string {
  return ok ? "PASS" : "FAIL";
}

function getMissingEnv(): string[] {
  return REQUIRED_ENV.filter((name) => {
    const value = process.env[name];
    return !value || value.trim().length === 0;
  });
}

function isMissingTableError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("could not find the table") || lower.includes("relation") && lower.includes("does not exist");
}

async function checkTableExists(supabase: ReturnType<typeof createClient>, table: string): Promise<CheckResult> {
  const { error } = await supabase.from(table).select("*").limit(1);

  if (!error) {
    return { name: `table:${table}`, ok: true };
  }

  if (isMissingTableError(error.message || "")) {
    return {
      name: `table:${table}`,
      ok: false,
      detail: "missing (apply migrations)",
    };
  }

  return {
    name: `table:${table}`,
    ok: false,
    detail: `query error: ${error.message}`,
  };
}

async function main() {
  const results: CheckResult[] = [];

  const missingEnv = getMissingEnv();
  results.push({
    name: "env:required-vars",
    ok: missingEnv.length === 0,
    detail: missingEnv.length ? `missing ${missingEnv.join(", ")}` : "all required vars present",
  });

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    results.push({
      name: "db:connectivity",
      ok: false,
      detail: "SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    });
  } else {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data, error } = await supabase.from("profiles").select("id", { count: "exact", head: true });
    void data;
    results.push({
      name: "db:connectivity",
      ok: !error,
      detail: error ? error.message : "connected",
    });

    for (const table of REQUIRED_TABLES) {
      results.push(await checkTableExists(supabase, table));
    }
  }

  const failures = results.filter((r) => !r.ok);

  console.log("\nPilot Readiness Check\n");
  for (const result of results) {
    const suffix = result.detail ? ` - ${result.detail}` : "";
    console.log(`[${boolMark(result.ok)}] ${result.name}${suffix}`);
  }

  if (failures.length > 0) {
    console.log(`\nGate status: BLOCKED (${failures.length} failing check${failures.length === 1 ? "" : "s"})`);
    process.exitCode = 1;
    return;
  }

  console.log("\nGate status: READY (all checks passed)");
}

main().catch((error) => {
  console.error("Readiness check failed:", error);
  process.exitCode = 1;
});
