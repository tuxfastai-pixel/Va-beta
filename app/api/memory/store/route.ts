import { NextResponse } from "next/server"
import OpenAI from "openai"
import { supabaseServer } from "@/lib/supabaseServer"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(req: Request) {
  const { userId, message } = await req.json()

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Extract important long-term facts about the user in one sentence."
      },
      { role: "user", content: message }
    ]
  })

  const memory = completion.choices[0].message.content

  await supabaseServer.from("ai_memory").insert({
    user_id: userId,
    content: memory,
    memory_type: "career"
  })

  return NextResponse.json({ success: true })
}
