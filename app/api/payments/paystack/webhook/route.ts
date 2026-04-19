import crypto from "crypto";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    return new Response("Paystack is not configured", { status: 500 });
  }

  const body = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(body)
    .digest("hex");

  if (hash !== signature) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(body) as {
    event?: string;
    data?: {
      amount?: number;
      currency?: string;
      metadata?: {
        user_id?: string;
        job_id?: string;
      };
    };
  };

  if (event.event === "charge.success") {
    const data = event.data;
    const amount = Number(data?.amount || 0) / 100;
    const currency = String(data?.currency || "ZAR").toUpperCase();
    const userId = String(data?.metadata?.user_id || "").trim();
    const jobId = String(data?.metadata?.job_id || "").trim();

    const existingPaid = await supabase
      .from("earnings")
      .select("id")
      .eq("job_id", jobId)
      .eq("status", "paid")
      .limit(1)
      .maybeSingle();

    if (!existingPaid.data?.id) {
      await supabase.from("earnings").insert({
        amount,
        currency,
        status: "paid",
        user_id: userId || null,
        job_id: jobId || null,
        created_at: new Date().toISOString(),
      });
    }

    await supabase
      .from("payments")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("job_id", jobId);
  }

  return new Response("ok");
}