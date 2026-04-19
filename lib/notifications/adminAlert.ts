import { supabaseServer } from "@/lib/supabaseServer";
import { sendNotification } from "./email";

export interface AdminAlertPayload {
  type: "access_request" | "access_approved" | "access_rejected" | "system_alert";
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Send email alert to admin (using environment variable)
 * Falls back gracefully if email not configured
 */
export async function notifyAdminViaEmail(payload: AdminAlertPayload) {
  const adminEmail = process.env.ADMIN_EMAIL;
  
  if (!adminEmail) {
    console.warn("Admin email notification skipped: ADMIN_EMAIL not configured");
    return;
  }

  try {
    await sendNotification(
      adminEmail,
      `🚨 ${payload.title}`,
      payload.message
    );
    console.log(`✅ Admin email sent: ${payload.title}`);
  } catch (error) {
    console.error("Failed to send admin email:", error);
  }
}

/**
 * Send WhatsApp alert to admin (Twilio-based)
 * Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER
 */
export async function notifyAdminViaWhatsApp(payload: AdminAlertPayload) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;
  const toNumber = process.env.ADMIN_WHATSAPP_NUMBER;

  if (!accountSid || !authToken || !fromNumber || !toNumber) {
    console.warn("WhatsApp notification skipped: Twilio credentials not configured");
    return;
  }

  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: fromNumber,
          To: toNumber,
          Body: `${payload.title}\n\n${payload.message}`,
        }).toString(),
      }
    );

    if (!response.ok) {
      throw new Error(`Twilio API error: ${response.status}`);
    }

    console.log(`✅ WhatsApp alert sent: ${payload.title}`);
  } catch (error) {
    console.error("Failed to send WhatsApp alert:", error);
  }
}

/**
 * Store in-app admin notification in database
 */
export async function notifyAdminInApp(adminUserId: string, payload: AdminAlertPayload) {
  try {
    const { error } = await supabaseServer
      .from("admin_notifications")
      .insert({
        type: payload.type,
        user_id: adminUserId,
        title: payload.title,
        message: payload.message,
        payload: payload.metadata || {},
      });

    if (error) throw error;
    console.log(`✅ In-app admin notification created: ${payload.title}`);
  } catch (error) {
    console.error("Failed to create in-app notification:", error);
  }
}

/**
 * Send access request notifications (multi-channel)
 */
export async function notifyAccessRequest(email: string, name: string, adminUserId?: string) {
  const payload: AdminAlertPayload = {
    type: "access_request",
    title: "🚨 New Access Request",
    message: `🆕 ${name} (${email}) requested access.\n\nApprove or reject in the admin dashboard.`,
    metadata: {
      email,
      name,
      requestTime: new Date().toISOString(),
    },
  };

  // Try all notification channels (fail gracefully)
  await notifyAdminViaEmail(payload);
  await notifyAdminViaWhatsApp(payload);
  
  if (adminUserId) {
    await notifyAdminInApp(adminUserId, payload);
  }
}

/**
 * Send approval notification to user
 */
export async function notifyUserApproved(email: string, name: string) {
  try {
    await sendNotification(
      email,
      "✅ Access Approved!",
      `Welcome, ${name}! Your access request has been approved. You can now log in and start using the platform.`
    );
    console.log(`✅ User approval notification sent to ${email}`);
  } catch (error) {
    console.error("Failed to notify user of approval:", error);
  }
}

/**
 * Send rejection notification to user
 */
export async function notifyUserRejected(email: string, name: string, reason?: string) {
  try {
    const message = `Unfortunately, ${name}, your access request has been rejected.${
      reason ? ` Reason: ${reason}` : ""
    } Please contact support if you have questions.`;
    
    await sendNotification(
      email,
      "❌ Access Request Rejected",
      message
    );
    console.log(`✅ User rejection notification sent to ${email}`);
  } catch (error) {
    console.error("Failed to notify user of rejection:", error);
  }
}
