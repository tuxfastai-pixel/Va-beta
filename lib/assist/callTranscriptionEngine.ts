import { transcribeWithWhisper } from "@/lib/voice/assistant";

export async function runCallTranscriptionEngine(audioFile: File) {
  const transcript = await transcribeWithWhisper(audioFile);
  const lines = transcript.split(/[.!?]/).map((line) => line.trim()).filter(Boolean);

  return {
    transcript,
    summary: lines.slice(0, 4).join(". "),
    followUps: [
      "Send recap with agreed actions.",
      "Confirm timeline and owner for next step.",
      "Track unresolved risk in follow-up note.",
    ],
    extractedActions: lines.filter((line) => /will|next|by\s+\w+/i.test(line)).slice(0, 8),
  };
}
