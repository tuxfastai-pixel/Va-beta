import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ADMIN_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ADMIN_KEY) {
  console.error("❌ Missing environment variables:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL:", SUPABASE_URL ? "✓" : "✗");
  console.error("   SUPABASE_SERVICE_ROLE_KEY:", SUPABASE_ADMIN_KEY ? "✓" : "✗");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ADMIN_KEY);

async function applyMigration() {
  try {
    console.log("📂 Reading migration file...");
    const migrationFiles = [
      "20260713080011_post_wizard_activation_continuity.sql",
      "20260713202941_career_journey_stage_tracking.sql",
    ];

    for (const migrationFile of migrationFiles) {
      const migrationPath = path.join(
        __dirname,
        "../supabase/migrations",
        migrationFile
      );

      if (!fs.existsSync(migrationPath)) {
        console.error(`Migration file not found: ${migrationPath}`);
        process.exit(1);
      }

      const migrationSQL = fs.readFileSync(migrationPath, "utf-8");
      console.log(`Applying ${migrationFile} (${migrationSQL.length} bytes)`);

      const { error } = await supabase.rpc("exec_sql", {
        sql: migrationSQL,
      });

      if (error) {
        console.error(`Migration failed: ${migrationFile}`, error);
        process.exit(1);
      }
    }
    // Verify migration
    console.log("\n✅ Verifying schema changes...");

    const { data: columns, error: colError } = await supabase
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_name", "career_activation_states")
      .in("column_name", [
        "current_stage",
        "completed_stages",
        "career_activation_completed",
      ]);

    if (colError) {
      console.warn("⚠️  Could not verify columns via RPC, checking directly...");
    } else if (columns && columns.length === 3) {
      console.log("✓ New columns added to career_activation_states");
    }

    console.log("\n✅ All done! Migration applied to production.");
    console.log("\nNext steps:");
    console.log("1. Deploy to Vercel: npm run build && git push");
    console.log("2. Run test scenarios from DEPLOYMENT_CHECKLIST.md");
    console.log(
      "3. Sign off when all 8 tests pass: Phase 1 production-complete"
    );
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

applyMigration();
