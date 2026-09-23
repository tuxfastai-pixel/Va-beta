import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { supabaseServer } from "@/lib/supabaseServer"
import { runOpportunityHunter } from "@/lib/jobs/opportunityHunter"

export const dynamic = "force-dynamic"

function metadataFromDescription(description: string) {
  return {
    source: description.match(/(?:^|\n)Source:\s*([^\n]+)/i)?.[1]?.trim() || null,
    location: description.match(/(?:^|\n)Location:\s*([^\n]+)/i)?.[1]?.trim() || null,
    salary: description.match(/(?:^|\n)Salary:\s*([^\n]+)/i)?.[1]?.trim() || null,
    applyUrl: description.match(/(?:^|\n)Application link:\s*(https:\/\/\S+)/i)?.[1]?.trim() || null,
    summary: description.split(/\nSource:/i)[0]?.trim() || description,
  }
}

export async function GET() {
  try {
    const session = await getSessionUser()
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabaseServer
      .from("jobs")
      .select("id,title,company,description,match_score,quality_score,scam_risk,quality_reason")
      .eq("user_id", session.userId)
      .order("match_score", {
        ascending: false,
        nullsFirst: false,
      })
      .limit(12)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    const jobs = (data || [])
      .filter((job) => {
        const risk = Number(job.scam_risk)
        return !Number.isFinite(risk) || risk < 0.6
      })
      .map((job) => {
        const description = String(job.description || "No description provided.")
        const metadata = metadataFromDescription(description)
        return {
          id: String(job.id),
          title: String(job.title || "Untitled role"),
          company: String(job.company || "Company not provided"),
          description: metadata.summary,
          source: metadata.source,
          location: metadata.location,
          salary: metadata.salary,
          applyUrl: metadata.applyUrl,
          qualityScore: Number(job.quality_score || 0),
          qualityReason: String(job.quality_reason || ""),
          recommended: Number(job.match_score || 0) >= 75,
          level:
            job.match_score === null
              ? "Not yet scored"
              : `${Number(job.match_score)}% profile match`,
          matchScore:
            job.match_score === null
              ? null
              : Number(job.match_score),
        }
      })

    return NextResponse.json({ jobs })
  } catch (error) {
    console.error("recommended-jobs error:", error)
    return NextResponse.json(
      { error: "Could not load recommended jobs." },
      { status: 500 }
    )
  }
}

export async function POST() {
  try {
    const session = await getSessionUser()
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await runOpportunityHunter(session.userId)
    return NextResponse.json({
      success: true,
      ...result,
      rules: {
        sources: "approved_public_feeds_only",
        autoApply: false,
        requiresHumanApproval: true,
      },
    })
  } catch (error) {
    console.error("opportunity-hunter error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not search approved job feeds.",
      },
      { status: 502 }
    )
  }
}
