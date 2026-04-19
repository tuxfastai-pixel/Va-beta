type EmailReminderInput = {
  to: string;
  subject?: string;
  text: string;
};

type WhatsAppReminderInput = {
  to: string;
  text: string;
};

export async function sendEmailReminder(input: EmailReminderInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "noreply@example.com";

  if (!apiKey) {
    return { sent: false, reason: "RESEND_API_KEY is not configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject || "Payment Reminder",
      text: input.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend reminder failed: ${body}`);
  }

  return { sent: true };
}

export async function sendWhatsAppReminder(input: WhatsAppReminderInput) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    return { sent: false, reason: "Twilio WhatsApp credentials are not configured" };
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const encoded = new URLSearchParams({
    To: `whatsapp:${input.to}`,
    From: `whatsapp:${from}`,
    Body: input.text,
  });

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encoded,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Twilio reminder failed: ${body}`);
  }

  return { sent: true };
}
