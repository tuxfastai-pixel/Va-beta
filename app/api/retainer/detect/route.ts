import { NextRequest, NextResponse } from "next/server";
import {
  detectRetainerOpportunity,
  estimateRetainerValue,
  generateRetainerPitch,
} from "@/lib/retainer/retainerEngine";

type DetectRequestBody = {
  job?: {
    title?: string;
    description?: string;
    pay_amount?: number;
    client_name?: string;
  };
};

export async function POST(req: NextRequest) {
  let body: DetectRequestBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.job) {
    return NextResponse.json({ error: "job is required" }, { status: 400 });
  }

  const result = detectRetainerOpportunity(body.job);
  const estimatedMonthlyValue = estimateRetainerValue(body.job);
  const pitch = result.probability > 0.5 ? generateRetainerPitch(body.job.client_name) : null;

  return NextResponse.json({
    ...result,
    estimatedMonthlyValue,
    shouldTriggerPitch: result.probability > 0.5,
    pitch,
  });
}
