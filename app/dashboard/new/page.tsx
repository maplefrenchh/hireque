"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clipboard,
  Copy,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type Role = "sales" | "support";
type Level = "rep" | "senior" | "manager" | "district_lead";
type Experience = "newcomer" | "experienced";

type CreateScreeningResponse = {
  success?: boolean;
  inviteUrl?: string;
  screening?: {
    id: string;
    title: string;
    role: Role;
    level: Level;
    experience: Experience;
    industry: string;
    scenario_seed: string;
    created_at: string;
  };
  error?: string;
};

const levels: {
  value: Level;
  label: string;
  short: string;
  description: string;
  pressure: string;
}[] = [
  {
    value: "rep",
    label: "Sales / Service Rep",
    short: "Frontline",
    description:
      "Tests customer conversation quality, confidence, discovery, objection handling, and ability to move the customer forward.",
    pressure: "Standard customer pressure",
  },
  {
    value: "senior",
    label: "Senior Rep",
    short: "Advanced frontline",
    description:
      "Adds stronger objections, competitor comparison, pricing clarity, trust recovery, and sharper recommendation judgment.",
    pressure: "Harder objections",
  },
  {
    value: "manager",
    label: "Store Manager",
    short: "Store leadership",
    description:
      "Tests escalations, rep coaching, customer recovery, accountability, and protecting store standards under pressure.",
    pressure: "Escalation pressure",
  },
  {
    value: "district_lead",
    label: "District Lead",
    short: "Multi-store leadership",
    description:
      "Tests pattern diagnosis, manager accountability, multi-store performance issues, churn risk, and operational judgment.",
    pressure: "Business-impact pressure",
  },
];

export default function NewScreening() {
  const [role, setRole] = useState<Role>("sales");
  const [level, setLevel] = useState<Level>("rep");
  const [experience, setExperience] = useState<Experience>("newcomer");
  const [loading, setLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [createdTitle, setCreatedTitle] = useState("");

  const selectedLevel = useMemo(
    () => levels.find((item) => item.value === level) || levels[0],
    [level]
  );

  const screeningSummary = useMemo(() => {
    const roleLabel =
      role === "sales" ? "Wireless Sales" : "Wireless Customer Service";
    const expLabel =
      experience === "newcomer" ? "Newcomer" : "Experienced";

    return `${roleLabel} · ${selectedLevel.label} · ${expLabel}`;
  }, [role, selectedLevel.label, experience]);

  const handleCreate = async () => {
    if (loading) return;

    setLoading(true);
    setInviteUrl("");
    setCopied(false);
    setCreatedTitle("");

    try {
      const token = localStorage.getItem("hireque_access_token");

      if (!token) {
        alert("Session missing. Log in again.");
        return;
      }

      const res = await fetch("/api/screenings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role, level, experience }),
      });

      const data = (await res.json()) as CreateScreeningResponse;

      if (!res.ok) {
        alert(data.error || "Failed to create screening.");
        return;
      }

      if (!data.inviteUrl || !data.screening) {
        alert("Screening created, but invite link was missing.");
        return;
      }

      const fullUrl = data.inviteUrl.startsWith("http")
        ? data.inviteUrl
        : `${window.location.origin}${data.inviteUrl}`;

      setInviteUrl(fullUrl);
      setCreatedTitle(data.screening.title);
    } catch (error) {
      console.error("Create screening client error:", error);
      alert("Failed to create screening. Check console.");
    } finally {
      setLoading(false);
    }
  };

  const copyInvite = async () => {
    if (!inviteUrl) return;

    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);

    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="min-h-screen bg-[#050914] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm font-bold text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={16} />
            Dashboard
          </Link>

          <div className="hidden rounded-full border border-blue-400/15 bg-blue-500/10 px-5 py-3 text-sm font-bold text-blue-300 sm:block">
            Wireless-only MVP
          </div>
        </div>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1fr_390px]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-300">
              Create Screening
            </p>

            <h1 className="mt-4 max-w-4xl text-5xl font-black tracking-tight">
              Build a role-specific wireless hiring simulation.
            </h1>

            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-400">
              Choose the track, seniority, and wireless experience level. The
              candidate link will run a structured interview, live customer
              scenario, harsh scoring, and employer-ready report.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <FeaturePill text="Adaptive follow-ups" />
              <FeaturePill text="Transcript-based scoring" />
              <FeaturePill text="Employer report" />
            </div>
          </div>

          <aside className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-300">
              Current setup
            </p>

            <h2 className="mt-4 text-2xl font-black">{screeningSummary}</h2>

            <div className="mt-5 space-y-3 text-sm text-slate-300">
              <CheckLine text="Industry locked to wireless / telecom retail" />
              <CheckLine text={selectedLevel.pressure} />
              <CheckLine
                text={
                  experience === "newcomer"
                    ? "No deep telecom knowledge expected"
                    : "Wireless realism tested harder"
                }
              />
              <CheckLine text="Live customer roleplay included" />
            </div>
          </aside>
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-2">
          <ChoiceCard
            active={role === "sales"}
            title="Wireless Sales"
            tag="Revenue role"
            description="Tests discovery, value framing, objection handling, customer control, trust building, recommendation quality, and closing instinct."
            onClick={() => setRole("sales")}
          />

          <ChoiceCard
            active={role === "support"}
            title="Wireless Customer Service"
            tag="Retention role"
            description="Tests de-escalation, ownership, clarity, realistic resolution, customer recovery, retention risk, and policy honesty."
            onClick={() => setRole("support")}
          />
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-300">
                Role Level
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Pick the real hiring level. Do not inflate this. A district lead
                screening is intentionally much harder than a frontline rep
                screening.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {levels.map((item) => (
              <button
                key={item.value}
                onClick={() => setLevel(item.value)}
                className={`rounded-[1.5rem] border p-5 text-left transition ${
                  level === item.value
                    ? "border-blue-400 bg-blue-500/10 shadow-lg shadow-blue-900/20"
                    : "border-white/10 bg-[#0B1220] hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                      {item.short}
                    </p>
                    <h3 className="mt-2 text-lg font-black">{item.label}</h3>
                  </div>

                  {level === item.value && (
                    <CheckCircle2 size={20} className="text-blue-300" />
                  )}
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-400">
                  {item.description}
                </p>

                <p className="mt-4 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-slate-300">
                  {item.pressure}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <ChoiceCard
            active={experience === "newcomer"}
            title="Newcomer"
            tag="Transferable skill test"
            description="Best for candidates new to wireless. Tests instinct, curiosity, customer control, confidence, coachability, and judgment without punishing missing telecom jargon."
            onClick={() => setExperience("newcomer")}
          />

          <ChoiceCard
            active={experience === "experienced"}
            title="Experienced"
            tag="Wireless realism test"
            description="Best for candidates claiming wireless background. Adds harder pressure around plans, bills, fees, upgrades, device payments, competitor offers, and customer recovery."
            onClick={() => setExperience("experienced")}
          />
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-300">
                Generate candidate link
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Share this link with candidates. Each screening uses a locked
                scenario seed so the interview stays consistent but still feels
                live and adaptive.
              </p>
            </div>

            <button
              onClick={handleCreate}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-7 py-4 font-bold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Create Screening Link
                </>
              )}
            </button>
          </div>
        </section>

        {inviteUrl && (
          <section className="mt-6 rounded-[2rem] border border-emerald-400/20 bg-emerald-500/10 p-6 shadow-2xl">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-300">
                  Screening created
                </p>

                <h2 className="mt-3 text-2xl font-black">
                  {createdTitle || screeningSummary}
                </h2>

                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                  Send this link to candidates. The candidate will not see their
                  score; the company sees the report after submission.
                </p>

                <div className="mt-5 rounded-2xl border border-white/10 bg-[#050914] p-4">
                  <p className="break-all text-sm leading-6 text-slate-300">
                    {inviteUrl}
                  </p>
                </div>
              </div>

              <div className="flex min-w-[220px] flex-col gap-3">
                <button
                  onClick={copyInvite}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#050914] hover:bg-blue-100"
                >
                  {copied ? <CheckCircle2 size={17} /> : <Copy size={17} />}
                  {copied ? "Copied" : "Copy Link"}
                </button>

                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
                >
                  <Clipboard size={17} />
                  View Dashboard
                </Link>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function ChoiceCard({
  active,
  title,
  tag,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  tag: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[2rem] border p-6 text-left transition ${
        active
          ? "border-blue-400 bg-blue-500/10 shadow-lg shadow-blue-900/20"
          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">
            {tag}
          </p>
          <h2 className="mt-3 text-2xl font-black">{title}</h2>
        </div>

        {active && <CheckCircle2 size={22} className="text-blue-300" />}
      </div>

      <p className="mt-4 text-sm leading-7 text-slate-400">{description}</p>
    </button>
  );
}

function FeaturePill({ text }: { text: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-300">
      <ShieldCheck size={16} className="text-blue-300" />
      {text}
    </div>
  );
}

function CheckLine({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2">
      <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-300" />
      <span>{text}</span>
    </div>
  );
}