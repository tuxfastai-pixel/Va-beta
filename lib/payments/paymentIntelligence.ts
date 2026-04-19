export type ClientProfile = {
  email?: string;
  country?: string;
  company_size?: "individual" | "small" | "enterprise";
  budget?: number;
};

export type PaymentMethod = "paystack" | "paypal" | "bank";

type GeneratePaymentLinkInput = {
  method: PaymentMethod;
  amount: number;
  currency?: string;
  email?: string;
  job_id: string;
  user_id: string;
  origin?: string;
};

export function selectPaymentMethod(client: ClientProfile): PaymentMethod {
  if (client.company_size === "enterprise") return "bank";

  if (client.country && !client.country.toLowerCase().includes("south africa")) {
    return "paypal";
  }

  return "paystack";
}

export async function generatePaymentLink({
  method,
  amount,
  currency,
  email,
  job_id,
  user_id,
  origin,
}: GeneratePaymentLinkInput): Promise<string> {
  const baseOrigin = String(origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

  if (method === "paystack") {
    const res = await fetch(`${baseOrigin}/api/payments/paystack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        currency,
        email,
        job_id,
        user_id,
        origin: baseOrigin,
      }),
    });

    if (!res.ok) {
      throw new Error(`Paystack link generation failed with status ${res.status}`);
    }

    const data = (await res.json().catch(() => ({}))) as { url?: string };
    if (!data.url) {
      throw new Error("Paystack link response missing url");
    }

    return data.url;
  }

  if (method === "paypal") {
    const params = new URLSearchParams({
      amount: String(amount),
      job_id,
      user_id,
      email: String(email || ""),
    });
    return `${baseOrigin}/api/payments/paypal/create?${params.toString()}`;
  }

  return "BANK_TRANSFER_REQUIRED";
}