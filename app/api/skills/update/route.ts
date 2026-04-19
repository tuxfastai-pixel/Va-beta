import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const { skill } = await req.json()

  const questions = [
    {
      question: `What is the primary purpose of ${skill}?`,
      options: ["A", "B", "C"]
    }
  ]

  return NextResponse.json(questions)
}
