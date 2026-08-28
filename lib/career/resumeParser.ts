import type { ParsedResume } from "./careerTypes.ts"

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(1, value))
}

function detectSourceType(fileName: string | null, mimeType?: string | null): ParsedResume["sourceType"] {
  const lowerName = String(fileName || "").toLowerCase()
  const lowerMime = String(mimeType || "").toLowerCase()

  if (lowerName.endsWith(".pdf") || lowerMime.includes("pdf")) {
    return "pdf"
  }

  if (lowerName.endsWith(".docx") || lowerMime.includes("word") || lowerMime.includes("document")) {
    return "docx"
  }

  if (lowerName.match(/\.(png|jpg|jpeg|webp|gif|bmp)$/) || lowerMime.startsWith("image/")) {
    return "image"
  }

  if (lowerName.endsWith(".txt") || lowerMime.includes("text")) {
    return "txt"
  }

  return "unknown"
}

function decodeBytes(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(view)
  return decoded.replace(/\0/g, " ")
}

function extractKeywords(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .match(/[a-z][a-z0-9+.-]{1,}/g) ?? []

  const interesting = tokens.filter((token) => token.length > 3 && !["this", "that", "with", "from", "your", "have", "will", "into"].includes(token))
  return Array.from(new Set(interesting)).slice(0, 50)
}

export function parseResumeInput(input: {
  text?: string | null
  bytes?: ArrayBuffer | Uint8Array | null
  fileName?: string | null
  mimeType?: string | null
}): ParsedResume {
  const sourceType = detectSourceType(input.fileName ?? null, input.mimeType ?? null)
  const rawText = String(input.text || (input.bytes ? decodeBytes(input.bytes) : "")).replace(/\r/g, "")
  const lines = rawText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  const keywords = extractKeywords(rawText)
  const warnings: string[] = []

  if (!rawText.trim()) {
    warnings.push("No readable text detected in resume input")
  }

  if (sourceType === "image") {
    warnings.push("Image uploads need OCR for full extraction; using any embedded text only")
  }

  const confidence = clamp01(
    rawText.trim().length > 0 ? 0.55 + Math.min(0.35, rawText.length / 2000) : 0.15,
  )

  return {
    sourceType,
    fileName: input.fileName ?? null,
    rawText,
    lines,
    keywords,
    confidence,
    warnings,
  }
}
