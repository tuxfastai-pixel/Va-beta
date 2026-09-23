type MailResult = {
  success: boolean;
  reason?: string;
};

export async function sendEmailAlert(subject: string, content: string): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL_TO;
  const from = process.env.ALERT_EMAIL_FROM || "alerts@yourdomain.com";

  if (!apiKey || !to) {
    return { success: false, reason: "Missing RESEND_API_KEY or ALERT_EMAIL_TO" };
  }

  try {
    const dynamicImport = new Function("name", "return import(name);") as (name: string) => Promise<unknown>;
    const mod = await dynamicImport("resend").catch(() => null) as { Resend?: new (key: string) => { emails: { send: (input: Record<string, unknown>) => Promise<unknown> } } } | null;

    if (!mod?.Resend) {
      return { success: false, reason: "resend package not installed" };
    }

    const resend = new mod.Resend(apiKey);
    await resend.emails.send({
      from,
      to,
      subject,
      html: content.replace(/\n/g, "<br />"),
    });

    return { success: true };
  } catch (error) {
    return { success: false, reason: error instanceof Error ? error.message : "Unknown error" };
  }
}