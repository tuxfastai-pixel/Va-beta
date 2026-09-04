import { NextRequest, NextResponse } from "next/server";
import { CAREERS, normalizeCareer } from "@/lib/careers/config";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type SaveCareersBody = {
  userId?: string;
  careers?: string[];
};

function isMissingCareerColumns(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("careers") ||
    message.includes("primary_career") ||
    message.includes("secondary_careers")
  );
}

function isMissingCareerActivationTable(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("career_activation_states") && message.includes("could not find the table");
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as SaveCareersBody;
  const userId = String(body.userId || "").trim();
  const rawCareers = Array.isArray(body.careers) ? body.careers : [];

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const normalized = Array.from(
    new Set(
      rawCareers
        .map((career) => normalizeCareer(String(career || "")))
        .filter((career): career is (typeof CAREERS)[number] => Boolean(career))
    )
  );

  if (normalized.length === 0) {
    return NextResponse.json({ error: "No careers selected" }, { status: 400 });
  }

  if (normalized.length > 3) {
    return NextResponse.json({ error: "Max 3 careers allowed" }, { status: 400 });
  }

  const primary = normalized[0];
  const secondary = normalized.slice(1);

  const { error } = await supabaseServer
    .from("profiles")
    .update({
      careers: normalized,
      primary_career: primary,
      secondary_careers: secondary,
    })
    .eq("id", userId);

  if (error && !isMissingCareerColumns(error)) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (error && isMissingCareerColumns(error)) {
    const { error: fallbackError } = await supabaseServer
      .from("career_activation_states")
      .upsert(
        {
          user_id: userId,
          career_lanes: {
            selected: normalized,
            primary,
            secondary,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (fallbackError) {
      if (!isMissingCareerActivationTable(fallbackError)) {
        return NextResponse.json({ error: fallbackError.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({
    success: true,
    primary,
    secondary,
  });
}
