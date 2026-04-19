import { NextResponse } from "next/server"
import OpenAI from "openai"
import { supabaseServer } from "@/lib/supabaseServer"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

export async function POST(req: Request) {
  const { userId, goal } = await req.json()

  const roadmapPrompt = `
Create a learning roadmap for someone who wants to become a ${goal}.

Return JSON format:

[
 { "skill": "...", "priority": 1 }
]
`

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a career planning assistant." },
      { role: "user", content: roadmapPrompt }
    ]
  })

  const rawRoadmap = completion.choices[0].message.content ?? "[]"
  const parsedRoadmap = JSON.parse(rawRoadmap)

  await supabaseServer
    .from("career_paths")
    .insert({
      user_id: userId,
      career_goal: goal,
      roadmap: parsedRoadmap
    })

  return NextResponse.json({ roadmap: parsedRoadmap })
}
