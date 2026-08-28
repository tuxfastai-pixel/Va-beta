import { NextRequest, NextResponse } from "next/server";
import { runStressTest, exportStressTestResults, type StressTestConfig } from "@/lib/testing/stressTestHarness";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminRole } from "@/lib/auth/serverAuth";

export async function POST(request: NextRequest) {
  const auth = await requireAdminRole();

  if ("response" in auth) {
    return auth.response;
  }
  try {
    const body = await request.json();
    const { userId, config, duration } = body;

    // Validate request
    if (!userId || !config) {
      return NextResponse.json(
        { error: "Missing userId or config" },
        { status: 400 }
      );
    }

    // Run stress test
    const stressTestConfig: StressTestConfig = {
      duration: duration || config.duration || "standard",
      cycles: config.cycles || 200,
      categories: config.categories || [
        "identity_stability",
        "resume_evolution_drift",
        "auto_apply_safety",
        "negotiation_stability",
        "mobile_runtime",
        "governance_integrity",
        "adaptive_loop_stability",
      ],
      chaosLevel: config.chaosLevel || "medium",
    };

    const result = await runStressTest(stressTestConfig);
    const exportedResult = exportStressTestResults(result);

    // Store result in database
    try {
      await supabaseServer
        .from("stress_test_results")
        .insert({
          user_id: userId,
          test_id: result.testId,
          config: stressTestConfig,
          result: exportedResult,
          created_at: new Date().toISOString(),
        });
    } catch (dbError) {
      console.error("Error storing stress test result:", dbError);
      // Continue even if storage fails
    }

    return NextResponse.json({
      success: true,
      testId: result.testId,
      timestamp: result.timestamp.toISOString(),
      durationSeconds: Math.round(result.durationMs / 1000),
      result: exportedResult,
    });
  } catch (error) {
    console.error("Error in stress test API:", error);
    return NextResponse.json(
      { error: "Internal server error", success: false },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminRole();

  if ("response" in auth) {
    return auth.response;
  }
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const testId = searchParams.get("testId");

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      );
    }

    if (testId) {
      // Get specific test result
      const { data, error } = await supabaseServer
        .from("stress_test_results")
        .select("*")
        .eq("user_id", userId)
        .eq("test_id", testId)
        .single();

      if (error) {
        return NextResponse.json(
          { error: "Test not found", success: false },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        result: data,
      });
    } else {
      // Get all test results for user
      const { data, error } = await supabaseServer
        .from("stress_test_results")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        return NextResponse.json(
          { error: "Failed to retrieve tests", success: false },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        results: data || [],
      });
    }
  } catch (error) {
    console.error("Error in stress test GET:", error);
    return NextResponse.json(
      { error: "Internal server error", success: false },
      { status: 500 }
    );
  }
}
