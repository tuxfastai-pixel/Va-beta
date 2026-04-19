import { NextRequest, NextResponse } from "next/server";
import { handleVoiceCommand, handleVoiceCommandModeSwitch } from "@/lib/voice/assistant";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const command = String(body?.command || "").trim();
    const userId = String(body?.userId || body?.user_id || "").trim();

    if (!command) {
      return NextResponse.json({ error: "command is required" }, { status: 400 });
    }

    if (userId) {
      const modeSwitch = await handleVoiceCommandModeSwitch(command, userId);
      if (modeSwitch.changed) {
        return NextResponse.json(modeSwitch);
      }
    }

    const result = handleVoiceCommand(command);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid request",
      },
      { status: 400 }
    );
  }
}
