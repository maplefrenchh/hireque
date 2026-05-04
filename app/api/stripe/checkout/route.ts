export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  return new Stripe(key);
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe();

    const body = await req.json();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: body.priceId,
          quantity: 1,
        },
      ],
      success_url: `${body.origin}/success`,
      cancel_url: `${body.origin}/pricing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Stripe error" },
      { status: 500 }
    );
  }
}
