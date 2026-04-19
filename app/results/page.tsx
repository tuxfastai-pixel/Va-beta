"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

type Session = {
  id: string
  title: string
  status: string
  ai_result: unknown
  created_at: string
}

function ResultsPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get("session")
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!sessionId) {
      return
    }

    const loadSession = async () => {
      setLoading(true)
      const { data } = await supabase
        .from("sessions")
        .select("id, title, status, ai_result, created_at")
        .eq("id", sessionId)
        .single()

      if (data) setSession(data as Session)
      setLoading(false)
    }

    void loadSession()
  }, [sessionId])

  if (!sessionId) return <p style={{ padding: 40 }}>Session not found.</p>

  if (loading) return <p style={{ padding: 40 }}>Loading results...</p>

  if (!session) return <p style={{ padding: 40 }}>Session not found.</p>

  return (
    <div style={{ padding: 40 }}>
      <h1>{session.title || "Session Results"}</h1>
      <p>
        Status: {session.status} <br />
        Created: {new Date(session.created_at).toLocaleString()}
      </p>

      <hr style={{ margin: "20px 0" }} />

      <h2>AI Evaluation</h2>

      <pre
        style={{
          background: "#f5f5f5",
          padding: 20,
          borderRadius: 8,
          whiteSpace: "pre-wrap"
        }}
      >
        {JSON.stringify(session.ai_result, null, 2)}
      </pre>

      <div style={{ marginTop: 30 }}>
        <button onClick={() => router.push("/dashboard")}>
          Back to Dashboard
        </button>

        <button
          onClick={() => router.push(`/work-page?session=${session.id}`)}
          style={{ marginLeft: 10 }}
        >
          Reopen Session
        </button>
      </div>
    </div>
  )
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<p style={{ padding: 40 }}>Loading results...</p>}>
      <ResultsPageContent />
    </Suspense>
  )
}
