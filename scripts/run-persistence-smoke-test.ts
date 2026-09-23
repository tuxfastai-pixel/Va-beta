import { createClient } from "@supabase/supabase-js";
import { config as loadDotenv } from "dotenv";

// Load local env for direct script execution outside Next.js runtime.
loadDotenv({ path: ".env.local" });
loadDotenv();

type SmokeRecord = {
  key: string;
  ok: boolean;
  detail?: string;
};

const STEP_TIMEOUT_MS = 30_000;

function stamp(): string {
  return Date.now().toString(16);
}

function assertTrue(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function withTimeout<T>(operation: () => PromiseLike<T>, label: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`${label} timed out after ${STEP_TIMEOUT_MS}ms`)), STEP_TIMEOUT_MS);
  });

  return Promise.race([Promise.resolve(operation()), timeout]);
}

async function main() {
  const runId = `smoke-${stamp()}`;
  const keepData = process.argv.includes("--keep");

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const records: SmokeRecord[] = [];

  const founderId = `${runId}-founder`;
  const teacherId = `${runId}-teacher`;
  const nonTechId = `${runId}-nontech`;

  const careerProfileId = `${runId}-career`;
  const snapshotId = `${runId}-snapshot`;
  const anchorId = `${runId}-anchor`;

  try {
    console.log(`Starting persistence smoke run: ${runId}`);

    const profilePayload = {
      id: careerProfileId,
      user_id: founderId,
      created_at: new Date().toISOString(),
      intake: {
        userId: founderId,
        resumeText: "Pilot founder resume text",
        conversationText: "Founder onboarding conversation",
      },
      profile: {
        userId: founderId,
        generatedAt: new Date().toISOString(),
        profileConfidence: 0.9,
        internationalEmployabilityScore: 0.8,
        overallReadiness: 0.85,
        resumeSummary: "Founder profile summary",
        summary: "Founder summary",
        rawSkills: ["operations"],
        translatedSkills: ["operations"],
        hiddenSkills: [],
        recommendedRoles: ["Operations Coordinator"],
        workPreferences: {
          remote: true,
          hybrid: false,
          international: true,
          contract: true,
          fullTime: true,
          timezoneFlexibility: "global",
          pacingPreference: "balanced",
          quietMode: true,
        },
        pacingNotes: [],
        trustNotes: [],
        skillConfidence: { operations: 0.8 },
        supportNeeds: [],
        sourceConfidence: 0.9,
      },
      reconstruction: {
        atsCv: "ATS resume",
        remoteReadyCv: "Remote resume",
        shortBio: "Founder bio",
        linkedinSummary: "Founder LinkedIn summary",
        skillsMatrix: [{ skill: "operations", evidence: 0.8, roleFit: 0.85 }],
        internationalEmployabilityScore: 0.8,
        confidenceProfile: "high",
      },
    };

    {
      console.log("Step: career_profiles upsert/read");
      const { error } = await withTimeout(
        () => supabase.from("career_profiles").upsert(profilePayload, { onConflict: "id" }),
        "career_profiles upsert",
      );
      assertTrue(!error, `career_profiles upsert failed: ${error?.message}`);

      const { data, error: selectError } = await withTimeout(
        () =>
          supabase
            .from("career_profiles")
            .select("id,user_id")
            .eq("id", careerProfileId)
            .maybeSingle(),
        "career_profiles select",
      );

      assertTrue(!selectError, `career_profiles verify failed: ${selectError?.message}`);
      assertTrue(Boolean(data?.id), "career_profiles row not found after write");
      records.push({ key: "career_profiles_persistence", ok: true });
    }

    {
      console.log("Step: user_personalization_states upsert/read");
      const statePayload = {
        user_id: teacherId,
        state: {
          userId: teacherId,
          eventHistory: [],
          profile: { stabilityIndex: 0.7 },
          rhythm: { consistency: 0.6 },
          recovery: { profileVersion: "v1" },
          trust: { trustStability: 0.66 },
          identity: { fingerprint: `${runId}-fp` },
          updatedAt: Date.now(),
        },
        updated_at: new Date().toISOString(),
      };

      const { error } = await withTimeout(
        () => supabase.from("user_personalization_states").upsert(statePayload, { onConflict: "user_id" }),
        "user_personalization_states upsert",
      );
      assertTrue(!error, `user_personalization_states upsert failed: ${error?.message}`);

      const { data, error: selectError } = await withTimeout(
        () =>
          supabase
            .from("user_personalization_states")
            .select("user_id,state")
            .eq("user_id", teacherId)
            .maybeSingle(),
        "user_personalization_states select",
      );

      assertTrue(!selectError, `user_personalization_states verify failed: ${selectError?.message}`);
      assertTrue(Boolean(data?.user_id), "user_personalization_states row not found after write");
      records.push({ key: "personalization_persistence", ok: true });
    }

    {
      console.log("Step: trust_history_records upsert/read");
      const trustPayload = {
        user_id: nonTechId,
        record: {
          userId: nonTechId,
          trustWindows: [],
          transitions: [],
          interventionEffects: [],
          pacingReactions: [],
          recoveryOutcomes: [],
          autonomyAcceptance: [],
          driftAlerts: [],
          updatedAt: Date.now(),
        },
        updated_at: new Date().toISOString(),
      };

      const { error } = await withTimeout(
        () => supabase.from("trust_history_records").upsert(trustPayload, { onConflict: "user_id" }),
        "trust_history_records upsert",
      );
      assertTrue(!error, `trust_history_records upsert failed: ${error?.message}`);

      const { data, error: selectError } = await withTimeout(
        () =>
          supabase
            .from("trust_history_records")
            .select("user_id")
            .eq("user_id", nonTechId)
            .maybeSingle(),
        "trust_history_records select",
      );

      assertTrue(!selectError, `trust_history_records verify failed: ${selectError?.message}`);
      assertTrue(Boolean(data?.user_id), "trust_history_records row not found after write");
      records.push({ key: "trust_history_persistence", ok: true });
    }

    {
      console.log("Step: equilibrium_events insert");
      const eventPayload = {
        user_id: teacherId,
        event_timestamp: Date.now(),
        event_type: "pilot.smoke",
        previous_state: "balanced",
        next_state: "balanced",
        pressure_level: 0.35,
        fatigue_risk: 0.25,
        recovery_triggered: false,
        metadata: { runId },
      };

      const { error } = await withTimeout(
        () => supabase.from("equilibrium_events").insert(eventPayload),
        "equilibrium_events insert",
      );
      assertTrue(!error, `equilibrium_events insert failed: ${error?.message}`);
      records.push({ key: "equilibrium_events_persistence", ok: true });
    }

    {
      console.log("Step: runtime_rollout_policies upsert");
      const { error } = await withTimeout(
        () =>
          supabase.from("runtime_rollout_policies").upsert(
            {
              policy_key: "feature_rollout",
              policy: { featureKey: "smoke", enabled: true, mode: "percentage", percentage: 100 },
              updated_at: new Date().toISOString(),
            },
            { onConflict: "policy_key" },
          ),
        "runtime_rollout_policies upsert",
      );
      assertTrue(!error, `runtime_rollout_policies upsert failed: ${error?.message}`);
      records.push({ key: "rollout_policy_persistence", ok: true });
    }

    {
      console.log("Step: runtime_snapshots and runtime_snapshot_anchors upsert");
      const snapshotPayload = {
        snapshot_id: snapshotId,
        user_id: founderId,
        captured_at: Date.now(),
        checksum: `${runId}-checksum`,
        snapshot_path: `.runtime/snapshots/${snapshotId}.json`,
        payload: {
          id: snapshotId,
          userId: founderId,
          capturedAt: Date.now(),
          checksum: `${runId}-checksum`,
        },
        updated_at: new Date().toISOString(),
      };

      const { error } = await withTimeout(
        () => supabase.from("runtime_snapshots").upsert(snapshotPayload, { onConflict: "snapshot_id" }),
        "runtime_snapshots upsert",
      );
      assertTrue(!error, `runtime_snapshots upsert failed: ${error?.message}`);

      const { error: anchorError } = await withTimeout(
        () =>
          supabase.from("runtime_snapshot_anchors").upsert(
            {
              anchor_id: anchorId,
              snapshot_id: snapshotId,
              user_id: founderId,
              created_at_ms: Date.now(),
              snapshot_path: snapshotPayload.snapshot_path,
              checksum: snapshotPayload.checksum,
              parent_anchor_id: null,
              lineage_depth: 0,
              reason: "smoke-test",
              signature: `${runId}-signature`,
            },
            { onConflict: "anchor_id" },
          ),
        "runtime_snapshot_anchors upsert",
      );
      assertTrue(!anchorError, `runtime_snapshot_anchors upsert failed: ${anchorError?.message}`);
      records.push({ key: "runtime_snapshot_persistence", ok: true });
    }
  } finally {
    console.log("Cleanup: deleting smoke test records");
    if (!keepData) {
      await withTimeout(() => supabase.from("career_profiles").delete().eq("id", careerProfileId), "cleanup career_profiles");
      await withTimeout(() => supabase.from("user_personalization_states").delete().eq("user_id", teacherId), "cleanup user_personalization_states");
      await withTimeout(() => supabase.from("trust_history_records").delete().eq("user_id", nonTechId), "cleanup trust_history_records");
      await withTimeout(() => supabase.from("runtime_snapshot_anchors").delete().eq("anchor_id", anchorId), "cleanup runtime_snapshot_anchors");
      await withTimeout(() => supabase.from("runtime_snapshots").delete().eq("snapshot_id", snapshotId), "cleanup runtime_snapshots");
      await withTimeout(
        () => supabase.from("equilibrium_events").delete().eq("event_type", "pilot.smoke").eq("user_id", teacherId),
        "cleanup equilibrium_events",
      );
    }
  }

  console.log("\nPersistence Smoke Test\n");
  for (const rec of records) {
    const suffix = rec.detail ? ` - ${rec.detail}` : "";
    console.log(`[${rec.ok ? "PASS" : "FAIL"}] ${rec.key}${suffix}`);
  }

  const failed = records.filter((rec) => !rec.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
    console.log(`\nSmoke status: FAILED (${failed.length})`);
    return;
  }

  console.log("\nSmoke status: PASSED");
}

main().catch((error) => {
  console.error("Smoke test failed:", error);
  process.exitCode = 1;
});
