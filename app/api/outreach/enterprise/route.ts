import { NextResponse } from "next/server";
import { runEnterpriseOutreach } from "@/lib/enterprise/outreachAgent";

export async function POST() {
  try {
    const result = await runEnterpriseOutreach();
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
