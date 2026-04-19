import { getUserMode } from "@/lib/mode/modeManager";
import { autoApplyToJobs } from "@/lib/jobs/autoApplyEngine";
import { getUserGoal, scaleGoalIfNeeded } from "@/lib/autonomy/scaleEngine";
import { checkAccess } from "@/lib/access/accessGuard";
import { runAccountManager } from "@/lib/clients/accountManager";
import { saveForecast } from "@/lib/forecast/forecastEngine";
import { rescoreAllClients } from "@/lib/clients/clientScoring";

export async function runAutonomousCycle(userId: string) {
  // Check access first
  const hasAccess = await checkAccess(userId);
  if (!hasAccess) {
    return { status: "skipped", reason: "access_denied" as const };
  }

  const mode = await getUserMode(userId);

  if (mode !== "autonomous") {
    return { status: "skipped", reason: "assist_mode" as const };
  }

  try {
    // Rescore clients and run account management cycle
    await rescoreAllClients(userId);
    const accountMgrResult = await runAccountManager(userId);
    console.log(`👥 Account manager: ${accountMgrResult.clientsProcessed} clients, ${accountMgrResult.messagesSent} messages`);

    // Update income forecast
    await saveForecast(userId).catch((err) => {
      console.error("Forecast update error (non-fatal):", err);
    });

    // Run auto-apply
    const applications = await autoApplyToJobs(userId);

    // Get user's goal and check if scaling is needed
    const goal = await getUserGoal(userId, "income");
    
    if (goal) {
      // Update goal progress with applications
      if (applications.length > 0) {
        // Assuming each successful application adds to progress
        // This can be customized based on your earnings model
        console.log(`📊 ${applications.length} applications created - may update goal progress`);
      }

      // Check if goal needs scaling
      const scaleResult = await scaleGoalIfNeeded(goal);
      if (scaleResult.scaled) {
        console.log(`🔥 Goal automatically scaled: ${scaleResult.previousTarget} → ${scaleResult.newTarget}`);
        return {
          status: "executed" as const,
          applicationsCreated: applications.length,
          goalScaled: true,
          newTarget: scaleResult.newTarget,
        };
      }
    }

    return {
      status: "executed" as const,
      applicationsCreated: applications.length,
      goalScaled: false,
    };
  } catch (error) {
    console.error("Autonomous cycle error:", error);
    return { status: "error" as const, reason: String(error) };
  }
}