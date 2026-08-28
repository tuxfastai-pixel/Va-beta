import type OpenAI from "openai";
import { normalizeMessages, type NormalizedChatMessage } from "./requestNormalizer.ts";

type Primitive = string | number | boolean | null;
type Telemetry = Record<string, Primitive>;

type ExecuteModelRequestInput = {
  model: string;
  messages: unknown;
  retries?: number;
  maxMessages?: number;
  maxContentLength?: number;
  maxTotalChars?: number;
  telemetry?: unknown;
  request?: Record<string, unknown>;
};

type ExecuteEmbeddingRequestInput = {
  model: string;
  input: string | string[];
  retries?: number;
  telemetry?: unknown;
  request?: Record<string, unknown>;
};

type ExecuteTranscriptionRequestInput = {
  file: File;
  model: string;
  retries?: number;
  telemetry?: unknown;
  request?: Record<string, unknown>;
};

type ExecuteSpeechRequestInput = {
  model: string;
  voice: string;
  input: string;
  retries?: number;
  telemetry?: unknown;
  request?: Record<string, unknown>;
};

const DEFAULT_RETRIES = 2;
const DEFAULT_MAX_TOTAL_CHARS = 24000;
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);

let sharedClient: OpenAI | null = null;

async function getClient(): Promise<OpenAI> {
  if (sharedClient) {
    return sharedClient;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const { default: OpenAIClient } = await import("openai");
  sharedClient = new OpenAIClient({ apiKey });
  return sharedClient;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeTelemetry(input: unknown): Telemetry | undefined {
  if (!isRecord(input)) {
    return undefined;
  }

  const safe: Telemetry = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      safe[key] = value;
    }
  }

  return Object.keys(safe).length > 0 ? safe : undefined;
}

function sanitizeTools(input: unknown): unknown[] | undefined {
  if (!Array.isArray(input)) {
    return undefined;
  }

  const sanitized: Record<string, unknown>[] = [];

  for (const item of input) {
    if (!isRecord(item) || item.type !== "function" || !isRecord(item.function)) {
      continue;
    }

    const fn = item.function as Record<string, unknown>;
      const name = typeof fn.name === "string" ? fn.name : "";
      if (!name) {
        continue;
      }

      const nextFn: Record<string, unknown> = { name };
      if (typeof fn.description === "string") {
        nextFn.description = fn.description;
      }
      if (isRecord(fn.parameters) || Array.isArray(fn.parameters)) {
        nextFn.parameters = fn.parameters;
      }

      sanitized.push({
        type: "function",
        function: nextFn,
      });
  }

  return sanitized.length > 0 ? sanitized : undefined;
}

function trimByTotalChars(messages: NormalizedChatMessage[], maxTotalChars: number): NormalizedChatMessage[] {
  let total = 0;
  const trimmed: NormalizedChatMessage[] = [];

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const entry = messages[i];
    total += entry.content.length;
    if (trimmed.length > 0 && total > maxTotalChars) {
      break;
    }
    trimmed.push(entry);
  }

  return trimmed.reverse();
}

function isRetryableError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }

  const status = Number(error.status);
  if (Number.isFinite(status) && RETRYABLE_STATUS.has(status)) {
    return true;
  }

  const code = typeof error.code === "string" ? error.code : "";
  return code === "rate_limit_exceeded" || code === "ETIMEDOUT" || code === "ECONNRESET";
}

async function withRetries<T>(run: () => Promise<T>, retries = DEFAULT_RETRIES): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= retries || !isRetryableError(error)) {
        throw error;
      }
      const delayMs = 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      attempt += 1;
    }
  }
}

export function buildModelPayload(input: ExecuteModelRequestInput): Record<string, unknown> {
  const telemetry = normalizeTelemetry(input.telemetry);
  const request = isRecord(input.request) ? { ...input.request } : {};

  const normalizedMessages = normalizeMessages(input.messages, {
    maxMessages: input.maxMessages,
    maxContentLength: input.maxContentLength,
  });

  if (normalizedMessages.length === 0) {
    throw new Error("Message contract violation: at least one valid user/developer/system/assistant message is required");
  }

  const maxTotalChars = input.maxTotalChars ?? DEFAULT_MAX_TOTAL_CHARS;
  const messages = trimByTotalChars(normalizedMessages, maxTotalChars);

  const tools = sanitizeTools(request.tools);
  if ("tools" in request) {
    delete request.tools;
  }

  const payload: Record<string, unknown> = {
    ...request,
    model: input.model,
    messages,
  };

  if (tools) {
    payload.tools = tools;
  }

  if (telemetry) {
    payload.metadata = {
      ...(isRecord(payload.metadata) ? payload.metadata : {}),
      ...telemetry,
    };
  }

  return payload;
}

export async function executeModelRequest(input: ExecuteModelRequestInput) {
  const payload = buildModelPayload(input);
  return withRetries(async () => {
    const client = await getClient();
    return client.chat.completions.create(payload as never);
  }, input.retries);
}

export function extractTextFromCompletion(completion: unknown): string {
  if (!isRecord(completion) || !Array.isArray(completion.choices) || completion.choices.length === 0) {
    return "";
  }

  const first = completion.choices[0];
  if (!isRecord(first) || !isRecord(first.message)) {
    return "";
  }

  const content = first.message.content;
  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  const text = content
    .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();

  return text;
}

export async function executeEmbeddingRequest(input: ExecuteEmbeddingRequestInput) {
  const telemetry = normalizeTelemetry(input.telemetry);
  const request = isRecord(input.request) ? { ...input.request } : {};

  const payload: Record<string, unknown> = {
    ...request,
    model: input.model,
    input: input.input,
  };

  if (telemetry) {
    payload.user = String(telemetry.userId ?? telemetry.user_id ?? "").slice(0, 128) || undefined;
  }

  return withRetries(async () => {
    const client = await getClient();
    return client.embeddings.create(payload as never);
  }, input.retries);
}

export async function executeTranscriptionRequest(input: ExecuteTranscriptionRequestInput) {
  const request = isRecord(input.request) ? { ...input.request } : {};

  const payload: Record<string, unknown> = {
    ...request,
    file: input.file,
    model: input.model,
  };

  return withRetries(async () => {
    const client = await getClient();
    return client.audio.transcriptions.create(payload as never);
  }, input.retries);
}

export async function executeSpeechRequest(input: ExecuteSpeechRequestInput) {
  const request = isRecord(input.request) ? { ...input.request } : {};

  const payload: Record<string, unknown> = {
    ...request,
    model: input.model,
    voice: input.voice,
    input: input.input,
  };

  return withRetries(async () => {
    const client = await getClient();
    return client.audio.speech.create(payload as never);
  }, input.retries);
}
