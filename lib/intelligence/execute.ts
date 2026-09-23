import {
  executeModelRequest,
} from "@/lib/ai/executeModelRequest"
import {
  intelligenceSystemContract,
  INTELLIGENCE_VERSION,
  type IntelligenceDomain,
} from "@/lib/intelligence/core"

type ModelRequestInput =
  Parameters<typeof executeModelRequest>[0]

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function withIntelligenceContract(
  messages: unknown,
  domain: IntelligenceDomain
): unknown[] {
  const entries = Array.isArray(messages)
    ? messages
    : []

  const contract =
    intelligenceSystemContract(domain)

  if (
    entries.length > 0 &&
    isRecord(entries[0]) &&
    entries[0].role === "system"
  ) {
    return [
      {
        ...entries[0],
        content: [
          contract,
          String(entries[0].content || ""),
        ]
          .filter(Boolean)
          .join("\n"),
      },
      ...entries.slice(1),
    ]
  }

  return [
    {
      role: "system",
      content: contract,
    },
    ...entries,
  ]
}

export async function executeIntelligenceRequest(
  domain: IntelligenceDomain,
  input: ModelRequestInput
) {
  return executeModelRequest({
    ...input,
    messages:
      withIntelligenceContract(
        input.messages,
        domain
      ),
    telemetry: {
      ...(isRecord(input.telemetry)
        ? input.telemetry
        : {}),
      intelligenceDomain: domain,
      intelligenceVersion:
        INTELLIGENCE_VERSION,
    },
  })
}
