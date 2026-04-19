import { NextResponse } from "next/server";
import { getStripe } from "@/lib/payments/stripe";
import { trackFunnelEvent } from "@/lib/analytics/funnelTracking";

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
      return NextResponse.json(
        { error: "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID." },
        { status: 500 }
      );
    }

    // Try to get email from request body if provided
    const body = await req.json().catch(() => ({}));
    const email = body?.email ? String(body.email).trim().toLowerCase() : undefined;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/dashboard`,
      cancel_url: `${baseUrl}/`,
      customer_email: email,
    });

    // Track funnel event if email is available
    if (email && session.id) {
      await trackFunnelEvent({
        email,
        step: "subscription_created",
        metadata: {
          sessionId: session.id,
          price: process.env.STRIPE_PRICE_ID,
        },
      });
    }

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to create Stripe checkout session",
      },
      { status: 500 }
    );
  }
}
