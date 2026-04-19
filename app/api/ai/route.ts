import OpenAI from "openai"
import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabaseServer"
import { selectAgent } from "@/lib/agentRouter"
import { logAIActivity } from "@/lib/ai/activityLogger"
import { CLIENT_TRANSPARENCY_NOTE, confidenceScore, selfValidate } from "@/lib/ai/outputQuality"
import { runConversation } from "@/lib/voice/conversationEngine"

type AIRequestBody = {
  message?: string
  sessionId?: string
  userId?: string
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

function buildFallbackPrompt(message: string) {
  const agent = selectAgent(message)

  if (agent === "careerCoach") {
    return [
      "You are an AI career coach helping beginners build careers.",
      "If the user wants admin work, writing, or a service career, explain the plan as:",
      "1. Create earning accounts on platforms like Upwork, Fiverr, LinkedIn, Freelancer, and PayPal.",
      "2. Build a profile that combines human skills and AI-assisted capabilities.",
      "3. Teach only the minimum practical skills needed to start earning.",
      "4. Clearly distinguish what AI can do immediately and what the user must learn.",
    ].join(" ")
  }

  if (agent === "instructor") {
    return "You are an AI instructor giving short, practical, execution-first tasks with examples and immediate next actions."
  }

  if (agent === "jobHunter") {
    return "You help users find remote jobs, prepare applications, and explain how AI can accelerate the work."
  }

  if (agent === "workAssistant") {
    return "You assist users in completing work tasks quickly, combining human judgment with AI execution."
  }

  return "You are an AI work assistant focused on practical execution, onboarding, earning readiness, and clear next steps."
}

async function persistMessages(sessionId: string | undefined, message: string, reply: string) {
  if (!sessionId) {
    return
  }

  const { error } = await supabaseServer.from("messages").insert([
    { session_id: sessionId, role: "user", content: message },
    { session_id: sessionId, role: "assistant", content: reply }
  ])

  if (error) {
    console.error(`Failed to persist AI messages: ${error.message}`)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as AIRequestBody
    const message = String(body.message || "").trim()
    const sessionId = body.sessionId?.trim()
    const userId = body.userId?.trim()

    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 })
    }

    let reply = ""
    let action: string | undefined
    let metadata: Record<string, unknown> | undefined

    if (userId) {
      const conversation = await runConversation({
        userId,
        input: message,
      })

      reply = conversation.reply
      action = conversation.action
      metadata = conversation.metadata
    } else {
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 })
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: buildFallbackPrompt(message) },
          { role: "user", content: message }
        ]
      })

      reply = completion.choices[0].message.content?.trim() || "I am ready to help you start earning."
      action = selectAgent(message)
    }

    const validation = await selfValidate(reply)
    const qualityScore = confidenceScore(reply)

    await persistMessages(sessionId, message, reply)
    await logAIActivity({
      userId,
      action: action || "assistant_reply",
      aiUsed: true,
    })

    return NextResponse.json({
      reply,
      action,
      metadata: {
        ...(metadata || {}),
        confidence: qualityScore,
        validation,
        transparencyNote: CLIENT_TRANSPARENCY_NOTE,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI request failed" },
      { status: 500 }
    )
  }
}
