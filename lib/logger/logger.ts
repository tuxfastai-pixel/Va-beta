/**
 * Structured JSON logger with severity levels and Sentry integration.
 * Drop-in replacement for console.log across the entire codebase.
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;       // e.g. "orchestrator", "autoApply", "agent:LeadHunter"
  data?: Record<string, unknown>;
  error?: string;
  timestamp?: string;
  traceId?: string;
}

interface OptionalSentryModule {
  init(options: {
    dsn: string;
    environment: string;
  }): void;
  captureMessage(
    message: string,
    context: {
      level: "error" | "fatal";
      extra: Record<string, unknown>;
      tags: Record<string, string>;
    }
  ): void;
}
// Lazily initialise Sentry to avoid breaking builds when SDK is absent
let sentryInitialized = false;
async function getSentry(): Promise<OptionalSentryModule | null> {
  if (!process.env.SENTRY_DSN) return null;
  try {
    const dynamicImport = new Function("moduleName", "return import(moduleName);") as (moduleName: string) => Promise<OptionalSentryModule>;
    const Sentry = await dynamicImport("@sentry/nextjs");
    if (!sentryInitialized) {
      Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV ?? "production" });
      sentryInitialized = true;
    }
    return Sentry;
  } catch {
    return null;
  }
}

function serialize(entry: LogEntry): string {
  return JSON.stringify({
    ts:      entry.timestamp ?? new Date().toISOString(),
    level:   entry.level,
    ctx:     entry.context ?? "app",
    msg:     entry.message,
    data:    entry.data,
    error:   entry.error,
    traceId: entry.traceId,
  });
}

function levelToConsole(level: LogLevel) {
  switch (level) {
    case "debug": return console.debug;
    case "info":  return console.info;
    case "warn":  return console.warn;
    case "error":
    case "fatal": return console.error;
    default:      return console.log;
  }
}

async function emit(entry: LogEntry) {
  const line = serialize(entry);
  levelToConsole(entry.level)(line);

  // Send errors + fatals to Sentry
  if (entry.level === "error" || entry.level === "fatal") {
    const Sentry = await getSentry();
    if (Sentry) {
      Sentry.captureMessage(entry.message, {
        level: entry.level === "fatal" ? "fatal" : "error",
        extra: { ...entry.data, rawError: entry.error },
        tags:  { context: entry.context ?? "app" },
      });
    }
  }
}

/**
 * Structured logger instance.
 */
export const logger = {
  debug(message: string, data?: Record<string, unknown>, context?: string) {
    void emit({ level: "debug", message, data, context });
  },
  info(message: string, data?: Record<string, unknown>, context?: string) {
    void emit({ level: "info", message, data, context });
  },
  warn(message: string, data?: Record<string, unknown>, context?: string) {
    void emit({ level: "warn", message, data, context });
  },
  error(message: string, error?: unknown, data?: Record<string, unknown>, context?: string) {
    const errorStr = error instanceof Error
      ? `${error.message}\n${error.stack ?? ""}`
      : String(error ?? "");
    void emit({ level: "error", message, error: errorStr, data, context });
  },
  fatal(message: string, error?: unknown, data?: Record<string, unknown>, context?: string) {
    const errorStr = error instanceof Error
      ? `${error.message}\n${error.stack ?? ""}`
      : String(error ?? "");
    void emit({ level: "fatal", message, error: errorStr, data, context });
  },
};

/** Helper to generate a simple per-request trace ID. */
export function newTraceId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
