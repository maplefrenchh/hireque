"use client";

import { useState } from "react";
import Link from "next/link";
import HirequeLogo from "@/components/HirequeLogo";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");

    if (!email || !password) {
      setError("Fill all fields.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Login failed.");
      return;
    }

    localStorage.setItem("hireque_access_token", data.access_token);
    localStorage.setItem("hireque_user_email", data.user.email);

    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-[#050914] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
        <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
          <div className="mb-8 flex justify-center">
            <HirequeLogo />
          </div>

          <h1 className="text-3xl font-black">Login</h1>
          <p className="mt-2 text-slate-400">
            Access your candidate screening dashboard.
          </p>

          <form className="mt-8 space-y-4">
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
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-full bg-blue-600 px-6 py-4 font-bold hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            No account yet?{" "}
            <Link href="/signup" className="font-bold text-blue-300">
              Create account
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}