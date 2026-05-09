"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import HirequeLogo from "@/components/HirequeLogo";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const updatePassword = async () => {
    setMessage("");
    setError("");

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage("Password updated. You can now log in.");
    setTimeout(() => {
      window.location.href = "/login";
    }, 1200);
  };

  return (
    <main className="min-h-screen bg-[#050914] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
        <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
          <div className="mb-8 flex justify-center">
            <HirequeLogo />
          </div>

          <h1 className="text-3xl font-black">Choose new password</h1>
          <p className="mt-2 text-slate-400">
            Set a new password for your Hireque company account.
          </p>

          <div className="mt-8 space-y-4">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              type="password"
              className="w-full rounded-2xl border border-white/10 bg-[#0B1220] px-5 py-4 outline-none focus:border-blue-500"
            />

            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              type="password"
              className="w-full rounded-2xl border border-white/10 bg-[#0B1220] px-5 py-4 outline-none focus:border-blue-500"
            />

            {error && (
              <p className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </p>
            )}

            {message && (
              <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                {message}
              </p>
            )}

            <button
              type="button"
              onClick={updatePassword}
              disabled={loading}
              className="w-full rounded-2xl bg-blue-600 py-4 font-black hover:bg-blue-500 disabled:opacity-60"
            >
              {loading ? "Updating..." : "Update password"}
            </button>
          </div>

          <Link href="/login" className="mt-6 block text-center text-sm text-slate-400 hover:text-white">
            Back to login
          </Link>
        </section>
      </div>
    </main>
  );
}