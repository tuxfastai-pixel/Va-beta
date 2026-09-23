import { runStressTest } from "../lib/testing/stressTestHarness.ts";

async function main() {
  const result = await runStressTest({
    duration: "intensive",
    cycles: 500,
    chaosLevel: "high",
    categories: [
      "identity_stability",
      "resume_evolution_drift",
      "interview_alignment",
      "mobile_runtime",
      "governance_integrity",
      "adaptive_loop_stability",
    ],
  });

  const adaptive = result.categories.find((category) => category.category === "adaptive_loop_stability");
  const drift = result.categories.find((category) => category.category === "resume_evolution_drift");

  console.log(
    JSON.stringify(
      {
        overallHealthScore: result.overallHealthScore,
        totalCriticalFailures: result.criticalFailures.length,
        totalWarnings: result.warnings.length,
        adaptive: {
          healthScore: adaptive?.healthScore,
          passed: adaptive?.passed,
          criticalFailures: adaptive?.criticalFailures.length,
          warnings: adaptive?.warnings.length,
          metrics: adaptive?.metrics,
        },
        drift: {
          healthScore: drift?.healthScore,
          passed: drift?.passed,
          criticalFailures: drift?.criticalFailures.length,
          warnings: drift?.warnings.length,
          metrics: drift?.metrics,
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
