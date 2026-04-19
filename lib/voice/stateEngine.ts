export type ConversationState = {
  intent?: string;
  step?: string;
  filters?: {
    category?: string | null;
    pay?: "high" | null;
  };
};

export function resetState(): ConversationState {
  return {};
}

function detectRequestedCategory(text: string): string | null {
  const categories = [
    "teaching",
    "admin",
    "assistant",
    "developer",
    "engineering",
    "legal",
    "compliance",
    "finance",
    "bookkeeping",
    "crm",
    "sales",
  ];

  return categories.find((category) => text.includes(category)) ?? null;
}

export function updateState(prevState: ConversationState, input: string): ConversationState {
  const text = String(input || "").toLowerCase();

  if (text.includes("find") && text.includes("job")) {
    return {
      intent: "job_search",
      step: "awaiting_confirmation",
      filters: {
        category: detectRequestedCategory(text),
        pay: text.includes("high") ? "high" : null,
      },
    };
  }

  if (prevState?.step === "awaiting_confirmation") {
    const highPayRequested = text.includes("high") || text.includes("above $20") || text.includes("$20");

    if (text.includes("yes") || text.includes("go ahead") || text.includes("do it")) {
      return {
        ...prevState,
        step: "confirmed",
        filters: {
          ...(prevState.filters || {}),
          pay: highPayRequested ? "high" : prevState.filters?.pay || null,
        },
      };
    }

    if (highPayRequested) {
      return {
        ...prevState,
        filters: {
          ...(prevState.filters || {}),
          pay: "high",
        },
      };
    }
  }

  return prevState;
}