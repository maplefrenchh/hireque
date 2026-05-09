"use client";

import { useState } from "react";
import Link from "next/link";
import HirequeLogo from "@/components/HirequeLogo";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignup = async () => {
    setError("");

    if (!companyName || !email || !password) {
      setError("Fill all fields.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ companyName, email, password }),
    });

    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Signup failed.");
      return;
    }

    router.push("/login?verify=1");
  };

  return (
    <main className="min-h-screen bg-[#050914] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
        <div className="grid w-full gap-10 lg:grid-cols-2">
          <section className="hidden flex-col justify-center lg:flex">
            <HirequeLogo />
            <h1 className="mt-10 text-5xl font-black tracking-tight">
              Start screening candidates with customer simulations.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-slate-300">
              Create sales and customer service screenings, send invite links,
              and review clear candidate verdicts.
            </p>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
            <h2 className="text-3xl font-black">Create your account</h2>
            <p className="mt-2 text-slate-400">
              Company access for early pilot teams.
            </p>

            <form className="mt-8 space-y-4">
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Company name"
                className="w-full rounded-2xl border border-white/10 bg-[#0B1220] px-5 py-4 outline-none focus:border-blue-500"
              />

              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Work email"
                type="email"
                className="w-full rounded-2xl border border-white/10 bg-[#0B1220] px-5 py-4 outline-none focus:border-blue-500"
              />

              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                type="password"
                className="w-full rounded-2xl border border-white/10 bg-[#0B1220] px-5 py-4 outline-none focus:border-blue-500"
              />

              {error && (
                <p className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={handleSignup}
                disabled={loading}
                className="w-full rounded-full bg-blue-600 px-6 py-4 font-bold hover:bg-blue-500 disabled:opacity-50"
              >
                {loading ? "Creating account..." : "Create account"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-400">
              Already have an account?{" "}
              <Link href="/login" className="font-bold text-blue-300">
                Login
              </Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}