"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import HirequeLogo from "@/components/HirequeLogo";
import LogoutButton from "@/components/LogoutButton";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Headphones,
  Lock,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

const industries = [
  ["Wireless", "Available", true],
  ["Real Estate", "Coming soon", false],
  ["Insurance", "Coming soon", false],
  ["Automotive", "Coming soon", false],
  ["SaaS", "Coming soon", false],
  ["Banking", "Coming soon", false],
  ["Retail", "Coming soon", false],
  ["Hospitality", "Coming soon", false],
];

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [companyEmail, setCompanyEmail] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("hireque_access_token");
    const email = localStorage.getItem("hireque_user_email") || "";
    setIsLoggedIn(Boolean(token));
    setCompanyEmail(email);
  }, []);
  return (
    <main className="min-h-screen bg-[#050914] text-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <HirequeLogo />

        <div className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
          <a href="#tracks" className="hover:text-white">Tracks</a>
          <a href="/pricing" className="hover:text-white">Industries</a>
          <a href="#pilot" className="hover:text-white">Pilot</a>
        </div>

        <div className="flex items-center gap-3">
          <a
  href="/pricing"
  className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10"
>
  Pricing
</a>



{isLoggedIn ? (
            <>
              <a
                href="/dashboard"
                className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-black text-white hover:bg-blue-500"
              >
                Dashboard
              </a>
              <LogoutButton />
            </>
          ) : (
            <>
              <a
                href="/login"
                className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10"
              >
                Login
              </a>

              <a
                href="/signup"
                className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#050914] hover:bg-blue-100"
              >
                Start pilot
              </a>
            </>
          )}
        </div>
      </nav>

      <section className="mx-auto grid max-w-7xl items-center gap-16 px-6 pb-20 pt-16 lg:grid-cols-2 lg:pt-24">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/10 px-4 py-2 text-sm text-blue-200">
            <Sparkles size={16} />
            AI customer simulation screening
          </div>

          <h1 className="max-w-4xl text-5xl font-black tracking-tight md:text-7xl">
            Eliminate bad sales and support hires using real customer simulations.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
            Hireque tests candidates inside realistic customer conversations, then
            gives teams clear scoring, red flags, transcripts, and hiring verdicts.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-7 py-4 font-bold hover:bg-blue-500"
            >
              Start pilot <ArrowRight size={18} />
            </a>

            <a
              href="/pricing"
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-7 py-4 font-bold text-slate-200 hover:bg-white/10"
            >
              View pricing
            </a>
          </div>

          <p className="mt-5 text-sm text-slate-400">
            Wireless available first. More categories opening soon.
          </p>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
          <div className="rounded-[1.5rem] bg-[#0B1220] p-6">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400">Candidate Evaluation</p>
                <h2 className="mt-1 text-2xl font-bold">Simulation Scorecard</h2>
              </div>
              <span className="rounded-full bg-amber-500/15 px-4 py-1.5 text-sm font-bold text-amber-300">
                Maybe
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Communication", "7.5"],
                ["Problem Solving", "6.8"],
                ["Objection Handling", "6.2"],
                ["Customer Control", "5.9"],
              ].map(([label, score]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3 flex justify-between text-sm">
                    <span className="text-slate-300">{label}</span>
                    <span className="font-bold">{score}/10</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{ width: `${Number(score) * 10}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-5">
              <p className="font-bold text-red-200">Red flags</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li>Missed key discovery question.</li>
                <li>Gave a vague answer under pressure.</li>
                <li>Did not confirm next step clearly.</li>
              </ul>
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
              <p className="font-bold text-emerald-200">Strength</p>
              <p className="mt-2 text-sm text-slate-300">
                Stayed calm when the customer pushed back.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-6 text-sm text-slate-400 flex flex-wrap gap-4">
  <a href="/wireless-sales-interview-screening" className="hover:text-white">Wireless Sales Screening</a>
  <a href="/wireless-customer-service-screening" className="hover:text-white">Customer Service Screening</a>
  <a href="/ai-sales-interview-tool" className="hover:text-white">AI Sales Interview Tool</a>
  <a href="/telecom-hiring-software" className="hover:text-white">Telecom Hiring Software</a>
</div>

<section id="tracks" className="mx-auto max-w-7xl px-6 py-14">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-300">
            Screening tracks
          </p>
          <h2 className="mt-3 text-4xl font-black">Two roles. One evaluation engine.</h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7">
            <MessageSquareText className="mb-5 text-blue-400" size={32} />
            <h3 className="text-2xl font-bold">Sales Screening</h3>
            <p className="mt-3 leading-7 text-slate-300">
              Tests discovery, objection handling, persuasion, closing behavior,
              confidence, and ability to convert difficult customers.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7">
            <Headphones className="mb-5 text-blue-400" size={32} />
            <h3 className="text-2xl font-bold">Customer Service Screening</h3>
            <p className="mt-3 leading-7 text-slate-300">
              Tests listening, empathy, de-escalation, clarity, ownership,
              resolution quality, and control under pressure.
            </p>
          </div>
        </div>
      </section>

      <section id="industries" className="mx-auto max-w-7xl px-6 py-14">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-300">
            Industry modules
          </p>
          <h2 className="mt-3 text-4xl font-black">Built industry by industry.</h2>
          <p className="mt-4 max-w-2xl text-slate-300">
            Each category needs different customer behavior, objections, and scoring.
            Wireless launches first. Others open after validation.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {industries.map(([name, status, active]) => (
            <div
              key={name as string}
              className={`rounded-3xl border p-5 ${
                active
                  ? "border-blue-500/40 bg-blue-500/10"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <div className="mb-5 flex items-center justify-between">
                <p className="font-bold">{name as string}</p>
                {active ? (
                  <CheckCircle2 className="text-blue-300" size={18} />
                ) : (
                  <Lock className="text-slate-500" size={18} />
                )}
              </div>
              <p className={active ? "text-sm text-blue-200" : "text-sm text-slate-500"}>
                {status as string}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            [ClipboardCheck, "Create screening", "Choose sales or customer service, select the active industry module, and generate a candidate link."],
            [Users, "Send invite link", "Share the screening link with applicants from your hiring pipeline."],
            [BarChart3, "Review verdicts", "See score breakdowns, transcripts, red flags, strengths, and final recommendations."],
          ].map(([Icon, title, desc]) => {
            const I = Icon as typeof ClipboardCheck;
            return (
              <div key={title as string} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <I className="mb-5 text-blue-400" size={28} />
                <h3 className="text-xl font-bold">{title as string}</h3>
                <p className="mt-3 leading-7 text-slate-300">{desc as string}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="pilot" className="mx-auto max-w-5xl px-6 py-20 text-center">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 md:p-12">
          <Clock className="mx-auto mb-5 text-blue-400" size={34} />
          <h2 className="text-4xl font-black md:text-5xl">Start with a focused pilot.</h2>
          <p className="mx-auto mt-4 max-w-2xl leading-8 text-slate-300">
            Pilot pricing is based on hiring volume, team size, and number of
            screenings. Start small, validate results, then scale across roles.
          </p>

          <a
            href="/signup"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-4 font-bold text-[#050914] hover:bg-blue-100"
          >
            Start pilot <ArrowRight size={18} />
          </a>
        </div>
      </section>
    </main>
  );
}






