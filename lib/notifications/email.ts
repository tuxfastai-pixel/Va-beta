import nodemailer from "nodemailer";

const notifyEmail = process.env.NOTIFY_EMAIL;
const notifyPassword = process.env.NOTIFY_PASSWORD;

const transporter =
  notifyEmail && notifyPassword
    ? nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: notifyEmail,
          pass: notifyPassword,
        },
      })
    : null;

export async function sendNotification(email: string, subject: string, message: string) {
  if (!transporter || !notifyEmail) {
    console.warn("Notification skipped: NOTIFY_EMAIL/NOTIFY_PASSWORD not configured");
    return;
  }

  await transporter.sendMail({
    from: notifyEmail,
    to: email,
    subject,
    text: message,
  });
}
