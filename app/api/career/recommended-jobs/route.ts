import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth/sessionUser"
import { supabaseServer } from "@/lib/supabaseServer"

export async function GET() {
  try {
    const session = await getSessionUser()
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabaseServer
      .from("jobs")
      .select("id,title,company,description,match_score")
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

    const jobs = (data || []).map((job) => ({
      id: String(job.id),
      title: String(job.title || "Untitled role"),
      company: String(job.company || "Company not provided"),
      description: String(job.description || "No description provided."),
      level:
        job.match_score === null
          ? "Not yet scored"
          : `${Number(job.match_score)}% profile match`,
      matchScore:
        job.match_score === null
          ? null
          : Number(job.match_score),
    }))

    return NextResponse.json({ jobs })
  } catch (error) {
    console.error("recommended-jobs error:", error)
    return NextResponse.json(
      { error: "Could not load recommended jobs." },
      { status: 500 }
    )
  }
}