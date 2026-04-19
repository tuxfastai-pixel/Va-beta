import { NextResponse } from "next/server";
import {
  updateTemplatePerformance,
  selectBestTemplate,
  runSelfImprovementLoop,
} from "@/lib/outreach/templateOptimizer";

export async function GET() {
  try {
    const best = await selectBestTemplate();
    return NextResponse.json({ bestTemplate: best });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const templateId = String(body?.templateId || "").trim();
    const runLoop = Boolean(body?.runLoop);

    if (runLoop) {
      const result = await runSelfImprovementLoop();
      return NextResponse.json({ success: true, ...result });
    }

    if (!templateId) {
      return NextResponse.json(
        { error: "templateId is required when runLoop is false" },
        { status: 400 }
      );
    }

    const performance = await updateTemplatePerformance(templateId);
    return NextResponse.json({ success: true, performance });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
