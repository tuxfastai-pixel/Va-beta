import type { BillingCurrency } from "./feeEngine";

const PAYPAL_ME_EMAIL = "kamogelosentle@gmail.com";

type PaymentLinkInput = {
  invoiceId: string;
  amount: number;
  currency: BillingCurrency;
  clientId: string;
};

function buildUrl(base: string, input: PaymentLinkInput) {
  const url = new URL(base);
  url.searchParams.set("invoice_id", input.invoiceId);
  url.searchParams.set("amount", input.amount.toFixed(2));
  url.searchParams.set("currency", input.currency);
  url.searchParams.set("client_id", input.clientId);
  return url.toString();
}

export function buildPaymentLinks(input: PaymentLinkInput) {
  const stripeBase = process.env.STRIPE_CHECKOUT_BASE_URL || "";
  const paypalBase = process.env.PAYPAL_CHECKOUT_BASE_URL || "";

  const paypalUrl = paypalBase
    ? buildUrl(paypalBase, input)
    : `https://www.paypal.com/paypalme/${PAYPAL_ME_EMAIL}/${input.amount.toFixed(2)}`;

  return {
    stripe_checkout_url: stripeBase ? buildUrl(stripeBase, input) : null,
    paypal_checkout_url: paypalUrl,
  };
}
