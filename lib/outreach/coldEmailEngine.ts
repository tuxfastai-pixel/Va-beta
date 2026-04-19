import nodemailer from "nodemailer";
import { supabaseServer } from "@/lib/supabaseServer";

interface EmailAccount {
  id: string;
  email: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  daily_limit: number;
  sent_today: number;
  sent_total?: number;
}

interface SendEmailOptions {
  accountId: string;
  to: string;
  subject: string;
  text: string;
  leadId?: string;
  templateId?: string;
}

/**
 * Send cold email using SMTP account
 */
export async function sendColdEmail(
  account: EmailAccount,
  options: SendEmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Create transporter from SMTP credentials
    const transporter = nodemailer.createTransport({
      host: account.smtp_host,
      port: account.smtp_port,
      secure: account.smtp_port === 465, // true for 465, false for other ports
      auth: {
        user: account.smtp_user,
        pass: account.smtp_pass,
      },
      // Ensure valid from address
      from: account.email,
    });

    // Verify connection
    const verified = await transporter.verify().catch(() => false);
    if (!verified) {
      return {
        success: false,
        error: `SMTP connection failed for ${account.email}`,
      };
    }

    // Send email
    const info = await transporter.sendMail({
      from: account.email,
      to: options.to,
      subject: options.subject,
      text: options.text,
      // Add reply-to header for better deliverability
      replyTo: account.email,
      // Add custom headers for tracking
      headers: {
        "X-Campaign": "cold-outreach",
        "X-Lead-Id": options.leadId || "unknown",
      },
    });

    // Log successful send
    const { error: logError } = await supabaseServer
      .from("cold_email_sends")
      .insert({
        account_id: account.id,
        lead_id: options.leadId,
        lead_email: options.to,
        subject: options.subject,
        message: options.text,
        template_id: options.templateId || "unknown",
        status: "sent",
        sent_at: new Date().toISOString(),
      });

    if (logError) {
      console.error(`Failed to log email send: ${logError.message}`);
    }

    // Update account sent_today counter
    const { error: updateError } = await supabaseServer
      .from("email_accounts")
      .update({
        sent_today: account.sent_today + 1,
        sent_total: (account.sent_total || 0) + 1,
        last_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);

    if (updateError) {
      console.error(`Failed to update account counter: ${updateError.message}`);
    }

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Error sending cold email: ${message}`);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Get healthy email accounts ready for sending
 */
export async function getHealthyEmailAccounts(
  limit: number = 10
): Promise<EmailAccount[]> {
  try {
    const { data, error } = await supabaseServer
      .from("email_account_health")
      .select("id, email, smtp_host, smtp_port, smtp_user, smtp_pass, daily_limit, sent_today")
      .limit(limit);

    if (error) {
      console.error(`Error fetching healthy accounts: ${error.message}`);
      return [];
    }

    return data || [];
  } catch (err: unknown) {
    console.error(`Error in getHealthyEmailAccounts: ${err instanceof Error ? err.message : "Unknown error"}`);
    return [];
  }
}

/**
 * Get next available account for sending
 */
export async function getNextAvailableAccount(): Promise<EmailAccount | null> {
  try {
    const { data, error } = await supabaseServer
      .from("email_accounts")
      .select("*")
      .eq("status", "active")
      .lt("sent_today", supabaseServer.rpc("get_daily_limit", { account_id: "id" }))
      .order("last_sent_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`Error fetching account: ${error.message}`);
      return null;
    }

    return data as EmailAccount | null;
  } catch (err: unknown) {
    console.error(`Error in getNextAvailableAccount: ${err instanceof Error ? err.message : "Unknown error"}`);
    return null;
  }
}

/**
 * Get account by id
 */
export async function getEmailAccount(accountId: string): Promise<EmailAccount | null> {
  try {
    const { data, error } = await supabaseServer
      .from("email_accounts")
      .select("*")
      .eq("id", accountId)
      .maybeSingle();

    if (error) {
      return null;
    }

    return data as EmailAccount | null;
  } catch (err: unknown) {
    console.error(`Error in getEmailAccount: ${err instanceof Error ? err.message : "Unknown error"}`);
    return null;
  }
}

/**
 * Get all active accounts
 */
export async function getAllActiveAccounts(): Promise<EmailAccount[]> {
  try {
    const { data, error } = await supabaseServer
      .from("email_accounts")
      .select("*")
      .eq("status", "active");

    if (error) {
      console.error(`Error fetching all accounts: ${error.message}`);
      return [];
    }

    return data || [];
  } catch (err: unknown) {
    console.error(`Error in getAllActiveAccounts: ${err instanceof Error ? err.message : "Unknown error"}`);
    return [];
  }
}

/**
 * Update account health metrics
 */
export async function updateAccountMetrics(
  accountId: string,
  metrics: { reply_rate?: number; bounce_rate?: number; warmup_days?: number }
): Promise<boolean> {
  try {
    const { error } = await supabaseServer
      .from("email_accounts")
      .update({
        ...metrics,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId);

    if (error) {
      console.error(`Error updating account metrics: ${error.message}`);
      return false;
    }

    return true;
  } catch (err: unknown) {
    console.error(`Error in updateAccountMetrics: ${err instanceof Error ? err.message : "Unknown error"}`);
    return false;
  }
}
