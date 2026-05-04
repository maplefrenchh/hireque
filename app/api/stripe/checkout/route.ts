import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const priceToPlan: Record<string, { plan: string; limit: number }> = {
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER!]: { plan: "starter", limit: 10 },
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_GROWTH!]: { plan: "growth", limit: 50 },
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_SCALE!]: { plan: "scale", limit: 150 },
};

export async function POST(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const body = await req.json();
    const priceId = body?.priceId;

    if (!priceId || !priceToPlan[priceId]) {
      return NextResponse.json({ error: "Invalid price selected" }, { status: 400 });
    }

    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email || undefined,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        plan: priceToPlan[priceId].plan,
        monthly_candidate_limit: String(priceToPlan[priceId].limit),
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan: priceToPlan[priceId].plan,
          monthly_candidate_limit: String(priceToPlan[priceId].limit),
        },
      },
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
