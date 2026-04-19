import { sendEmail, generateEmail } from "./emailEngine";
import { supabase } from "@/lib/supabase";

type Lead = {
  name?: string;
  email: string;
  [key: string]: unknown;
};

export async function runOutreach(leads: Lead[]): Promise<void> {
  for (const lead of leads) {
    const message = generateEmail(lead);

    await sendEmail(lead.email, "AI Automation Opportunity", message);

    await supabase.from("outreach_logs").insert({
      email: lead.email,
      subject: "AI Automation Opportunity",
      message,
      status: "sent",
    });

    console.log("📧 Sent to:", lead.email);
  }
}
