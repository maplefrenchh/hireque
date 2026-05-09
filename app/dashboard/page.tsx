"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import OpenReportLink from "@/components/OpenReportLink";
import { useSearchParams } from "next/navigation";
import HirequeLogo from "@/components/HirequeLogo";import LogoutButton from "@/components/LogoutButton";
import CopyInviteButton from "@/components/CopyInviteButton";
import ArchiveScreeningButton from "@/components/ArchiveScreeningButton";

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
  screening_attempts?: Attempt[] | null;
  attempts?: Attempt[] | null;
  candidatesCount?: number | null;
  avgScore?: number | null;
  hireReady?: number | null;
  redFlags?: number | null;
};

type Attempt = {
  id: string;
  screening_id: string;
  candidate_name?: string | null;
  score?: number | null;
  verdict?: string | null;
  red_flags?: string[] | null;
  strengths?: string[] | null;
  created_at?: string | null;
};

type DashboardResponse = {
  screenings: Screening[];
  attempts: Attempt[];
  error?: string;
};

type StatusFilter = "active" | "archived";

const HIRE_VERDICTS = new Set(["strong_hire", "hire", "lean_hire"]);
const RISK_VERDICTS = new Set(["reject", "strong_reject", "lean_reject"]);

function formatLabel(value?: string | null) {
  return String(value || "-")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function safeScore(score?: number | null) {
  const n = Number(score || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-300";
  if (score >= 65) return "text-blue-300";
  if (score >= 50) return "text-yellow-300";
  return "text-red-300";
}

function scoreRing(score: number) {
  if (score >= 80) return "border-emerald-400/30 bg-emerald-500/10";
  if (score >= 65) return "border-blue-400/30 bg-blue-500/10";
  if (score >= 50) return "border-yellow-400/30 bg-yellow-500/10";
  return "border-red-400/30 bg-red-500/10";
}

function verdictTone(verdict?: string | null) {
  if (HIRE_VERDICTS.has(verdict || "")) {
    return "border-emerald-400/25 bg-emerald-500/10 text-emerald-300";
  }

  if (verdict === "maybe") {
    return "border-yellow-400/25 bg-yellow-500/10 text-yellow-300";
  }

  return "border-red-400/25 bg-red-500/10 text-red-300";
}

function screeningName(screening: Screening) {
  if (screening.title?.trim()) return screening.title;
  return screening.role === "support"
    ? "Wireless Customer Service Screening"
    : "Wireless Sales Screening";
}

function buildInviteUrl(screening: Screening) {
  const params = new URLSearchParams();

  if (screening.role) params.set("role", screening.role);
  if (screening.level) params.set("level", screening.level);
  if (screening.experience) params.set("experience", screening.experience);
  if (screening.scenario_seed) params.set("seed", screening.scenario_seed);

  const query = params.toString();
  return `/interview/${screening.id}${query ? `?${query}` : ""}`;
}

async function readJsonSafe(res: Response) {
  const text = await res.text();

  try {
    return JSON.parse(text) as DashboardResponse;
  } catch {
    throw new Error(
      `API returned non-JSON. Status ${res.status}. Response: ${text.slice(0, 220)}`
    );
  }
}

function normalizeAttempts(data: DashboardResponse) {
  if (Array.isArray(data.attempts) && data.attempts.length > 0) {
    return data.attempts;
  }

  const nested: Attempt[] = [];

  for (const screening of data.screenings || []) {
    const screeningAttempts = screening.screening_attempts || screening.attempts || [];

    for (const attempt of screeningAttempts) {
      if (!attempt?.id) continue;

      nested.push({
        ...attempt,
        id: attempt.id,
        screening_id: attempt.screening_id || screening.id,
      });
    }
  }

  return nested;
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#050914] px-6 py-10 text-white">
          <div className="mx-auto max-w-7xl rounded-2xl border border-white/10 bg-white/[0.04] p-10 text-center text-slate-400">
            Loading dashboard...
          </div>
        </main>
      }
    >
      <DashboardInner />
    </Suspense>
  );
}

function DashboardInner() {
  const searchParams = useSearchParams();
  const statusFilter: StatusFilter =
    searchParams.get("status") === "archived" ? "archived" : "active";

  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const token = localStorage.getItem("hireque_access_token");

        if (!token) {
          if (!cancelled) {
            setError("Session missing. Log in again.");
            setLoading(false);
          }
          return;
        }

        const res = await fetch(`/api/dashboard?status=${statusFilter}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        const data = await readJsonSafe(res);

        if (!res.ok) {
          if (res.status === 401 || data.error === "Invalid session") {
            
            window.location.href = "/login";
            return;
          }

          throw new Error(data.error || "Failed to load dashboard.");
        }

        if (!cancelled) {
          const normalizedScreenings = Array.isArray(data.screenings) ? data.screenings : [];
          setScreenings(normalizedScreenings);
          setAttempts(normalizeAttempts({ ...data, screenings: normalizedScreenings }));
        }
      } catch (err) {
        console.error("Dashboard load error:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load dashboard.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  const attemptsByScreening = useMemo(() => {
    const map: Record<string, Attempt[]> = {};

    for (const attempt of attempts) {
      if (!attempt.screening_id) continue;
      if (!map[attempt.screening_id]) map[attempt.screening_id] = [];
      map[attempt.screening_id].push(attempt);
    }

    for (const key of Object.keys(map)) {
      map[key].sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
      );
    }

    return map;
  }, [attempts]);

  const totalCandidates = attempts.length;
  const totalScreenings = screenings.length;

  const avgScore = useMemo(() => {
    if (!attempts.length) return 0;
    return Math.round(
      attempts.reduce((sum, attempt) => sum + safeScore(attempt.score), 0) /
        attempts.length
    );
  }, [attempts]);

  const hireReadyCount = useMemo(
    () => attempts.filter((a) => HIRE_VERDICTS.has(a.verdict || "")).length,
    [attempts]
  );

  const riskCount = useMemo(
    () =>
      attempts.filter(
        (a) => RISK_VERDICTS.has(a.verdict || "") || (a.red_flags?.length || 0) > 0
      ).length,
    [attempts]
  );

  const topCandidates = useMemo(
    () =>
      [...attempts]
        .sort((a, b) => safeScore(b.score) - safeScore(a.score))
        .slice(0, 4),
    [attempts]
  );

  const recentAttempts = useMemo(
    () =>
      [...attempts]
        .sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime()
        )
        .slice(0, 5),
    [attempts]
  );

  return (
    <main className="min-h-screen bg-[#050914] text-white">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <HirequeLogo />

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full border border-white/10 px-5 py-3 text-sm font-bold text-slate-300 hover:bg-white/10"
            >
              ← Back to Home
            </Link>

            <LogoutButton />

            <Link
              href="/dashboard?status=active"
              className={`rounded-full px-5 py-3 text-sm font-bold ${
                statusFilter === "active"
                  ? "bg-white text-slate-950"
                  : "border border-white/10 text-slate-300 hover:bg-white/10"
              }`}
            >
              Active
            </Link>

            <Link
              href="/dashboard?status=archived"
              className={`rounded-full px-5 py-3 text-sm font-bold ${
                statusFilter === "archived"
                  ? "bg-white text-slate-950"
                  : "border border-white/10 text-slate-300 hover:bg-white/10"
              }`}
            >
              Archived
            </Link>

            <Link
              href="/dashboard/new"
              className="rounded-full bg-blue-600 px-6 py-3 text-sm font-black hover:bg-blue-500"
            >
              Create screening
            </Link>
          </div>
        </header>

        <section className="mt-10 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl">
          <div className="grid gap-8 p-8 lg:grid-cols-[1.4fr_0.8fr] lg:p-10">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.28em] text-blue-300">
                Hiring Command Center
              </p>

              <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight md:text-5xl">
                Wireless hiring pipeline, scored by real roleplay evidence.
              </h1>

              <p className="mt-4 max-w-3xl text-slate-400">
                Manage screening links, review candidate outcomes, spot red flags,
                and move only the strongest sales or support reps forward.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-[#0B1220] p-5">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
                Pipeline health
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <MetricCard label="Screenings" value={totalScreenings} />
                <MetricCard label="Candidates" value={totalCandidates} />
                <MetricCard label="Avg Score" value={avgScore} suffix="/100" />
                <MetricCard label="Hire Ready" value={hireReadyCount} />
              </div>

              {riskCount > 0 && (
                <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
                  {riskCount} candidate{riskCount === 1 ? "" : "s"} need risk review.
                </div>
              )}
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-5 font-semibold text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <LoadingState />
        ) : (
          <>
            {statusFilter === "active" && topCandidates.length > 0 && (
              <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
                <div className="rounded-[2rem] border border-emerald-400/15 bg-emerald-500/[0.04] p-7">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
                        Top candidates
                      </p>
                      <p className="mt-2 text-sm text-slate-400">
                        Highest scores across active screenings.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {topCandidates.map((candidate, index) => {
                      const score = safeScore(candidate.score);
                      return (
                        <Link
                          key={candidate.id}
                          href={`/dashboard/report/${candidate.id}`}
                          className={`rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:bg-white/[0.06] ${scoreRing(
                            score
                          )}`}
                        >
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                            Rank #{index + 1}
                          </p>

                          <h3 className="mt-2 truncate text-lg font-black">
                            {candidate.candidate_name || "Unnamed Candidate"}
                          </h3>

                          <p className={`mt-3 text-4xl font-black ${scoreTone(score)}`}>
                            {score}
                          </p>

                          <span
                            className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${verdictTone(
                              candidate.verdict
                            )}`}
                          >
                            {formatLabel(candidate.verdict)}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <RecentAttempts attempts={recentAttempts} />
              </section>
            )}

            <section className="mt-6">
              {screenings.length === 0 ? (
                <EmptyState statusFilter={statusFilter} />
              ) : (
                <div className="grid gap-5">
                  {screenings.map((screening) => {
                    const screeningAttempts =
                      attemptsByScreening[screening.id] ||
                      screening.screening_attempts ||
                      screening.attempts ||
                      [];
                    const candidateCount = screeningAttempts.length;
                    const avg = candidateCount
                      ? Math.round(
                          screeningAttempts.reduce(
                            (sum, attempt) => sum + safeScore(attempt.score),
                            0
                          ) / candidateCount
                        )
                      : 0;

                    const topCandidate = [...screeningAttempts].sort(
                      (a, b) => safeScore(b.score) - safeScore(a.score)
                    )[0];

                    const redFlagCount = screeningAttempts.reduce(
                      (sum, attempt) => sum + (attempt.red_flags?.length || 0),
                      0
                    );

                    const hireReady = screeningAttempts.filter((attempt) =>
                      HIRE_VERDICTS.has(attempt.verdict || "")
                    ).length;

                    const inviteUrl = buildInviteUrl(screening);

                    return (
                      <article
                        key={screening.id}
                        className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl"
                      >
                        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge>{formatLabel(screening.status || statusFilter)}</Badge>
                              <Badge tone="blue">
                                {formatLabel(screening.industry || "wireless")}
                              </Badge>
                              {hireReady > 0 && <Badge tone="green">{hireReady} hire ready</Badge>}
                              {redFlagCount > 0 && (
                                <Badge tone="red">{redFlagCount} red flags</Badge>
                              )}
                            </div>

                            <h2 className="mt-4 text-2xl font-black">
                              {screeningName(screening)}
                            </h2>

                            <div className="mt-4 flex flex-wrap gap-2 text-sm">
                              <Pill>{formatLabel(screening.role)}</Pill>
                              <Pill>{formatLabel(screening.level)}</Pill>
                              <Pill>{formatLabel(screening.experience)}</Pill>
                              <Pill>Created {formatDate(screening.created_at)}</Pill>
                            </div>

                            <div className="mt-5 grid gap-4 md:grid-cols-4">
                              <SmallStat label="Candidates" value={candidateCount} />
                              <SmallStat label="Avg Score" value={avg ? `${avg}/100` : "-"} />
                              <SmallStat label="Hire Ready" value={hireReady} />
                              <SmallStat label="Red Flags" value={redFlagCount} />
                            </div>

                            {topCandidate ? (
                              <div className="mt-5 rounded-2xl border border-white/10 bg-[#0B1220] p-4">
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                                  Best result so far
                                </p>

                                <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                                  <div className="min-w-0">
                                    <p className="truncate font-black">
                                      {topCandidate.candidate_name || "Unnamed Candidate"}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-400">
                                      {formatLabel(topCandidate.verdict)} Â· Submitted {formatDate(topCandidate.created_at)}
                                    </p>
                                  </div>

                                  <Link
                                    href={`/dashboard/report/${topCandidate.id}`}
                                    className={`rounded-full border px-4 py-2 text-sm font-black ${verdictTone(
                                      topCandidate.verdict
                                    )}`}
                                  >
                                    Score {safeScore(topCandidate.score)}
                                  </Link>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-[#0B1220]/60 p-4 text-sm text-slate-400">
                                No candidates yet. Copy the invite link and send it to applicants.
                              </div>
                            )}
                          </div>

                          <aside className="flex flex-col justify-center gap-3 rounded-[1.5rem] border border-white/10 bg-[#0B1220] p-5">
                            <CopyInviteButton inviteUrl={inviteUrl} />

                            <Link
                              href={`/dashboard/screening/${screening.id}`}
                              className="rounded-full bg-blue-600 px-4 py-3 text-center text-sm font-black hover:bg-blue-500"
                            >
                              View ranked list
                            </Link>
<ArchiveScreeningButton screeningId={screening.id} status={screening.status || statusFilter} />

                            {topCandidate && (
                              <OpenReportLink reportId={topCandidate.id} className="rounded-full border border-white/10 px-4 py-3 text-center text-sm font-black text-slate-200 hover:bg-white/10">
                                Open top report
                              </OpenReportLink>
                            )}

                            
                          </aside>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function LoadingState() {
  return (
    <div className="mt-6 grid gap-5">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-48 animate-pulse rounded-[2rem] border border-white/10 bg-white/[0.04]"
        />
      ))}
    </div>
  );
}

function EmptyState({ statusFilter }: { statusFilter: StatusFilter }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-10 text-center">
      <p className="text-2xl font-black">
        {statusFilter === "archived" ? "No archived screenings." : "No active screenings."}
      </p>
      <p className="mx-auto mt-3 max-w-xl text-slate-400">
        {statusFilter === "archived"
          ? "Archived screenings will appear here after you close old hiring campaigns."
          : "Create your first wireless sales or support screening and send the candidate invite link."}
      </p>
      {statusFilter === "active" && (
        <Link
          href="/dashboard/new"
          className="mt-6 inline-flex rounded-full bg-blue-600 px-6 py-3 font-black hover:bg-blue-500"
        >
          Create screening
        </Link>
      )}
    </div>
  );
}

function RecentAttempts({ attempts }: { attempts: Attempt[] }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7">
      <p className="text-sm font-black uppercase tracking-[0.25em] text-blue-300">
        Recent reports
      </p>

      <div className="mt-5 space-y-3">
        {attempts.map((attempt) => (
          <Link
            key={attempt.id}
            href={`/dashboard/report/${attempt.id}`}
            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0B1220] p-4 hover:bg-white/[0.06]"
          >
            <div className="min-w-0">
              <p className="truncate font-black">
                {attempt.candidate_name || "Unnamed Candidate"}
              </p>
              <p className="mt-1 text-xs text-slate-500">{formatDate(attempt.created_at)}</p>
            </div>
            <div className="text-right">
              <p className={`text-lg font-black ${scoreTone(safeScore(attempt.score))}`}>
                {safeScore(attempt.score)}
              </p>
              <p className="text-xs text-slate-500">{formatLabel(attempt.verdict)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black">
        {value}
        <span className="text-base text-slate-500">{suffix}</span>
      </p>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 truncate text-lg font-black">{value}</p>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-slate-400">
      {children}
    </span>
  );
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "blue" | "green" | "red";
}) {
  const toneClass = {
    neutral: "border-white/10 bg-[#0B1220] text-slate-400",
    blue: "border-blue-400/15 bg-blue-500/10 text-blue-300",
    green: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300",
    red: "border-red-400/20 bg-red-500/10 text-red-300",
  }[tone];

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${toneClass}`}>
      {children}
    </span>
  );
}












