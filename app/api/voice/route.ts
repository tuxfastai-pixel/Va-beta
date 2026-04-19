import { NextRequest, NextResponse } from "next/server";
import { transcribeWithWhisper } from "@/lib/voice/assistant";
import { runConversation } from "@/lib/voice/conversationEngine";
import { generateSpeech } from "@/lib/voice/tts";

function normalizeUserId(input: string): string {
  const value = input.trim();
  return value || "00000000-0000-4000-a000-000000000001";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const userIdRaw = String(formData.get("userId") || formData.get("user_id") || "");
    const userId = normalizeUserId(userIdRaw);

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const text = await transcribeWithWhisper(file);
    const conversation = await runConversation({
      userId,
      input: text,
    });
    const audio = await generateSpeech(conversation.reply);

    let ttsBase64: string | null = null;
    if (audio) {
      ttsBase64 = Buffer.from(audio).toString("base64");
    }

    return NextResponse.json({
      text,
      action: conversation.action,
      reply: conversation.reply,
      metadata: conversation.metadata || {},
      ttsBase64,
      ttsMimeType: "audio/mpeg",
      audio: ttsBase64,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Voice processing failed",
      },
      { status: 500 }
    );
  }
}