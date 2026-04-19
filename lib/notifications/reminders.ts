type ReminderChannel = "email" | "whatsapp";

type ReminderRecipient = {
  email?: string;
  phone?: string;
  name?: string;
};

type ReminderMessage = {
  subject?: string;
  text: string;
};

type ReminderResult = {
  ok: boolean;
  channel: ReminderChannel;
  skipped?: boolean;
  provider?: string;
  error?: string;
};

async function postJson(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

export async function sendEmailReminder(recipient: ReminderRecipient, message: ReminderMessage): Promise<ReminderResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from || !recipient.email) {
    return {
      ok: false,
      channel: "email",
      skipped: true,
      provider: "resend",
      error: "Resend is not configured or recipient email is missing.",
    };
  }

  const response = await postJson("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [recipient.email],
      subject: message.subject || "Payment Reminder",
      text: message.text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      ok: false,
      channel: "email",
      provider: "resend",
      error: errorText || "Failed to send email reminder.",
    };
  }

  return {
    ok: true,
    channel: "email",
    provider: "resend",
  };
}

export async function sendWhatsAppReminder(
  recipient: ReminderRecipient,
  message: ReminderMessage
): Promise<ReminderResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from || !recipient.phone) {
    return {
      ok: false,
      channel: "whatsapp",
      skipped: true,
      provider: "twilio",
      error: "Twilio WhatsApp is not configured or recipient phone is missing.",
    };
  }

  const body = new URLSearchParams({
    To: recipient.phone.startsWith("whatsapp:") ? recipient.phone : `whatsapp:${recipient.phone}`,
    From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
    Body: message.text,
  });

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      ok: false,
      channel: "whatsapp",
      provider: "twilio",
      error: errorText || "Failed to send WhatsApp reminder.",
    };
  }

  return {
    ok: true,
    channel: "whatsapp",
    provider: "twilio",
  };
}

export async function sendPaymentReminder(recipient: ReminderRecipient, paymentLink: string): Promise<ReminderResult[]> {
  const text = `Please complete your payment here: ${paymentLink}`;

  return Promise.all([
    sendEmailReminder(recipient, {
      subject: "Payment Reminder",
      text,
    }),
    sendWhatsAppReminder(recipient, {
      text,
    }),
  ]);
}