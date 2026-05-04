"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import HirequeLogo from "@/components/HirequeLogo";
import CopyInviteButton from "@/components/CopyInviteButton";

type Screening = {
  id: string;
  title?: string | null;
  role?: string | null;
  level?: string | null;
  experience?: string | null;
  industry?: string | null;
  scenario_seed?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type Attempt = {
  id: string;
  screening_id: string;
  candidate_name?: string | null;
  candidate_email?: string | null;
  role?: string | null;
  level?: string | null;
  experience?: string | null;
  score?: number | null;
  verdict?: string | null;
  summary?: string | null;
  recommendation?: string | null;
  strengths?: string[] | null;
  weaknesses?: string[] | null;
  red_flags?: string[] | null;
  dimension_scores?: Record<string, number> | null;
  phase_scores?: Record<string, number> | null;
  hiring_risk?: string | null;
  interview_quality?: string | null;
  created_at?: string | null;
};

type ApiResponse = {
  screening?: Screening;
  attempts?: Attempt[];
  error?: string;
};

type FilterState = {
  verdict: string;
  score: string;
  risk: string;
  sort: string;
};

function formatLabel(value?: string | null) {
  return String(value || "-")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function safeDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-300";
  if (score >= 65) return "text-blue-300";
  if (score >= 50) return "text-yellow-300";
  return "text-red-300";
}

function scoreBorder(score: number) {
  if (score >= 80) return "border-emerald-400/25 bg-emerald-500/10";
  if (score >= 65) return "border-blue-400/25 bg-blue-500/10";
  if (score >= 50) return "border-yellow-400/25 bg-yellow-500/10";
  return "border-red-400/25 bg-red-500/10";
}

function verdictStyle(verdict?: string | null) {
  const v = verdict || "";

  if (["strong_hire", "hire"].includes(v)) {
    return "border-emerald-400/25 bg-emerald-500/10 text-emerald-300";
  }

  if (v === "lean_hire") {
    return "border-blue-400/25 bg-blue-500/10 text-blue-300";
  }

  if (v === "lean_reject") {
    return "border-yellow-400/25 bg-yellow-500/10 text-yellow-300";
  }

  return "border-red-400/25 bg-red-500/10 text-red-300";
}

function decisionText(verdict?: string | null) {
  const v = verdict || "";
  if (["strong_hire", "hire"].includes(v)) return "Advance";
  if (v === "lean_hire") return "Review";
  if (v === "lean_reject") return "Risky";
  return "Reject";
}

function averageScore(scores?: Record<string, number> | null) {
  if (!scores) return 0;

  const values = Object.values(scores).filter((v) => Number.isFinite(Number(v)));

  if (!values.length) return 0;

  return Math.round(values.reduce((sum, v) => sum + Number(v), 0) / values.length);
}

function getBucket(score: number) {
  if (score >= 75) return "top";
  if (score >= 50) return "middle";
  return "low";
}

function getCandidateName(attempt: Attempt) {
  return attempt.candidate_name?.trim() || "Unnamed Candidate";
}

function getPrimarySummary(attempt: Attempt) {
  return (
    attempt.summary?.trim() ||
    attempt.recommendation?.trim() ||
    "No summary saved for this attempt. Open the full report to inspect the transcript and raw scoring."
  );
}

function matchesVerdictFilter(attempt: Attempt, filter: string) {
  if (filter === "all") return true;

  if (filter === "advance") {
    return ["strong_hire", "hire", "lean_hire"].includes(attempt.verdict || "");
  }

  if (filter === "reject") {
    return ["lean_reject", "reject", "strong_reject"].includes(attempt.verdict || "");
  }

  return attempt.verdict === filter;
}

function matchesScoreFilter(attempt: Attempt, filter: string) {
  if (filter === "all") return true;
  return getBucket(Number(attempt.score || 0)) === filter;
}

function matchesRiskFilter(attempt: Attempt, filter: string) {
  if (filter === "all") return true;

  if (filter === "red_flags") {
    return Boolean(attempt.red_flags && attempt.red_flags.length > 0);
  }

  if (filter === "clean") {
    return !attempt.red_flags || attempt.red_flags.length === 0;
  }

  return attempt.hiring_risk === filter;
}

function sortAttempts(attempts: Attempt[], sort: string) {
  const copy = [...attempts];

  if (sort === "oldest") {
    return copy.sort(
      (a, b) =>
        new Date(a.created_at || 0).getTime() -
        new Date(b.created_at || 0).getTime()
    );
  }

  if (sort === "newest") {
    return copy.sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
    );
  }

  if (sort === "red_flags") {
    return copy.sort((a, b) => (b.red_flags?.length || 0) - (a.red_flags?.length || 0));
  }

  return copy.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
}

function buildInvitePath(screening: Screening | null) {
  if (!screening) return "";

  const params = new URLSearchParams({
    role: screening.role || "sales",
    level: screening.level || "rep",
    experience: screening.experience || "newcomer",
    seed: screening.scenario_seed || "",
  });

  return `/interview/${screening.id}?${params.toString()}`;
}

function buildFilterHref(base: string, current: FilterState, field: keyof FilterState, value: string) {
  const next = { ...current, [field]: value };
  const params = new URLSearchParams(next);
  return `${base}?${params.toString()}`;
}

export default function ScreeningCandidatesPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const screeningId = params.id;

  const verdictFilter = searchParams.get("verdict") || "all";
  const scoreFilter = searchParams.get("score") || "all";
  const riskFilter = searchParams.get("risk") || "all";
  const sort = searchParams.get("sort") || "score";

  const [screening, setScreening] = useState<Screening | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadScreening = async (silent = false) => {
    if (!silent) setLoading(true);
    if (silent) setRefreshing(true);
    setError("");

    try {
      const token = localStorage.getItem("hireque_access_token");

      if (!token) {
        setError("Session missing. Log in again.");
        return;
      }

      const res = await fetch(`/api/dashboard/screening/${screeningId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const data = (await res.json()) as ApiResponse;

      if (!res.ok) {
        setError(data.error || "Failed to load screening.");
        return;
      }

      setScreening(data.screening || null);
      setAttempts(data.attempts || []);
    } catch (err) {
      console.error("Screening load error:", err);
      setError("Failed to load screening.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadScreening(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screeningId]);

  const currentFilters: FilterState = {
    verdict: verdictFilter,
    score: scoreFilter,
    risk: riskFilter,
    sort,
  };

  const filteredAttempts = useMemo(
    () =>
      sortAttempts(
        attempts
          .filter((a) => matchesVerdictFilter(a, verdictFilter))
          .filter((a) => matchesScoreFilter(a, scoreFilter))
          .filter((a) => matchesRiskFilter(a, riskFilter)),
        sort
      ),
    [attempts, verdictFilter, scoreFilter, riskFilter, sort]
  );

  const total = attempts.length;

  const avgScore =
    total > 0
      ? Math.round(attempts.reduce((sum, a) => sum + Number(a.score || 0), 0) / total)
      : 0;

  const advanceCount = attempts.filter((a) =>
    ["strong_hire", "hire", "lean_hire"].includes(a.verdict || "")
  ).length;

  const rejectCount = attempts.filter((a) =>
    ["lean_reject", "reject", "strong_reject"].includes(a.verdict || "")
  ).length;

  const redFlagCount = attempts.reduce((sum, a) => sum + (a.red_flags?.length || 0), 0);

  const highRiskCount = attempts.filter((a) =>
    ["high", "severe"].includes(a.hiring_risk || "")
  ).length;

  const topCandidates = [...attempts]
    .filter((a) => Number(a.score || 0) > 0)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 3);

  const inviteUrl = buildInvitePath(screening);
  const base = `/dashboard/screening/${screeningId}`;

  return (
    <main className="min-h-screen bg-[#050914] text-white">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <HirequeLogo />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void loadScreening(true)}
              disabled={refreshing || loading}
              className="rounded-full border border-white/10 px-5 py-3 text-sm font-bold text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <Link
              href="/dashboard"
              className="rounded-full border border-white/10 px-5 py-3 text-sm font-bold text-slate-300 hover:bg-white/10"
            >
              Back to dashboard
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-5 text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-10 text-center text-slate-400">
            Loading screening...
          </div>
        ) : !screening ? (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-10 text-center">
            <h1 className="text-2xl font-black">Screening not found</h1>
            <p className="mt-3 text-slate-400">
              This screening either does not exist or your company account cannot access it.
            </p>
          </div>
        ) : (
          <>
            <section className="mt-10 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl">
              <div className="border-b border-white/10 bg-gradient-to-br from-blue-500/15 via-transparent to-emerald-500/10 p-8">
                <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-300">
                  Screening Command Center
                </p>

                <div className="mt-4 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
                  <div>
                    <h1 className="max-w-4xl text-4xl font-black tracking-tight md:text-5xl">
                      {screening.title || "Candidate Results"}
                    </h1>

                    <div className="mt-4 flex flex-wrap gap-2 text-sm">
                      <Badge>{formatLabel(screening.role)}</Badge>
                      <Badge>{formatLabel(screening.level)}</Badge>
                      <Badge>{formatLabel(screening.experience)}</Badge>
                      <Badge>{formatLabel(screening.industry || "wireless")}</Badge>
                      <Badge>{formatLabel(screening.status || "active")}</Badge>
                      <Badge>Created {safeDate(screening.created_at)}</Badge>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:min-w-[280px]">
                    {inviteUrl && <CopyInviteButton inviteUrl={inviteUrl} />}
                    <p className="text-xs leading-5 text-slate-500">
                      Share this link with candidates. Every completed attempt appears below with report access.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 p-6 md:grid-cols-6">
                <MetricCard label="Candidates" value={total} />
                <MetricCard label="Avg Score" value={avgScore} tone={scoreBorder(avgScore)} />
                <MetricCard label="Advance" value={advanceCount} tone="border-emerald-400/20 bg-emerald-500/10" />
                <MetricCard label="Reject" value={rejectCount} tone="border-red-400/20 bg-red-500/10" />
                <MetricCard label="Red Flags" value={redFlagCount} tone="border-red-400/20 bg-red-500/10" />
                <MetricCard label="High Risk" value={highRiskCount} tone="border-yellow-400/20 bg-yellow-500/10" />
              </div>
            </section>

            {total === 0 ? (
              <section className="mt-6 rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] p-10 text-center">
                <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-300">
                  No candidates yet
                </p>
                <h2 className="mt-3 text-3xl font-black">Send the invite link first.</h2>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-400">
                  Once candidates complete the wireless simulation, their scores, verdicts, risks, and full reports will show here.
                </p>
                {inviteUrl && (
                  <div className="mt-6 flex justify-center">
                    <CopyInviteButton inviteUrl={inviteUrl} />
                  </div>
                )}
              </section>
            ) : (
              <>
                {topCandidates.length > 0 && (
                  <section className="mt-6 rounded-[2rem] border border-emerald-400/15 bg-emerald-500/[0.04] p-7">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-300">
                          Best Candidates
                        </p>
                        <h2 className="mt-2 text-2xl font-black">Top 3 by score</h2>
                      </div>
                      <p className="text-sm text-slate-400">
                        Score alone is not enough. Check red flags before advancing anyone.
                      </p>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-3">
                      {topCandidates.map((candidate, index) => {
                        const score = Number(candidate.score || 0);
                        const flags = candidate.red_flags?.length || 0;

                        return (
                          <Link
                            key={candidate.id}
                            href={`/dashboard/report/${candidate.id}`}
                            className="rounded-2xl border border-white/10 bg-[#0B1220] p-5 transition hover:-translate-y-0.5 hover:bg-white/[0.06]"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                                Rank #{index + 1}
                              </p>
                              <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${verdictStyle(candidate.verdict)}`}>
                                {formatLabel(candidate.verdict)}
                              </span>
                            </div>

                            <h3 className="mt-3 truncate text-lg font-black">
                              {getCandidateName(candidate)}
                            </h3>

                            <p className={`mt-4 text-5xl font-black ${scoreTone(score)}`}>{score}</p>

                            <p className="mt-3 text-sm text-slate-400">
                              {flags > 0 ? `${flags} red flag${flags > 1 ? "s" : ""}` : "No red flags logged"}
                            </p>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                )}

                <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-300">
                        Filters
                      </p>
                      <p className="mt-2 text-sm text-slate-400">
                        Showing {filteredAttempts.length} of {total} candidates.
                      </p>
                    </div>

                    <Link
                      href={base}
                      className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-white/10"
                    >
                      Clear filters
                    </Link>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-4">
                    <FilterGroup
                      label="Verdict"
                      base={base}
                      current={currentFilters}
                      field="verdict"
                      options={[
                        ["all", "All"],
                        ["advance", "Advance"],
                        ["reject", "Reject"],
                        ["strong_hire", "Strong Hire"],
                        ["hire", "Hire"],
                        ["lean_hire", "Lean Hire"],
                        ["lean_reject", "Lean Reject"],
                        ["reject", "Reject"],
                        ["strong_reject", "Strong Reject"],
                      ]}
                    />

                    <FilterGroup
                      label="Score"
                      base={base}
                      current={currentFilters}
                      field="score"
                      options={[
                        ["all", "All"],
                        ["top", "75+"],
                        ["middle", "50–74"],
                        ["low", "0–49"],
                      ]}
                    />

                    <FilterGroup
                      label="Risk"
                      base={base}
                      current={currentFilters}
                      field="risk"
                      options={[
                        ["all", "All"],
                        ["red_flags", "Red Flags"],
                        ["clean", "Clean"],
                        ["low", "Low"],
                        ["medium", "Medium"],
                        ["high", "High"],
                        ["severe", "Severe"],
                      ]}
                    />

                    <FilterGroup
                      label="Sort"
                      base={base}
                      current={currentFilters}
                      field="sort"
                      options={[
                        ["score", "Best Score"],
                        ["newest", "Newest"],
                        ["oldest", "Oldest"],
                        ["red_flags", "Most Flags"],
                      ]}
                    />
                  </div>
                </section>

                <section className="mt-6 pb-10">
                  {filteredAttempts.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-10 text-center text-slate-400">
                      No candidates match these filters.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredAttempts.map((candidate, index) => {
                        const score = Number(candidate.score || 0);
                        const skillAvg = averageScore(candidate.dimension_scores);
                        const phaseAvg = averageScore(candidate.phase_scores);
                        const flags = candidate.red_flags || [];
                        const strengths = candidate.strengths || [];
                        const weaknesses = candidate.weaknesses || [];

                        return (
                          <article
                            key={candidate.id}
                            className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl transition hover:border-white/20 hover:bg-white/[0.055]"
                          >
                            <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                              <div>
                                <div className="flex flex-wrap gap-2">
                                  <span className="rounded-full border border-white/10 bg-[#0B1220] px-3 py-1 text-xs font-bold text-slate-400">
                                    #{index + 1}
                                  </span>

                                  <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${verdictStyle(candidate.verdict)}`}>
                                    {decisionText(candidate.verdict)} · {formatLabel(candidate.verdict)}
                                  </span>

                                  {flags.length > 0 && (
                                    <span className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300">
                                      {flags.length} red flag{flags.length > 1 ? "s" : ""}
                                    </span>
                                  )}

                                  {candidate.hiring_risk && (
                                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-400">
                                      Risk: {formatLabel(candidate.hiring_risk)}
                                    </span>
                                  )}

                                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-500">
                                    {safeDate(candidate.created_at)}
                                  </span>
                                </div>

                                <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                                  <div>
                                    <h2 className="text-2xl font-black">{getCandidateName(candidate)}</h2>
                                    <p className="mt-1 text-sm text-slate-500">{candidate.candidate_email || "No email saved"}</p>
                                  </div>
                                </div>

                                <p className="mt-5 max-w-4xl text-sm leading-7 text-slate-300">
                                  {getPrimarySummary(candidate)}
                                </p>

                                <div className="mt-5 grid gap-4 md:grid-cols-3">
                                  <SmallStat label="Skill Avg" value={`${skillAvg}/10`} />
                                  <SmallStat label="Phase Avg" value={`${phaseAvg}/10`} />
                                  <SmallStat label="Quality" value={formatLabel(candidate.interview_quality)} />
                                </div>

                                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                                  <InsightBox
                                    title="Strength"
                                    tone="emerald"
                                    text={strengths[0] || "No clear strength captured."}
                                  />
                                  <InsightBox
                                    title="Weakness"
                                    tone="yellow"
                                    text={weaknesses[0] || "No weakness captured."}
                                  />
                                  <InsightBox
                                    title="Main Risk"
                                    tone={flags.length ? "red" : "slate"}
                                    text={flags[0] || "No red flag logged."}
                                  />
                                </div>
                              </div>

                              <div className="rounded-[1.5rem] border border-white/10 bg-[#0B1220] p-5">
                                <div className={`rounded-2xl border p-5 text-center ${scoreBorder(score)}`}>
                                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Overall Score</p>
                                  <p className={`mt-2 text-6xl font-black ${scoreTone(score)}`}>{score}</p>
                                  <p className="mt-2 text-sm font-bold text-slate-300">{decisionText(candidate.verdict)}</p>
                                </div>

                                <Link
                                  href={`/dashboard/report/${candidate.id}`}
                                  className="mt-5 block rounded-full bg-blue-600 px-5 py-3 text-center text-sm font-bold hover:bg-blue-500"
                                >
                                  View full report
                                </Link>

                                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-6 text-slate-400">
                                  Decision rule: review score, red flags, and transcript evidence. Do not advance only because the score is high.
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-slate-300">
      {children}
    </span>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className={`rounded-2xl border p-5 ${tone || "border-white/10 bg-[#0B1220]"}`}>
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-4xl font-black">{value}</p>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 truncate text-lg font-black">{value}</p>
    </div>
  );
}

function InsightBox({
  title,
  text,
  tone,
}: {
  title: string;
  text: string;
  tone: "emerald" | "yellow" | "red" | "slate";
}) {
  const tones: Record<typeof tone, string> = {
    emerald: "border-emerald-400/15 bg-emerald-500/[0.04] text-emerald-300",
    yellow: "border-yellow-400/15 bg-yellow-500/[0.04] text-yellow-300",
    red: "border-red-400/15 bg-red-500/[0.04] text-red-300",
    slate: "border-white/10 bg-white/[0.03] text-slate-300",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-90">{title}</p>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-300">{text}</p>
    </div>
  );
}

function FilterGroup({
  label,
  base,
  current,
  field,
  options,
}: {
  label: string;
  base: string;
  current: FilterState;
  field: keyof FilterState;
  options: [string, string][];
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {options.map(([value, text], index) => {
          const href = buildFilterHref(base, current, field, value);
          const active = current[field] === value;

          return (
            <Link
              key={`${field}-${value}-${index}`}
              href={href}
              className={`rounded-full px-3 py-2 text-xs font-bold ${
                active
                  ? "bg-blue-600 text-white"
                  : "border border-white/10 text-slate-400 hover:bg-white/10"
              }`}
            >
              {text}
            </Link>
          );
        })}
      </div>
    </div>
  );
}