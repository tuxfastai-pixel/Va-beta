import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/payments/stripe";
import { supabaseServer } from "@/lib/supabaseServer";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

async function getCustomerEmail(stripe: ReturnType<typeof getStripe>, customerId: string) {
  const customer = await stripe.customers.retrieve(customerId);

  if ("deleted" in customer && customer.deleted) {
    return null;
  }

  return customer.email;
}

export async function POST(req: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return new NextResponse("Stripe webhook is not configured", { status: 500 });
  }

  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch (error) {
    return new NextResponse(getErrorMessage(error), { status: 500 });
  }

  const sig = req.headers.get("stripe-signature")!;
  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    console.error(`Webhook signature verification failed: ${message}`);
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerEmail = session.customer_email || session.customer_details?.email;

      if (session.mode === "payment") {
        const userId = String(session.metadata?.user_id || "").trim();
        const clientId = String(session.metadata?.client_id || "").trim();
        const jobId = String(session.metadata?.job_id || "").trim();
        const amount = Number(session.amount_total || 0) / 100;
        const currency = String(session.currency || "usd").toUpperCase();

        const existingPaid = await supabaseServer
          .from("earnings")
          .select("id")
          .eq("job_id", jobId)
          .eq("status", "paid")
          .limit(1)
          .maybeSingle();

        if (existingPaid.error) {
          console.error(`Error checking existing paid earnings: ${existingPaid.error.message}`);
        }

        if (!existingPaid.data?.id) {
          const { error: earningsInsertErr } = await supabaseServer.from("earnings").insert({
            user_id: userId || null,
            client_id: clientId || null,
            job_id: jobId || null,
            amount,
            currency,
            status: "paid",
            created_at: new Date().toISOString(),
          });

          if (earningsInsertErr) {
            console.error(`Error inserting paid earnings: ${earningsInsertErr.message}`);
          }
        }

        if (jobId) {
          const { error: invoiceUpdateErr } = await supabaseServer
            .from("invoices")
            .update({ status: "paid" })
            .eq("task_id", jobId);

          if (invoiceUpdateErr) {
            console.error(`Error updating invoice status: ${invoiceUpdateErr.message}`);
          }

          const { error: paymentUpdateErr } = await supabaseServer
            .from("payments")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("job_id", jobId)
            .eq("status", "pending");

          if (
            paymentUpdateErr &&
            !paymentUpdateErr.message.toLowerCase().includes("could not find the table 'public.payments'")
          ) {
            console.error(`Error updating payment status: ${paymentUpdateErr.message}`);
          }
        }

        return NextResponse.json({ received: true });
      }

      if (customerEmail && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(String(session.subscription));
        const stripeCustomerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id || null;

        const { error } = await supabaseServer
          .from("subscriptions")
          .insert({
            client_id: customerEmail,
            plan: "growth",
            status: "active",
            amount: session.amount_total ? session.amount_total / 100 : 0,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: stripeCustomerId,
            created_at: new Date().toISOString(),
          });

        if (error) {
          console.error(`Error inserting subscription: ${error.message}`);
          return NextResponse.json({ received: true });
        }

        console.log(`Subscription created for ${customerEmail}`);
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;

      if (invoice.customer) {
        const email = await getCustomerEmail(stripe, String(invoice.customer));

        if (email) {
          const { error } = await supabaseServer
            .from("subscriptions")
            .update({ status: "past_due" })
            .eq("client_id", email);

          if (error) {
            console.error(`Error updating subscription status: ${error.message}`);
          } else {
            console.log(`Subscription marked past_due for ${email}`);
          }
        }
      }
    }

    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;

      if (invoice.customer) {
        const email = await getCustomerEmail(stripe, String(invoice.customer));

        if (email) {
          const { error } = await supabaseServer
            .from("subscriptions")
            .update({ status: "active" })
            .eq("client_id", email)
            .eq("status", "past_due");

          if (error) {
            console.error(`Error reactivating subscription: ${error.message}`);
          } else {
            console.log(`Subscription reactivated for ${email}`);
          }
        }
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;

      if (subscription.metadata?.client_id) {
        const { error } = await supabaseServer
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("client_id", subscription.metadata.client_id);

        if (error) {
          console.error(`Error cancelling subscription: ${error.message}`);
        } else {
          console.log(`Subscription cancelled for ${subscription.metadata.client_id}`);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    console.error(`Webhook error: ${getErrorMessage(err)}`);
    return NextResponse.json({ received: true });
  }
}
