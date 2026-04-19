import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const amount = Number(searchParams.get("amount") || 0);
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;

  return NextResponse.json({
    url: `https://www.paypal.com/pay?amount=${safeAmount}`,
  });
}