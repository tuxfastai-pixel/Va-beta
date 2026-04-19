import { NextResponse } from "next/server";
import {
  createReferral,
  generateReferralMessage,
  getReferralStats,
  markReferralConverted,
} from "@/lib/growth/referralEngine";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const referrerUserId = String(url.searchParams.get("referrerUserId") || "").trim();

    if (!referrerUserId) {
      return NextResponse.json(
        {
          incentive: [
            "Get 1 month free for every client you refer",
            "Earn 10% recurring revenue",
          ],
          sampleMessage: generateReferralMessage(),
        },
        { status: 200 }
      );
    }

    const stats = await getReferralStats(referrerUserId);
    return NextResponse.json({ stats, sampleMessage: generateReferralMessage() });
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
    const mode = String(body?.mode || "create");

    if (mode === "convert") {
      const referredEmail = String(body?.referredEmail || "").trim().toLowerCase();
      const referredClientId = String(body?.referredClientId || "").trim();

      if (!referredEmail || !referredClientId) {
        return NextResponse.json(
          { error: "referredEmail and referredClientId are required" },
          { status: 400 }
        );
      }

      await markReferralConverted(referredEmail, referredClientId);
      return NextResponse.json({ success: true });
    }

    const referrerUserId = String(body?.referrerUserId || "").trim();
    const referredEmail = String(body?.referredEmail || "").trim().toLowerCase();
    const rewardType = body?.rewardType === "recurring_revenue" ? "recurring_revenue" : "free_month";

    if (!referrerUserId || !referredEmail) {
      return NextResponse.json(
        { error: "referrerUserId and referredEmail are required" },
        { status: 400 }
      );
    }

    const referral = await createReferral({ referrerUserId, referredEmail, rewardType });
    return NextResponse.json({ success: true, referral, message: generateReferralMessage() });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
