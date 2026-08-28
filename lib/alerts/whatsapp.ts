type WhatsAppResult = {
  success: boolean;
  reason?: string;
};

export async function sendWhatsApp(message: string): Promise<WhatsAppResult> {
  const sid = process.env.TWILIO_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
  const to = process.env.TWILIO_WHATSAPP_TO;

  if (!sid || !authToken || !to) {
    return { success: false, reason: "Missing Twilio WhatsApp configuration" };
  }

  try {
    const dynamicImport = new Function("name", "return import(name);") as (name: string) => Promise<unknown>;
    const mod = await dynamicImport("twilio").catch(() => null) as { default?: (sidArg: string, tokenArg: string) => { messages: { create: (payload: Record<string, unknown>) => Promise<unknown> } } } | null;

    if (!mod?.default) {
      return { success: false, reason: "twilio package not installed" };
    }

    const client = mod.default(sid, authToken);
    await client.messages.create({
      body: message,
      from,
      to,
    });

    return { success: true };
  } catch (error) {
    return { success: false, reason: error instanceof Error ? error.message : "Unknown error" };
  }
}