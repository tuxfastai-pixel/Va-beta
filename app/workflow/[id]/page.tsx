"use client"

import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { extractVisiblePlan } from "@/lib/platforms/profileSync"

type WorkflowMessage = {
  id?: string
  role: "user" | "assistant"
  content: string
}

export default function WorkflowPage() {
  const params = useParams()
  const sessionId = params?.id as string
  const PLAN_LIMITS: Record<string, number> = {
    free: 50000,
    pro: 500000,
    enterprise: 5000000
  }

  const [messages, setMessages] = useState<WorkflowMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [usage, setUsage] = useState(0)
  const [userId, setUserId] = useState<string>("")
  const [userPlan, setUserPlan] = useState<"free" | "pro" | "enterprise">("free")

  const fetchUsage = async (uid: string) => {
    const res = await fetch("/api/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: uid })
    })

    const data = await res.json() as { tokensUsed?: number }
    setUsage(Number(data.tokensUsed || 0))
  }

  useEffect(() => {
    if (!sessionId) return

    const loadMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, role, content")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })

      if (data) setMessages(data as WorkflowMessage[])
    }

    void loadMessages()
  }, [sessionId])

  useEffect(() => {
    const loadUserContext = async () => {
      const { data: authData } = await supabase.auth.getUser()
      const currentUserId = authData.user?.id

      if (!currentUserId) return

      setUserId(currentUserId)

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", currentUserId)
        .maybeSingle()

      const planValue = extractVisiblePlan(typeof profile?.plan === "string" ? profile.plan : null)
      if (planValue === "pro" || planValue === "enterprise" || planValue === "free") {
        setUserPlan(planValue)
      }
    }

    void loadUserContext()
  }, [])

  useEffect(() => {
    if (!userId) return

    void fetchUsage(userId)
  }, [userId])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    setLoading(true)
    const userText = input.trim()

    setMessages((prev) => [
      ...prev,
      { role: "user", content: userText }
    ])

    setInput("")

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: userText,
          userId
        })
      })

      if (!res.ok) {
        throw new Error("AI request failed")
      }

      const data = await res.json() as { reply?: string }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || "No reply generated." }
      ])

      await fetch("/api/memory/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          message: data.reply || "No reply generated."
        })
      })

    } catch (err) {
      console.error("AI error:", err)

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Something went wrong." }
      ])
    }

    setLoading(false)

    void fetchUsage(userId)
  }

  return (
    <div style={{ padding: 40 }}>
      <h2>Session</h2>

      <div style={{ marginBottom: 20 }}>
        {messages.map((msg, i) => (
          <div key={msg.id ?? `${msg.role}-${i}`}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
      </div>

      <div>
        Tokens used this month: {usage}
      </div>

      <div>
        {usage} / {PLAN_LIMITS[userPlan]} tokens used
      </div>

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type a message..."
      />

      <button
        onClick={sendMessage}
        disabled={loading}
      >
        Send
      </button>
    </div>
  )
}
