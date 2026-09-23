import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.formData();
  const message = String(body.get("Body") || "");
  const from = String(body.get("From") || "");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  await fetch(`${baseUrl}/api/inbound`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      phone: from,
      source: "whatsapp",
    }),
  });

  return new NextResponse("OK");
}
