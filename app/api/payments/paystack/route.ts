import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

type PaystackBody = {
  amount?: number;
  currency?: string;
  email?: string;
  job_id?: string;
  user_id?: string;
  origin?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as PaystackBody | null;

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const amount = Number(body.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return NextResponse.json({ error: "Paystack is not configured. Set PAYSTACK_SECRET_KEY." }, { status: 500 });
  }

  if (!String(body.email || "").trim()) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const origin = String(body.origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

  try {
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: String(body.email || "").trim(),
        amount: Math.round(amount * 100),
        currency: String(body.currency || "ZAR").toUpperCase(),
        callback_url: `${origin}/success`,
        metadata: {
          job_id: String(body.job_id || ""),
          user_id: String(body.user_id || ""),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return NextResponse.json({
      url: response.data?.data?.authorization_url,
      reference: response.data?.data?.reference,
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message =
        error.response?.data?.message || error.response?.data?.error || error.message || "Failed to initialize Paystack payment";
      return NextResponse.json({ error: message }, { status: error.response?.status || 500 });
    }

    return NextResponse.json({ error: "Failed to initialize Paystack payment" }, { status: 500 });
  }
}