import { sendNotification } from "../notifications/email.ts";

type OutreachProspect = {
  contact_email?: string | null;
};

export async function sendOutreachEmail(prospect: OutreachProspect, emailContent: string) {
  if (!prospect.contact_email) {
    throw new Error("Prospect is missing a contact email.");
  }

  await sendNotification(
    prospect.contact_email,
    "AI Assisted Remote Support",
    emailContent
  );
}
