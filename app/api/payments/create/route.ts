import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/payments/stripe";

type CreatePaymentBody = {
  amount?: number;
  currency?: string;
  title?: string;
  origin?: string;
  job_id?: string;
  user_id?: string;
  client_id?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as CreatePaymentBody | null;

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const amount = Number(body.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }

  const origin = String(body.origin || "").trim() || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const currency = String(body.currency || "usd").trim().toLowerCase();

  try {
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: String(body.title || "AI Service"),
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/success`,
      cancel_url: `${origin}/cancel`,
      metadata: {
        job_id: String(body.job_id || ""),
        user_id: String(body.user_id || ""),
        client_id: String(body.client_id || ""),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create Stripe checkout session" },
      { status: 500 }
    );
  }
}