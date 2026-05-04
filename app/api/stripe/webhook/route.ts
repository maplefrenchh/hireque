import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error("Webhook signature error:", error);
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const userId = session.metadata?.user_id || session.client_reference_id;
      const plan = session.metadata?.plan || "free";
      const limit = Number(session.metadata?.monthly_candidate_limit || 5);
      const overagePrice =
        plan === "starter" ? 8 :
        plan === "growth" ? 6 :
        plan === "scale" ? 4 :
        0;

      if (userId) {
        await supabaseAdmin
          .from("profiles")
          .update({
            stripe_customer_id: String(session.customer || ""),
            stripe_subscription_id: String(session.subscription || ""),
            plan,
            subscription_status: "active",
            monthly_candidate_limit: limit,
            overage_price: overagePrice,
            current_month_candidates: 0,
            billing_period_start: new Date().toISOString(),
          })
          .eq("id", userId);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.user_id;

      if (userId) {
        await supabaseAdmin
          .from("profiles")
          .update({
            plan: "free",
            subscription_status: "cancelled",
            monthly_candidate_limit: 5,
          })
          .eq("id", userId);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handling error:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}

