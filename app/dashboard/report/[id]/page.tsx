  import Link from "next/link";
  import { createClient } from "@supabase/supabase-js";
  import type { ReactNode } from "react";
  import HirequeLogo from "@/components/HirequeLogo";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  type TranscriptMessage = {
    sender?: "interviewer" | "customer" | "candidate" | string;
    text?: string;
    phase?: string;
    topic?: string;
    followUp?: boolean;
  };

  type Evidence = {
    bestMoment?: string;
    worstMoment?: string;
    decisionReason?: string;
    hiringSummary?: string;
    keyEvidence?: string[];
    transcriptEvidence?: string[];
    scoreRationale?: string;
  };

  type Attempt = {
    id: string;
    screening_id: string;
    candidate_name?: string | null;
    candidate_email?: string | null;
    role?: string | null;
    level?: string | null;
    experience?: string | null;
    seed?: string | null;
    status?: string | null;
    score?: number | null;
    verdict?: string | null;
    summary?: string | null;
    recommendation?: string | null;
    strengths?: string[] | null;
    weaknesses?: string[] | null;
    red_flags?: string[] | null;
    dimension_scores?: Record<string, number> | null;
    phase_scores?: Record<string, number> | null;
    transcript?: TranscriptMessage[] | null;
    evidence?: Evidence | null;
    hiring_risk?: string | null;
    interview_quality?: string | null;
    created_at?: string | null;
  };

  function formatLabel(value?: string | null) {
    const raw = String(value || "-").trim();
    if (!raw || raw === "-") return "-";

    return raw
      .replaceAll("_", " ")
      .replaceAll("-", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function clamp(value: number, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeOverallScore(value?: number | null) {
    const score = Number(value ?? 0);
    if (!Number.isFinite(score)) return 0;
    return Math.round(clamp(score));
  }

  function normalizeRubricScore(value: number) {
    if (!Number.isFinite(value)) return 0;
    return Math.round(clamp(value, 0, 10));
  }

  function verdictLabel(value?: string | null) {
    return formatLabel(value).toUpperCase();
  }

  function decisionText(verdict?: string | null) {
    if (verdict === "strong_hire") return "Strong Advance";
    if (verdict === "hire") return "Advance";
    if (verdict === "lean_hire" || verdict === "maybe") return "Maybe";
    if (verdict === "lean_reject") return "Do Not Advance";
    if (verdict === "strong_reject") return "Hard Reject";
    return "Reject";
  }

  function decisionStyle(verdict?: string | null) {
    if (verdict === "strong_hire" || verdict === "hire") {
      return "border-emerald-400/25 bg-emerald-500/10 text-emerald-300";
    }

    if (verdict === "lean_hire" || verdict === "maybe") {
      return "border-blue-400/25 bg-blue-500/10 text-blue-300";
    }

    if (verdict === "lean_reject") {
      return "border-yellow-400/25 bg-yellow-500/10 text-yellow-300";
    }

    return "border-red-400/25 bg-red-500/10 text-red-300";
  }

  function scoreStyle(score: number) {
    if (score >= 85) return "border-emerald-400/25 bg-emerald-500/10 text-emerald-300";
    if (score >= 75) return "border-blue-400/25 bg-blue-500/10 text-blue-300";
    if (score >= 65) return "border-cyan-400/25 bg-cyan-500/10 text-cyan-300";
    if (score >= 50) return "border-yellow-400/25 bg-yellow-500/10 text-yellow-300";
    if (score >= 35) return "border-orange-400/25 bg-orange-500/10 text-orange-300";
    return "border-red-400/25 bg-red-500/10 text-red-300";
  }

  function riskStyle(risk?: string | null) {
    const value = String(risk || "").toLowerCase();

    if (value.includes("low")) return "border-emerald-400/20 bg-emerald-500/10 text-emerald-300";
    if (value.includes("medium") || value.includes("moderate")) {
      return "border-yellow-400/20 bg-yellow-500/10 text-yellow-300";
    }
    if (value.includes("high") || value.includes("severe")) {
      return "border-red-400/20 bg-red-500/10 text-red-300";
    }

    return "border-white/10 bg-white/[0.04] text-slate-300";
  }

  function safeArray(value: unknown): string[] {
    return Array.isArray(value) ? value.map(String).map((v) => v.trim()).filter(Boolean) : [];
  }

  function safeObject(value: unknown): Record<string, number> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, val]) => [key, normalizeRubricScore(Number(val))] as const)
        .filter(([, val]) => Number.isFinite(val))
    );
  }

  function safeTranscript(value: unknown): TranscriptMessage[] {
    if (!Array.isArray(value)) return [];

    return value
      .map((item) => (item && typeof item === "object" ? (item as TranscriptMessage) : null))
      .filter(Boolean) as TranscriptMessage[];
  }

  function avgScore(scores: Record<string, number>) {
    const values = Object.values(scores).filter((value) => Number.isFinite(value));
    if (!values.length) return 0;

    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }

  function formatDate(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function buildDefaultScores(role?: string | null) {
    const base =
      role === "support"
        ? [
            "customer_control",
            "problem_diagnosis",
            "resolution_quality",
            "communication",
            "professionalism",
            "de_escalation",
          ]
        : [
            "discovery",
            "recommendation",
            "objection_handling",
            "closing",
            "communication",
            "professionalism",
          ];

    return Object.fromEntries(base.map((key) => [key, 0]));
  }

  function mergeScores(primary: Record<string, number>, fallback: Record<string, number>) {
    return Object.keys(primary).length ? primary : fallback;
  }

  export default async function CandidateReportPage({
    params,
  }: {
    params: Promise<{ id: string }> | { id: string };
  }) {
    const resolvedParams = await params;
    const reportId = resolvedParams.id;

    const { data: attempt, error } = await supabase
  .from("screening_attempts")
  .select("*")
  .eq("id", reportId)
  .single<Attempt>();

    if (error) {
    console.error("Report fetch error:", JSON.stringify(error, null, 2));
  }

  if (!attempt) {
      console.error("Report fetch error:", error);

      return (
        <main className="min-h-screen bg-[#050914] px-6 py-10 text-white">
          <div className="mx-auto max-w-5xl">
            <HirequeLogo />

            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.04] p-10 text-center shadow-2xl">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-red-300">
                Missing Report
              </p>
              <h1 className="mt-3 text-3xl font-black">Report not found.</h1>
              <p className="mx-auto mt-3 max-w-xl text-slate-400">
                This report does not exist, the attempt was deleted, or the saved attempt ID is wrong.
              </p>

              <Link
                href="/dashboard"
                className="mt-7 inline-flex rounded-full bg-blue-600 px-5 py-3 text-sm font-bold hover:bg-blue-500"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        </main>
      );
    }

    const score = normalizeOverallScore(attempt.score);
    const strengths = safeArray(attempt.strengths);
    const weaknesses = safeArray(attempt.weaknesses);
    const redFlags = safeArray(attempt.red_flags);
    const dimensionScores = mergeScores(
      safeObject(attempt.dimension_scores),
      buildDefaultScores(attempt.role)
    );
    const phaseScores = safeObject(attempt.phase_scores);
    const transcript = safeTranscript(attempt.transcript);
    const evidence = attempt.evidence || {};
    const keyEvidence = [
      ...safeArray(evidence.keyEvidence),
      ...safeArray(evidence.transcriptEvidence),
    ].slice(0, 8);

    const dimensionAverage = avgScore(dimensionScores);
    const phaseAverage = avgScore(phaseScores);
    const candidateAnswers = transcript.filter((m) => m.sender === "candidate").length;
    const customerTurns = transcript.filter((m) => m.sender === "customer" || m.sender === "interviewer").length;
    const followUps = transcript.filter((m) => Boolean(m.followUp)).length;
    const transcriptHasEvidence = transcript.some((m) => String(m.text || "").trim().length > 0);
    const qualityWarnings = [
      candidateAnswers < 4 ? "Low answer count: do not over-trust this report." : "",
      !transcriptHasEvidence ? "Transcript missing: rerun assessment if hiring decision matters." : "",
      score >= 80 && redFlags.length > 0 ? "High score with red flags: manually review before advancing." : "",
    ].filter(Boolean);

    return (
      <main className="min-h-screen bg-[#050914] text-white">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.24),transparent_35%),radial-gradient(circle_at_top_right,rgba(20,184,166,0.12),transparent_30%)]" />

        <div className="relative mx-auto max-w-7xl px-6 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <HirequeLogo />

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/dashboard/screening/${attempt.screening_id}`}
                className="rounded-full border border-white/10 px-5 py-3 text-sm font-bold text-slate-200 hover:bg-white/10"
              >
                Back to candidates
              </Link>

              <Link
                href="/dashboard"
                className="rounded-full border border-white/10 px-5 py-3 text-sm font-bold text-slate-400 hover:bg-white/10"
              >
                Dashboard
              </Link>
            </div>
          </div>

          <section className="mt-10 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl">
            <div className="border-b border-white/10 bg-white/[0.025] px-8 py-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.28em] text-blue-300">
                    Hireque Candidate Intelligence Report
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Wireless roleplay simulation • evidence-based hiring signal
                  </p>
                </div>

                <div className={`inline-flex w-fit rounded-full border px-5 py-2 text-sm font-black ${riskStyle(attempt.hiring_risk)}`}>
                  Risk: {formatLabel(attempt.hiring_risk || "Not Classified")}
                </div>
              </div>
            </div>

            <div className="grid gap-8 p-8 lg:grid-cols-[1fr_340px]">
              <div>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <h1 className="text-4xl font-black tracking-tight md:text-5xl">
                      {attempt.candidate_name || "Unnamed Candidate"}
                    </h1>
                    <p className="mt-2 text-slate-400">
                      {attempt.candidate_email || "No email saved"}
                    </p>
                  </div>

                  <div className={`inline-flex w-fit rounded-2xl border px-6 py-4 text-2xl font-black ${decisionStyle(attempt.verdict)}`}>
                    {decisionText(attempt.verdict)}
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2 text-sm">
                  <Badge>{formatLabel(attempt.role)}</Badge>
                  <Badge>{formatLabel(attempt.level)}</Badge>
                  <Badge>{formatLabel(attempt.experience)}</Badge>
                  <Badge>Status: {formatLabel(attempt.status)}</Badge>
                  <Badge>Submitted {formatDate(attempt.created_at)}</Badge>
                </div>

                <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-[#0B1220]/80 p-6">
                  <p className="text-sm font-black uppercase tracking-[0.22em] text-blue-300">
                    Executive Summary
                  </p>
                  <p className="mt-4 whitespace-pre-wrap text-lg leading-8 text-slate-300">
                    {attempt.summary || evidence.hiringSummary || "No employer-facing summary was generated. Run a new assessment after the submit route upgrade."}
                  </p>
                </div>

                {qualityWarnings.length > 0 && (
                  <div className="mt-5 rounded-[1.5rem] border border-yellow-400/20 bg-yellow-500/10 p-5">
                    <p className="text-sm font-black uppercase tracking-[0.22em] text-yellow-300">
                      Review Warning
                    </p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-yellow-100/90">
                      {qualityWarnings.map((warning) => (
                        <li key={warning}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className={`rounded-[2rem] border p-6 text-center ${scoreStyle(score)}`}>
                  <p className="text-sm font-black uppercase tracking-[0.22em] opacity-80">
                    Overall Score
                  </p>
                  <p className="mt-4 text-7xl font-black tracking-tight">{score}</p>
                  <p className="mt-2 text-sm font-black uppercase opacity-90">/100</p>
                  <p className="mt-5 rounded-full border border-current/20 px-4 py-2 text-sm font-black uppercase">
                    {verdictLabel(attempt.verdict)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <MiniScore label="Skill Avg" value={dimensionAverage} />
                  <MiniScore label="Phase Avg" value={phaseAverage} />
                </div>

                <div className="rounded-[1.5rem] border border-white/10 bg-[#0B1220] p-5">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
                    Interview Quality
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {attempt.interview_quality || "Not classified"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-4">
            <MetricCard label="Candidate Answers" value={candidateAnswers} />
            <MetricCard label="Customer Turns" value={customerTurns} />
            <MetricCard label="Pressure Follow-ups" value={followUps} danger={followUps >= 3} />
            <MetricCard label="Red Flags" value={redFlags.length} danger={redFlags.length > 0} />
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <Panel title="Hiring Recommendation">
              {attempt.recommendation || "No recommendation generated."}
            </Panel>

            <Panel title="Decision Reason">
              {evidence.decisionReason || evidence.scoreRationale || "No decision evidence was saved. Run a new assessment after the submit route upgrade."}
            </Panel>
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <SignalPanel title="Best Moment" tone="good">
              {evidence.bestMoment || strengths[0] || "No clear standout moment was captured."}
            </SignalPanel>

            <SignalPanel title="Worst Moment" tone="bad">
              {evidence.worstMoment || weaknesses[0] || redFlags[0] || "No specific weak moment was captured."}
            </SignalPanel>
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-3">
            <ReportList title="Strengths" items={strengths} empty="No clear strengths detected." />
            <ReportList title="Weaknesses" items={weaknesses} empty="No weaknesses listed." />
            <ReportList title="Red Flags" items={redFlags} empty="No major red flags listed." danger />
          </section>

          {keyEvidence.length > 0 && (
            <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
              <p className="text-sm font-black uppercase tracking-[0.25em] text-blue-300">
                Transcript Evidence
              </p>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {keyEvidence.map((item, index) => (
                  <div key={`${item}-${index}`} className="rounded-2xl border border-white/10 bg-[#0B1220] p-4 text-sm leading-6 text-slate-300">
                    {item}
                  </div>
                ))}
              </div>
            </section>
          )}

          <ScoreSection title="Skill Breakdown" scores={dimensionScores} />
          <ScoreSection title="Conversation Phase Breakdown" scores={phaseScores} />

          <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.25em] text-blue-300">
                  Full Transcript
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Pressure follow-ups expose where the candidate struggled under realistic wireless customer resistance.
                </p>
              </div>

              <div className="rounded-full border border-white/10 bg-[#0B1220] px-4 py-2 text-sm text-slate-400">
                {transcript.length} messages
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {transcript.length === 0 ? (
                <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-5 text-sm text-red-200">
                  No transcript saved. This report should not be used for a final hiring decision.
                </p>
              ) : (
                transcript.map((message, index) => (
                  <TranscriptBubble key={`${index}-${message.sender || "unknown"}`} index={index + 1} message={message} />
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    );
  }

  function Badge({ children }: { children: ReactNode }) {
    return (
      <span className="rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 capitalize text-slate-300">
        {children}
      </span>
    );
  }

  function MetricCard({
    label,
    value,
    danger,
  }: {
    label: string;
    value: number | string;
    danger?: boolean;
  }) {
    return (
      <div className={`rounded-2xl border p-5 ${danger ? "border-red-400/20 bg-red-500/10" : "border-white/10 bg-white/[0.04]"}`}>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-black">{value}</p>
      </div>
    );
  }

  function MiniScore({ label, value }: { label: string; value: number }) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0B1220] p-4 text-center">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{label}</p>
        <p className="mt-1 text-3xl font-black text-white">{value}</p>
        <p className="mt-1 text-xs font-bold text-slate-500">/10</p>
      </div>
    );
  }

  function Panel({ title, children }: { title: string; children: ReactNode }) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0B1220] p-6">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-blue-300">{title}</p>
        <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-300">{children}</p>
      </div>
    );
  }

  function SignalPanel({
    title,
    children,
    tone,
  }: {
    title: string;
    children: ReactNode;
    tone: "good" | "bad";
  }) {
    const className = tone === "good" ? "border-emerald-400/15 bg-emerald-500/[0.04]" : "border-red-400/15 bg-red-500/[0.04]";

    return (
      <div className={`rounded-2xl border p-6 ${className}`}>
        <p className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">{title}</p>
        <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-300">{children}</p>
      </div>
    );
  }

  function ReportList({
    title,
    items,
    empty,
    danger,
  }: {
    title: string;
    items: string[];
    empty: string;
    danger?: boolean;
  }) {
    return (
      <div className={`rounded-[2rem] border p-6 ${danger ? "border-red-400/15 bg-red-500/[0.04]" : "border-white/10 bg-white/[0.04]"}`}>
        <p className={`text-sm font-black uppercase tracking-[0.22em] ${danger ? "text-red-300" : "text-blue-300"}`}>{title}</p>

        <div className="mt-5 space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-slate-500">{empty}</p>
          ) : (
            items.map((item, index) => (
              <div key={`${title}-${index}`} className="rounded-2xl border border-white/10 bg-[#0B1220] p-4 text-sm leading-6 text-slate-300">
                {item}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  function ScoreSection({ title, scores }: { title: string; scores: Record<string, number> }) {
    const entries = Object.entries(scores);

    return (
      <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-blue-300">{title}</p>

        {entries.length === 0 ? (
          <p className="mt-5 text-slate-500">No scores saved.</p>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {entries.map(([key, value]) => {
              const normalized = normalizeRubricScore(value);

              return (
                <div key={key} className="rounded-2xl border border-white/10 bg-[#0B1220] p-5">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-bold capitalize text-slate-300">{formatLabel(key)}</p>
                    <p className="text-xl font-black">{normalized}/10</p>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${normalized * 10}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  function TranscriptBubble({ message, index }: { message: TranscriptMessage; index: number }) {
    const sender = message.sender || "unknown";
    const isCandidate = sender === "candidate";
    const className = isCandidate
      ? "border-blue-400/15 bg-blue-600/15"
      : sender === "customer" || sender === "interviewer"
        ? "border-orange-400/15 bg-orange-500/10"
        : "border-white/10 bg-[#0B1220]";

    return (
      <div className={`rounded-2xl border p-5 ${className}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-black text-slate-400">
            #{index}
          </span>

          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{sender}</p>

          {message.followUp && (
            <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-300">
              Pressure follow-up
            </span>
          )}

          {message.phase && (
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-500">
              {formatLabel(message.phase)}
            </span>
          )}

          {message.topic && (
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-500">
              {formatLabel(message.topic)}
            </span>
          )}
        </div>

        <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-300">{message.text || "-"}</p>
      </div>
    );
  }


