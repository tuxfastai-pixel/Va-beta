import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
  });
}

export function generateEmail(lead: { name?: string; [key: string]: unknown }): string {
  return [
    `Hi ${lead.name || "there"},`,
    ``,
    `We help businesses execute tasks automatically using AI systems.`,
    ``,
    `We can help with:`,
    `- automation`,
    `- faster delivery`,
    `- reduced costs`,
    ``,
    `Would you be open to a quick discussion?`,
    ``,
    `Best,`,
    `AI Execution Team`,
  ].join("\n");
}
