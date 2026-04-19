export type VoiceAction = "fetch_jobs" | "auto_apply" | "reply_client" | "check_earnings" | "unknown";

import { setUserMode } from "@/lib/mode/modeManager";

async function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const { default: OpenAI } = await import("openai");
  return new OpenAI({ apiKey });
}

export function handleVoiceCommand(text: string): { action: VoiceAction; message: string } {
  const command = String(text || "").toLowerCase();

  if (command.includes("find jobs") || command.includes("fetch jobs")) {
    return { action: "fetch_jobs", message: "Opening jobs now." };
  }

  if (command.includes("apply") || command.includes("apply to everything")) {
    return { action: "auto_apply", message: "Starting one-click auto apply." };
  }

  if (command.includes("reply") || command.includes("client")) {
    return { action: "reply_client", message: "Opening client reply assistant." };
  }

  if (command.includes("earnings") || command.includes("income")) {
    return { action: "check_earnings", message: "Opening earnings tracker." };
  }

  return {
    action: "unknown",
    message: "I heard you, but I need a clearer command like find jobs or apply to everything.",
  };
}

export async function handleVoiceCommandModeSwitch(text: string, userId: string) {
  const t = String(text || "").toLowerCase();

  if (t.includes("autonomous mode on") || t.includes("work for me")) {
    await setUserMode(userId, "autonomous");
    return {
      changed: true,
      mode: "autonomous" as const,
      reply:
        "Autonomous mode is now active. I will apply to jobs, send follow-ups, and respond to clients. You can stop this anytime by saying stop autonomous mode.",
      action: "mode_switch",
    };
  }

  if (t.includes("stop autonomous") || t.includes("manual mode")) {
    await setUserMode(userId, "assist");
    return {
      changed: true,
      mode: "assist" as const,
      reply: "Autonomous mode turned off. I will guide you instead and wait for your instructions.",
      action: "mode_switch",
    };
  }

  return { changed: false } as const;
}

export async function transcribeWithWhisper(audioFile: File): Promise<string> {
  const client = await getOpenAIClient();
  if (!client) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const transcription = await client.audio.transcriptions.create({
    file: audioFile,
    model: "gpt-4o-mini-transcribe",
  });

  return transcription.text || "";
}

export async function synthesizeVoiceResponse(text: string): Promise<ArrayBuffer | null> {
  const client = await getOpenAIClient();
  if (!client) {
    return null;
  }

  const response = await client.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: "alloy",
    input: text,
  });

  return response.arrayBuffer();
}
