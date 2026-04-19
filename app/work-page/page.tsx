"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

type CareerFormData = {
  currentRole: string
  yearsExperience: string
  targetRole: string
  targetSalary: string
  skills: string
}

function WorkPageContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session")

  const [step, setStep] = useState<number>(1)

  const [formData, setFormData] = useState<CareerFormData>({
    currentRole: "",
    yearsExperience: "",
    targetRole: "",
    targetSalary: "",
    skills: ""
  })

  const nextStep = () => setStep((prev) => prev + 1)
  const prevStep = () => setStep((prev) => prev - 1)

  const saveProgress = async (updatedData: CareerFormData) => {
    if (!sessionId) return

    await supabase
      .from("sessions")
      .update({ form_data: updatedData })
      .eq("id", sessionId)
  }

  const updateField = (field: keyof CareerFormData, value: string) => {
    const updated = { ...formData, [field]: value }
    setFormData(updated)
    saveProgress(updated)
  }

  useEffect(() => {
    if (!sessionId) return

    const loadSession = async () => {
      const { data } = await supabase
        .from("sessions")
        .select("form_data")
        .eq("id", sessionId)
        .single()

      if (data?.form_data) {
        setFormData(data.form_data)
      }
    }

    loadSession()
  }, [sessionId])

  if (!sessionId) {
    return <p style={{ padding: 40 }}>No session selected.</p>
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Career Plan Workflow</h1>
      <p>Session ID: {sessionId}</p>

      {step === 1 && (
        <StepOne
          data={formData}
          updateField={updateField}
          nextStep={nextStep}
        />
      )}

      {step === 2 && (
        <StepTwo
          data={formData}
          updateField={updateField}
          nextStep={nextStep}
          prevStep={prevStep}
        />
      )}

      {step === 3 && (
        <FinalStep
          data={formData}
          sessionId={sessionId}
          prevStep={prevStep}
        />
      )}
    </div>
  )
}

export default function WorkPage() {
  return (
    <Suspense fallback={<p style={{ padding: 40 }}>Loading workflow...</p>}>
      <WorkPageContent />
    </Suspense>
  )
}

type StepProps = {
  data: CareerFormData
  updateField?: (field: keyof CareerFormData, value: string) => void
  nextStep?: () => void
  prevStep?: () => void
  sessionId?: string | null
}

function StepOne({ data, updateField, nextStep }: StepProps) {
  return (
    <div>
      <h2>Step 1 — Current Position</h2>

      <input
        placeholder="Current Role"
        value={data.currentRole}
        onChange={(e) => updateField?.("currentRole", e.target.value)}
      />

      <input
        placeholder="Years Experience"
        value={data.yearsExperience}
        onChange={(e) => updateField?.("yearsExperience", e.target.value)}
      />

      <button onClick={nextStep}>Next</button>
    </div>
  )
}

function StepTwo({ data, updateField, nextStep, prevStep }: StepProps) {
  return (
    <div>
      <h2>Step 2 — Career Goals</h2>

      <input
        placeholder="Target Role"
        value={data.targetRole}
        onChange={(e) => updateField?.("targetRole", e.target.value)}
      />

      <input
        placeholder="Target Salary"
        value={data.targetSalary}
        onChange={(e) => updateField?.("targetSalary", e.target.value)}
      />

      <button onClick={prevStep}>Back</button>
      <button onClick={nextStep}>Next</button>
    </div>
  )
}

function FinalStep({ data, sessionId, prevStep }: StepProps) {
  const runAI = async () => {
    const aiOutput = JSON.stringify(data)

    const { error } = await supabase.from("evaluations").insert({
      session_id: sessionId,
      score: 85,
      feedback: aiOutput
    })

    await supabase
      .from("sessions")
      .update({
        ai_result: aiOutput,
        status: "completed"
      })
      .eq("id", sessionId)

    if (error) {
      alert("AI evaluation failed")
    } else {
      alert("AI evaluation stored successfully")
    }
  }

  return (
    <div>
      <h2>Step 3 — Review & Generate Plan</h2>

      <pre>{JSON.stringify(data, null, 2)}</pre>

      <button onClick={prevStep}>Back</button>
      <button onClick={runAI}>Generate Career Plan</button>
    </div>
  )
}
