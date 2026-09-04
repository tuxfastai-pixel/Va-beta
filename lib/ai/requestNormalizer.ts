export type NormalizedChatMessage = {
  role: "system" | "user" | "assistant" | "developer"
  content: string
}

type NormalizeOptions = {
  maxMessages?: number
  maxContentLength?: number
}

const DEFAULTS: Required<NormalizeOptions> = {
  maxMessages: 40,
  maxContentLength: 8000,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function normalizeRole(value: unknown): NormalizedChatMessage["role"] | null {
  if (typeof value !== "string") {
    return null
  }

  if (value === "system" || value === "user" || value === "assistant" || value === "developer") {
    return value
  }

  return null
}

function readContent(value: unknown): string {
  if (typeof value === "string") {
    return value
  }

  if (Array.isArray(value)) {
    const chunks: string[] = []
    for (const item of value) {
      if (!isRecord(item)) {
        continue
      }

      const text = item.text
      if (typeof text === "string") {
        chunks.push(text)
      }
    }
    return chunks.join("\n").trim()
  }

  return ""
}

export function normalizeMessages(messages: unknown, options: NormalizeOptions = {}): NormalizedChatMessage[] {
  if (!Array.isArray(messages)) {
    return []
  }

  const maxMessages = options.maxMessages ?? DEFAULTS.maxMessages
  const maxContentLength = options.maxContentLength ?? DEFAULTS.maxContentLength

  const normalized: NormalizedChatMessage[] = []

  for (const entry of messages) {
    if (!isRecord(entry)) {
      continue
    }

    const role = normalizeRole(entry.role)
    if (!role) {
      continue
    }

    const content = readContent(entry.content)
    if (!content) {
      continue
    }

    normalized.push({
      role,
      content: content.slice(0, maxContentLength),
    })
  }

  if (normalized.length <= maxMessages) {
    return normalized
  }

  return normalized.slice(normalized.length - maxMessages)
}
