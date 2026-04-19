import Stripe from "stripe";

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY.");
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
  });
}
