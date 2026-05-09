"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ArrowLeft } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type PlanKey = "starter" | "growth" | "scale";

const plans = [
  {
    key: "starter" as PlanKey,
    name: "Starter",
    price: "$79",
    candidates: "10 candidates/month",
    extra: "$8 per extra candidate",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER,
    badge: null,
  },
  {
    key: "growth" as PlanKey,
    name: "Growth",
    price: "$299",
    candidates: "50 candidates/month",
    extra: "$6 per extra candidate",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_GROWTH,
    badge: null,
  },
  {
    key: "scale" as PlanKey,
    name: "Scale",
    price: "$799",
    candidates: "150 candidates/month",
    extra: "$4 per extra candidate",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_SCALE,
    badge: "BEST SELLER",
  },
];

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);

  const startCheckout = async (plan: (typeof plans)[number]) => {
    try {
      setLoadingPlan(plan.key);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token =
        session?.access_token || localStorage.getItem("hireque_access_token");

      if (!token) {
        window.location.href = "/login?next=/pricing";
        return;
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ priceId: plan.priceId }),
      });

      if (!res.ok) {
        console.error("Checkout failed:", res.status);
        throw new Error("Payment failed");
      }

      const data = await res.json();

      if (!data?.url) {
        throw new Error("Payment failed");
      }

      window.location.href = data.url;
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#050914] px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white">
  <ArrowLeft size={16} />
  Back home
</Link>
          <Link href="/dashboard" className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10">
            Dashboard
          </Link>
        </div>

        <section className="mx-auto mt-16 max-w-3xl text-center">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-blue-300">
            Hireque Pricing
          </p>
          <h1 className="mt-4 text-5xl font-black tracking-tight md:text-6xl">
            Screen better candidates before wasting interview time.
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            First 5 candidates are free. After that, choose a monthly plan based on hiring volume.
          </p>
        </section>

        <section className="mt-14 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.key}
              className={`relative rounded-[2rem] border p-7 ${
                plan.badge
                  ? "border-blue-500 bg-blue-500/[0.08] shadow-2xl shadow-blue-950/30"
                  : "border-white/10 bg-white/[0.04]"
              }`}
            >
              {plan.badge && (
                <div className="absolute right-5 top-5 rounded-full bg-blue-500 px-3 py-1 text-xs font-black">
                  {plan.badge}
                </div>
              )}

              <h2 className="text-2xl font-black">{plan.name}</h2>
              <div className="mt-5 flex items-end gap-2">
                <p className="text-5xl font-black">{plan.price}</p>
                <p className="pb-2 text-slate-400">/month</p>
              </div>

              <ul className="mt-7 space-y-3 text-sm text-slate-300">
                <li className="flex items-center gap-2"><Check size={16} className="text-blue-400" /> {plan.candidates}</li>
                <li className="flex items-center gap-2"><Check size={16} className="text-blue-400" /> {plan.extra}</li>
                <li className="flex items-center gap-2"><Check size={16} className="text-blue-400" /> Full AI candidate reports</li>
                <li className="flex items-center gap-2"><Check size={16} className="text-blue-400" /> Sales + customer service tracks</li>
                <li className="flex items-center gap-2"><Check size={16} className="text-blue-400" /> Transcript, red flags, verdicts</li>
                <li className="flex items-center gap-2"><Check size={16} className="text-blue-400" /> Unused candidates do not roll over</li>
              </ul>

              <button
                onClick={() => startCheckout(plan)}
                disabled={loadingPlan === plan.key}
                className="mt-8 w-full rounded-full bg-white px-5 py-3 font-black text-[#050914] hover:bg-blue-100 disabled:opacity-60"
              >
                {loadingPlan === plan.key ? "Opening checkout..." : "Choose plan"}
              </button>
            </div>
          ))}
        </section>

        <p className="mt-10 text-center text-sm text-slate-500">
          Need more than 150 candidates/month? Start with Scale and contact us for custom volume pricing.
        </p>
      </div>
    </main>
  );
}





