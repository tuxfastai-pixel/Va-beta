import type { NormalizedResume, ParsedResume } from "./careerTypes.ts"

const KEYWORD_MAP: Array<{ keyword: string; signal: string }> = [
  { keyword: "excel", signal: "productivity software" },
  { keyword: "customer", signal: "customer support" },
  { keyword: "support", signal: "support operations" },
  { keyword: "teacher", signal: "training and instruction" },
  { keyword: "teach", signal: "training and instruction" },
  { keyword: "write", signal: "written communication" },
  { keyword: "admin", signal: "administrative coordination" },
  { keyword: "data", signal: "data handling" },
  { keyword: "computer", signal: "digital literacy" },
  { keyword: "crm", signal: "client systems coordination" },
  { keyword: "sales", signal: "sales support" },
  { keyword: "language", signal: "language communication" },
  { keyword: "remote", signal: "remote collaboration" },
  { keyword: "team", signal: "team coordination" },
  { keyword: "lead", signal: "leadership" },
]

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim()
}

function toBulletPoints(lines: string[]): string[] {
  return lines
    .map((line) => line.replace(/^[-*•\d.\)\s]+/, "").trim())
    .filter((line) => line.length > 18)
    .slice(0, 12)
}

export function normalizeResume(parsed: ParsedResume): NormalizedResume {
  const clean = cleanText(parsed.rawText)
  const bulletPoints = toBulletPoints(parsed.lines)
  const keywordHints = parsed.keywords.slice(0, 20)
  const skillSignals = Array.from(
    new Set(
      parsed.keywords.flatMap((keyword) =>
        KEYWORD_MAP.filter((item) => keyword.includes(item.keyword)).map((item) => item.signal),
      ),
    ),
  )
  const experienceSignals = bulletPoints.slice(0, 8)

  const confidence = Math.max(parsed.confidence, skillSignals.length > 0 ? 0.65 : 0.35)

  return {
    cleanText: clean,
    bulletPoints,
    keywordHints,
    skillSignals,
    experienceSignals,
    confidence,
  }
}
