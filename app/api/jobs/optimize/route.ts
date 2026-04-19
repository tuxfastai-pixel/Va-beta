import { NextResponse } from "next/server";
import { getBestJobs, updateJobProfitScores } from "@/lib/jobs/profitEngine";

export async function POST() {
  try {
    await updateJobProfitScores();
    const jobs = await getBestJobs(10);

    return NextResponse.json(jobs);
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
