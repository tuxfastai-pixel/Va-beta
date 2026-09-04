import { NextRequest, NextResponse } from "next/server"
import mammoth from "mammoth"
import { getSessionUser } from "@/lib/auth/sessionUser"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_FILE_BYTES = 5 * 1024 * 1024

function extensionOf(fileName: string) {
  const index = fileName.lastIndexOf(".")
  return index === -1
    ? ""
    : fileName.slice(index).toLowerCase()
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser()
    if (!session?.userId) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const candidate = formData.get("file")

    if (!(candidate instanceof File)) {
      return NextResponse.json(
        { error: "Select a DOCX or TXT file." },
        { status: 400 }
      )
    }

    if (candidate.size === 0) {
      return NextResponse.json(
        { error: "The selected file is empty." },
        { status: 400 }
      )
    }

    if (candidate.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "The selected file exceeds the 5 MB limit." },
        { status: 413 }
      )
    }

    const extension = extensionOf(candidate.name)

    if (![".docx", ".txt"].includes(extension)) {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Upload DOCX or TXT. PDF extraction is not enabled yet.",
        },
        { status: 415 }
      )
    }

    const buffer =
      Buffer.from(await candidate.arrayBuffer())

    let text = ""

    if (extension === ".txt") {
      text = buffer.toString("utf8")
    } else {
      const result = await mammoth.extractRawText({
        buffer,
      })
      text = result.value
    }

    text = text.replace(/\u0000/g, "").trim()

    if (!text) {
      return NextResponse.json(
        {
          error:
            "No readable CV text was found in the selected document.",
        },
        { status: 422 }
      )
    }

    return NextResponse.json({
      success: true,
      fileName: candidate.name,
      text,
      textLength: text.length,
    })
  } catch (error) {
    console.error("cv-extract error:", error)
    return NextResponse.json(
      {
        error:
          "The document could not be read. Confirm that it is a valid DOCX or TXT file.",
      },
      { status: 500 }
    )
  }
}