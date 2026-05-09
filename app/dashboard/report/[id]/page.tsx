export const dynamic = "force-dynamic";

import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    token?: string;
  }>;
};

type Report = {
  id: string;
  company_id: string | null;
  screening_id: string | null;
  candidate_name: string | null;
  candidate_email: string | null;
  transcript: string | null;
  role: string | null;
  level: string | null;
  experience: string | null;
  overall_score: number | null;
  score: number | null;
  verdict: string | null;
  strengths: string[] | null;
  weakness: string[] | null;
  weaknesses?: string[] | null;
  red_flags: string[] | null;
  recommendation: string | null;
  raw_evaluation: Record<string, any> | null;
  created_at: string | null;
  summary: string | null;
  feedback: string | null;
};

function getArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

function safeScore(report: Report) {
  const score = report.overall_score ?? report.score ?? 0;
  return Math.max(0, Math.min(10, Number(score) || 0));
}

function verdictStyle(verdict?: string | null) {
  const v = (verdict || "").toLowerCase();

  if (v.includes("hire")) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (v.includes("maybe")) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }

  return "border-rose-500/30 bg-rose-500/10 text-rose-300";
}

function formatDate(value?: string | null) {
  if (!value) return "Not saved";

  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default async function CandidateReportPage({ params, searchParams }: PageProps) {
  const { id: reportId } = await params;
  const sp = searchParams ? await searchParams : {};
  const token = sp?.token || "";

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const {
    data: { user: tokenUser },
  } = token
    ? await supabaseAdmin.auth.getUser(token)
    : { data: { user: null } as any };

  const {
    data: { user: cookieUser },
  } = tokenUser ? { data: { user: null } as any } : await supabase.auth.getUser();

  const user = tokenUser || cookieUser;

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/dashboard/report/${reportId}`)}`);
  }

  const { data: profile, error: profileError } = await supabaseAdmin
  .from("profiles")
  .select("company_id")
  .eq("id", user.id)
  .single();

if (profileError || !profile?.company_id) {
  return <div>Company profile not found</div>;
}

  

  const { data: report, error: reportError } = await supabaseAdmin
    .from("candidate_reports")
    .select("*")
    .eq("id", reportId)
    .eq("company_id", profile.company_id)
    .single<Report>();

  if (reportError || !report) {
    notFound();
  }

  const score = safeScore(report);
  const strengths = getArray(report.strengths);
  const weaknesses = getArray(report.weakness || report.weaknesses);
  const redFlags = getArray(report.red_flags);

  const raw =
    typeof report.raw_evaluation === "object" && report.raw_evaluation
      ? report.raw_evaluation
      : {};

  const riskLevel =
    raw.risk_level ||
    raw.risk ||
    (redFlags.length >= 4
      ? "High"
      : redFlags.length >= 2
        ? "Medium"
        : score >= 8
          ? "Low"
          : "Medium");
  const scoreBreakdown =
    raw.dimension_scores && typeof raw.dimension_scores === "object"
      ? raw.dimension_scores
      : raw.scores && typeof raw.scores === "object"
        ? raw.scores
        : raw.score_breakdown && typeof raw.score_breakdown === "object"
          ? raw.score_breakdown
          : {};

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="rounded-full border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-bold text-slate-300 hover:border-slate-600 hover:text-white"
          >
            ← Back to dashboard
          </Link>

          <div className="text-right text-xs text-slate-500">
            <p>Private company report</p>
            <p>{"Company"}</p>
          </div>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900 shadow-2xl">
          <div className="border-b border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-8">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-4">
                <p className="text-xs font-black uppercase tracking-[0.35em] text-slate-500">
                  Hireque Candidate Report
                </p>

                <div>
                  <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
                    {report.candidate_name || "Unnamed Candidate"}
                  </h1>
                  <p className="mt-2 text-slate-400">
                    {report.candidate_email || "No email saved"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Badge label={report.role || "Role missing"} />
                  <Badge label={report.level || "Level missing"} />
                  <Badge label={report.experience || "Experience missing"} />
                  <Badge label={`Risk: ${String(riskLevel)}`} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
                <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
                  <p className="text-sm font-bold text-slate-500">
                    Overall Score
                  </p>
                  <p className="mt-2 text-5xl font-black">{score}/10</p>
                </div>

                <div
                  className={`rounded-3xl border p-6 ${verdictStyle(
                    report.verdict
                  )}`}
                >
                  <p className="text-sm font-bold opacity-80">Verdict</p>
                  <p className="mt-2 text-3xl font-black">
                    {report.verdict || "No verdict"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Created" value={formatDate(report.created_at)} />
            <Metric label="Report ID" value={report.id} mono />
            <Metric
              label="Screening ID"
              value={report.screening_id || "Missing"}
              mono
            />
            <Metric label="Company Locked" value="Yes" />
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-8">
            <Panel title="Executive Summary">
              <p className="leading-7 text-slate-300">
                {raw.final_verdict_line || report.summary || raw.decision_insight || "No summary saved."}
              </p>
            </Panel>

            <Panel title="Hiring Recommendation">
              <p className="leading-7 text-slate-300">
                {report.recommendation || "No recommendation saved."}
              </p>
            </Panel>

            <Panel title="Manager Feedback">
              <p className="leading-7 text-slate-300">
                {report.feedback || "No feedback saved."}
              </p>
            </Panel>

            <Panel title="Interview Transcript">
  <div className="max-h-[620px] overflow-auto space-y-4 rounded-3xl border border-slate-800 bg-slate-950 p-5 text-sm leading-7">
    {(report.transcript || "").split(/\n+/).map((line, i) => {
      const lower = line.toLowerCase();

      const isInterviewer = lower.includes("interviewer:");
      const isCandidate = lower.includes("candidate:");

      const clean = line
        .replace(/interviewer:\s*/i, "")
        .replace(/candidate:\s*/i, "");

      return (
        <div
          key={i}
          className={`flex ${
            isCandidate ? "justify-end" : "justify-start"
          }`}
        >
          <div
            className={`max-w-[75%] rounded-2xl px-4 py-3 ${
              isCandidate
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-slate-200"
            }`}
          >
            <p className="text-xs opacity-60 mb-1">
              {isCandidate ? "Candidate" : "Interviewer"}
            </p>
            <p>{clean}</p>
          </div>
        </div>
      );
    })}
  </div>
</Panel>
          </div>

          <div className="space-y-8">
            <ListPanel
              title="Strengths"
              items={strengths}
              empty="No strengths saved."
            />
            <ListPanel
              title="Weaknesses"
              items={weaknesses}
              empty="No weaknesses saved."
            />
            <ListPanel
              title="Red Flags"
              items={redFlags}
              empty="No red flags saved."
            />

            <Panel title="Score Breakdown">
              {Object.keys(scoreBreakdown).length ? (
                <div className="space-y-3">
                  {Object.entries(scoreBreakdown).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 p-4"
                    >
                      <span className="text-sm font-bold capitalize text-slate-300">
                        {key.replaceAll("_", " ")}
                      </span>
                      <span className="text-lg font-black text-white">
                        {String(value)}/10
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500">No score breakdown saved.</p>
              )}
            </Panel>
          </div>
        </div>

        
      </div>
    </main>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-300">
      {label}
    </span>
  );
}

function Metric({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">
        {label}
      </p>
      <p
        className={`mt-3 break-all text-sm font-bold text-slate-200 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-slate-800 bg-slate-900 p-6 shadow-xl">
      <h2 className="text-xl font-black tracking-tight text-white">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ListPanel({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <section className="rounded-[2rem] border border-slate-800 bg-slate-900 p-6 shadow-xl">
      <h2 className="text-xl font-black tracking-tight text-white">{title}</h2>

      {items.length ? (
        <ul className="mt-5 space-y-3">
          {items.map((item, index) => (
            <li
              key={`${title}-${index}`}
              className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-300"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-sm text-slate-500">{empty}</p>
      )}
    </section>
  );
}