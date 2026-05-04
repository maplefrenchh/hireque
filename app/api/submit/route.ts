import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Sender = "interviewer" | "customer" | "candidate";
type Role = "sales" | "support";
type Level = "rep" | "senior" | "manager" | "district_lead";
type Experience = "newcomer" | "experienced";

type Message = {
  sender: Sender;
  text: string;
  phase?: string;
  topic?: string;
  followUp?: boolean;
};

type Candidate = {
  name?: string;
  email?: string;
};

type DimensionScores = {
  discovery: number;
  communication: number;
  objectionHandling: number;
  control: number;
  closing: number;
  trust: number;
  roleFit: number;
  coachability: number;
};

type PhaseScores = {
  core: number;
  levelFit: number;
  experienceFit: number;
  simulation: number;
  finalScenario: number;
};

type ScorePayload = {
  score: number;
  verdict:
    | "strong_hire"
    | "hire"
    | "lean_hire"
    | "lean_reject"
    | "reject"
    | "strong_reject";
  summary: string;
  strengths: string[];
  weaknesses: string[];
  redFlags: string[];
  dimensionScores: DimensionScores;
  phaseScores: PhaseScores;
  recommendation: string;
  hiringRisk: "low" | "medium" | "high" | "severe";
  interviewQuality: "complete" | "partial" | "weak_signal" | "invalid";
  evidence: {
    bestMoment: string;
    worstMoment: string;
    decisionReason: string;
  };
};

type SignalProfile = {
  answerCount: number;
  candidateWordCount: number;
  averageAnswerWords: number;
  ultraShortAnswers: number;
  shortAnswers: number;
  followUpCount: number;
  simulationAnswerCount: number;
  finalScenarioAnswerCount: number;
  discoverySignals: number;
  closingSignals: number;
  objectionSignals: number;
  empathySignals: number;
  ownershipSignals: number;
  wirelessSignals: number;
  leadershipSignals: number;
  genericSignals: number;
  questionCount: number;
  hasCustomerSimulation: boolean;
};

function cleanText(value: unknown, max = 5000): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeRole(value: unknown): Role {
  return value === "support" ? "support" : "sales";
}

function normalizeLevel(value: unknown): Level {
  if (value === "senior") return "senior";
  if (value === "manager") return "manager";
  if (value === "district_lead") return "district_lead";
  return "rep";
}

function normalizeExperience(value: unknown): Experience {
  return value === "experienced" ? "experienced" : "newcomer";
}

function isSender(value: unknown): value is Sender {
  return value === "interviewer" || value === "customer" || value === "candidate";
}

function safeMessages(value: unknown): Message[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((m): m is Message => {
      if (!m || typeof m !== "object") return false;
      const item = m as Partial<Message>;
      return isSender(item.sender) && typeof item.text === "string";
    })
    .slice(-140)
    .map((m) => ({
      sender: m.sender,
      text: cleanText(m.text, 6000),
      phase: cleanText(m.phase, 100) || undefined,
      topic: cleanText(m.topic, 120) || undefined,
      followUp: Boolean(m.followUp),
    }))
    .filter((m) => m.text.length > 0);
}

function clampScore(value: unknown): number {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function clampTen(value: unknown): number {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(10, Math.round(score)));
}

function verdictFromScore(score: number): ScorePayload["verdict"] {
  if (score >= 88) return "strong_hire";
  if (score >= 78) return "hire";
  if (score >= 68) return "lean_hire";
  if (score >= 52) return "lean_reject";
  if (score >= 35) return "reject";
  return "strong_reject";
}

function riskFromScore(score: number): ScorePayload["hiringRisk"] {
  if (score >= 82) return "low";
  if (score >= 68) return "medium";
  if (score >= 40) return "high";
  return "severe";
}

function qualityFromSignal(signal: SignalProfile): ScorePayload["interviewQuality"] {
  if (signal.answerCount < 4 || signal.candidateWordCount < 80) return "invalid";
  if (signal.answerCount < 6 || signal.candidateWordCount < 160) return "weak_signal";
  if (signal.answerCount < 9 || !signal.hasCustomerSimulation) return "partial";
  return "complete";
}

function buildTranscript(messages: Message[]): string {
  if (messages.length === 0) return "No transcript provided.";

  return messages
    .map((m, index) => {
      const label =
        m.sender === "candidate"
          ? "Candidate"
          : m.sender === "customer"
          ? "Customer"
          : "Interviewer";

      const meta = [
        m.phase ? `phase=${m.phase}` : null,
        m.topic ? `topic=${m.topic}` : null,
        m.followUp ? "follow_up=true" : null,
      ]
        .filter(Boolean)
        .join(", ");

      return `${index + 1}. ${label}${meta ? ` (${meta})` : ""}: ${m.text}`;
    })
    .join("\n");
}

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((total, pattern) => total + (text.match(pattern)?.length || 0), 0);
}

function buildSignalProfile(messages: Message[]): SignalProfile {
  const candidateMessages = messages.filter((m) => m.sender === "candidate");
  const candidateText = candidateMessages.map((m) => m.text).join(" \n ").toLowerCase();
  const candidateWordCount = candidateText.split(/\s+/).filter(Boolean).length;
  const answerCount = candidateMessages.length;
  const ultraShortAnswers = candidateMessages.filter((m) => m.text.split(/\s+/).length < 5).length;
  const shortAnswers = candidateMessages.filter((m) => m.text.split(/\s+/).length < 18).length;

  return {
    answerCount,
    candidateWordCount,
    averageAnswerWords: answerCount ? Math.round(candidateWordCount / answerCount) : 0,
    ultraShortAnswers,
    shortAnswers,
    followUpCount: messages.filter(
      (m) => (m.sender === "interviewer" || m.sender === "customer") && m.followUp
    ).length,
    simulationAnswerCount: candidateMessages.filter((m) => m.phase === "simulation").length,
    finalScenarioAnswerCount: candidateMessages.filter((m) => m.phase === "final_scenario").length,
    discoverySignals: countMatches(candidateText, [
      /\bwhat do you use\b/g,
      /\bhow much\b/g,
      /\bbudget\b/g,
      /\bcurrent provider\b/g,
      /\bwho is your provider\b/g,
      /\bdata\b/g,
      /\bmonthly\b/g,
      /\bneed(s)?\b/g,
      /\busage\b/g,
      /\bhow many lines\b/g,
      /\bwhat matters\b/g,
    ]),
    closingSignals: countMatches(candidateText, [
      /\bstart today\b/g,
      /\bset (you|this) up\b/g,
      /\bmove forward\b/g,
      /\bget you started\b/g,
      /\bshall we\b/g,
      /\bnext step\b/g,
      /\bactivate\b/g,
      /\bsign you up\b/g,
    ]),
    objectionSignals: countMatches(candidateText, [
      /\bprice\b/g,
      /\bexpensive\b/g,
      /\bcontract\b/g,
      /\bcompetitor\b/g,
      /\bthink about it\b/g,
      /\bcompare\b/g,
      /\bvalue\b/g,
      /\bbecause\b/g,
      /\btrade[- ]?in\b/g,
    ]),
    empathySignals: countMatches(candidateText, [
      /\bi understand\b/g,
      /\bfrustrating\b/g,
      /\bsorry\b/g,
      /\bthat makes sense\b/g,
      /\bi get\b/g,
      /\bfair\b/g,
    ]),
    ownershipSignals: countMatches(candidateText, [
      /\bi can\b/g,
      /\blet me\b/g,
      /\bi will\b/g,
      /\bwe can\b/g,
      /\bnext step\b/g,
      /\bresolve\b/g,
      /\bcheck your account\b/g,
      /\bescalate\b/g,
      /\bfollow up\b/g,
    ]),
    wirelessSignals: countMatches(candidateText, [
      /\bplan\b/g,
      /\bline\b/g,
      /\bdevice\b/g,
      /\bupgrade\b/g,
      /\btrade[- ]?in\b/g,
      /\broaming\b/g,
      /\bdata\b/g,
      /\bbilling\b/g,
      /\bsim\b/g,
      /\bactivation\b/g,
      /\bcoverage\b/g,
      /\bnetwork\b/g,
      /\bfinancing\b/g,
      /\btab\b/g,
    ]),
    leadershipSignals: countMatches(candidateText, [
      /\bcoach\b/g,
      /\bteam\b/g,
      /\bmanager\b/g,
      /\bstore\b/g,
      /\bpattern\b/g,
      /\bprocess\b/g,
      /\btraining\b/g,
      /\bfollow[- ]?up\b/g,
      /\baccountability\b/g,
      /\bmetrics\b/g,
      /\bperformance\b/g,
    ]),
    genericSignals: countMatches(candidateText, [
      /\bgood customer service\b/g,
      /\btry my best\b/g,
      /\bhelp them\b/g,
      /\bbe polite\b/g,
      /\bmake them happy\b/g,
      /\bprovide solution\b/g,
      /\bunderstand their needs\b/g,
    ]),
    questionCount: countMatches(candidateText, [/\?/g]),
    hasCustomerSimulation: messages.some((m) => m.sender === "customer"),
  };
}

function detectHardRedFlags(messages: Message[], role: Role, level: Level, experience: Experience): string[] {
  const redFlags: string[] = [];
  const signal = buildSignalProfile(messages);
  const candidateText = messages
    .filter((m) => m.sender === "candidate")
    .map((m) => m.text.toLowerCase())
    .join(" ");

  const abusePatterns = [
    "fuck you",
    "bitch",
    "motherfucker",
    "madarchod",
    "bhenchod",
    "behenchod",
    "chutiya",
  ];

  const threatPatterns = [
    "i will kill",
    "i'll kill",
    "kill you",
    "shoot you",
    "i will shoot",
    "i'll shoot",
    "stab you",
    "beat you",
  ];

  
  const inabilityPatterns = [
    "i don't know",
    "i dont know",
    "i do not know",
    "i never closed",
    "never closed the sale",
    "never closed a sale",
    "i cannot do anything",
    "i can't do anything",
    "i cannot sell",
    "i can't sell",
    "i don't remember",
    "i dont remember",
  ];

  if (inabilityPatterns.some((p) => candidateText.includes(p))) {
    redFlags.push("Candidate failed a basic pressure check by admitting inability, lack of recall, or inability to perform a core role task.");
  }

  const claimedExperience =
    /\b\d+\s*(year|years|yr|yrs)\b/.test(candidateText) ||
    candidateText.includes("worked with") ||
    candidateText.includes("worked at") ||
    candidateText.includes("experience in wireless");

  const failedExample =
    candidateText.includes("i don't know") ||
    candidateText.includes("i dont know") ||
    candidateText.includes("i don't remember") ||
    candidateText.includes("i dont remember") ||
    candidateText.includes("never closed");

  if (claimedExperience && failedExample) {
    redFlags.push("Candidate claimed relevant experience but failed to provide a concrete example when pressured.");
  }

  if (role === "sales" && candidateText.includes("never closed")) {
    redFlags.push("Sales candidate admitted they have never closed a sale.");
  }

  if (abusePatterns.some((p) => candidateText.includes(p))) {
    redFlags.push("Used abusive language during a customer-facing assessment.");
  }

  if (threatPatterns.some((p) => candidateText.includes(p))) {
    redFlags.push("Used threatening or violent language during the assessment.");
  }

  if (signal.ultraShortAnswers >= 2) {
    redFlags.push("Multiple answers were too short to produce reliable hiring signal.");
  }

  if (signal.answerCount >= 6 && signal.averageAnswerWords < 18) {
    redFlags.push("Answers stayed shallow across the assessment instead of showing practical customer handling.");
  }

  if (role === "sales" && signal.answerCount >= 6 && signal.discoverySignals < 2) {
    redFlags.push("Sales candidate showed weak discovery before attempting to recommend or persuade.");
  }

  if (role === "sales" && signal.answerCount >= 6 && signal.closingSignals === 0) {
    redFlags.push("Sales candidate did not show a clear closing instinct.");
  }

  if (role === "support" && signal.answerCount >= 6 && signal.ownershipSignals < 2) {
    redFlags.push("Support candidate did not show enough ownership or concrete resolution steps.");
  }

  if ((level === "manager" || level === "district_lead") && signal.answerCount >= 6 && signal.leadershipSignals < 2) {
    redFlags.push("Leadership-level candidate did not show enough coaching, escalation, or operational judgment.");
  }

  if (experience === "experienced" && signal.answerCount >= 6 && signal.wirelessSignals < 4) {
    redFlags.push("Experienced candidate did not show enough practical wireless industry realism.");
  }

  return Array.from(new Set(redFlags)).slice(0, 10);
}

function extractJsonObject(text: string): unknown {
  const raw = text.trim();

  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error("No JSON object found");
    }

    return JSON.parse(raw.slice(start, end + 1));
  }
}

function fallbackScore(reason = "Evaluation fallback used."): ScorePayload {
  return {
    score: 24,
    verdict: "strong_reject",
    summary:
      "Candidate did not provide enough reliable evidence to support advancement. The available transcript shows weak structure, limited control, and insufficient role-specific judgment.",
    strengths: [],
    weaknesses: [
      "Insufficient evidence of structured discovery or customer control.",
      "Limited proof of objection handling under pressure.",
      "Responses did not create enough confidence for advancement.",
    ],
    redFlags: [reason],
    dimensionScores: {
      discovery: 2,
      communication: 3,
      objectionHandling: 2,
      control: 2,
      closing: 1,
      trust: 3,
      roleFit: 2,
      coachability: 2,
    },
    phaseScores: {
      core: 2,
      levelFit: 2,
      experienceFit: 2,
      simulation: 0,
      finalScenario: 0,
    },
    recommendation:
      "Do not advance. The transcript does not show enough role-ready evidence for a wireless customer-facing position.",
    hiringRisk: "severe",
    interviewQuality: "invalid",
    evidence: {
      bestMoment: "No strong moment was clearly demonstrated in the transcript.",
      worstMoment: "The interview did not provide enough concrete role-specific evidence.",
      decisionReason:
        "Reject due to weak signal, insufficient control, and lack of clear customer-handling evidence.",
    },
  };
}

function applyDeterministicCaps(
  score: number,
  signal: SignalProfile,
  hardRedFlags: string[],
  role: Role,
  level: Level,
  experience: Experience
): number {
  let capped = clampScore(score);

  if (signal.answerCount < 6) capped = Math.min(capped, 45);
  if (signal.answerCount < 4) capped = Math.min(capped, 30);
  if (signal.candidateWordCount < 100) capped = Math.min(capped, 35);
  if (hardRedFlags.length > 0) capped = Math.min(capped, 62);

  const criticalFailure = hardRedFlags.some((f) =>
    f.toLowerCase().includes("basic pressure check") ||
    f.toLowerCase().includes("claimed relevant experience") ||
    f.toLowerCase().includes("never closed a sale")
  );

  if (criticalFailure) capped = Math.min(capped, 24);
  if (criticalFailure && role === "sales") capped = Math.min(capped, 18);
  if (hardRedFlags.some((f) => f.includes("abusive") || f.includes("threatening"))) capped = Math.min(capped, 25);
  if (!signal.hasCustomerSimulation) capped = Math.min(capped, 55);
  if (signal.answerCount >= 6 && signal.averageAnswerWords < 18) capped = Math.min(capped, 52);

  if (role === "sales") {
    if (signal.discoverySignals < 2) capped = Math.min(capped, 58);
    if (signal.closingSignals === 0) capped = Math.min(capped, 64);
    if (signal.objectionSignals < 2 && signal.followUpCount >= 2) capped = Math.min(capped, 62);
  }

  if (role === "support") {
    if (signal.ownershipSignals < 2) capped = Math.min(capped, 60);
    if (signal.empathySignals === 0 && signal.followUpCount >= 2) capped = Math.min(capped, 62);
  }

  if (level === "manager" || level === "district_lead") {
    if (signal.leadershipSignals < 2) capped = Math.min(capped, 60);
    if (signal.leadershipSignals < 4 && level === "district_lead") capped = Math.min(capped, 64);
  }

  if (experience === "experienced" && signal.wirelessSignals < 4) capped = Math.min(capped, 62);
  if (signal.genericSignals

 >= 3 && signal.wirelessSignals < 4) capped = Math.min(capped, 58);

  return capped;
}

function normalizeStringArray(value: unknown, maxItems: number, maxChars: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => cleanText(x, maxChars)).filter(Boolean).slice(0, maxItems);
}

function normalizeScorePayload(
  value: unknown,
  hardRedFlags: string[],
  signal: SignalProfile,
  role: Role,
  level: Level,
  experience: Experience
): ScorePayload {
  if (!value || typeof value !== "object") {
    return fallbackScore("Evaluator returned invalid JSON.");
  }

  const raw = value as Partial<ScorePayload>;
  const dimensionScoresRaw = raw.dimensionScores || ({} as Partial<DimensionScores>);
  const phaseScoresRaw = raw.phaseScores || ({} as Partial<PhaseScores>);

  const redFlags = Array.from(
    new Set([
      ...normalizeStringArray(raw.redFlags, 10, 500),
      ...hardRedFlags,
    ].filter(Boolean))
  ).slice(0, 10);

  let score = applyDeterministicCaps(
    clampScore(raw.score),
    signal,
    redFlags,
    role,
    level,
    experience
  );

// ?? HARD OVERRIDE FOR WEAK INTERVIEWS
if (
  signal.answerCount < 5 ||
  signal.candidateWordCount < 120 ||
  signal.hasCustomerSimulation === false
) {
  score = Math.min(score, 30);
}

// Generic/crammed answers without scenario proof = not hireable
if (
  signal.hasCustomerSimulation === false ||
  signal.simulationAnswerCount < 2 ||
  (
    role === "sales" &&
    signal.discoverySignals < 2 &&
    signal.objectionSignals < 2 &&
    signal.closingSignals === 0
  ) ||
  (
    role === "support" &&
    signal.ownershipSignals < 2 &&
    signal.empathySignals < 1
  )
) {
  score = Math.min(score, 35);
}

// Pressure failure = major hiring risk
if (
  signal.followUpCount >= 2 &&
  signal.discoverySignals < 2 &&
  signal.objectionSignals < 2 &&
  signal.closingSignals === 0
) {
  score = Math.min(score, 40);
}

// Zero real sales behavior = automatic strong reject
if (
  role === "sales" &&
  signal.discoverySignals === 0 &&
  signal.objectionSignals === 0 &&
  signal.closingSignals === 0
) {
  score = Math.min(score, 24);
}

// Weak customer-service behavior = automatic reject
if (
  role === "support" &&
  signal.ownershipSignals === 0 &&
  signal.empathySignals === 0
) {
  score = Math.min(score, 30);
}

// FINAL ELITE CAPS

// No real simulation proof = cannot be hire-level
if (signal.simulationAnswerCount < 2) {
  score = Math.min(score, 45);
}

// Very thin interview = strong reject zone
if (signal.answerCount < 4 || signal.candidateWordCount < 90) {
  score = Math.min(score, 28);
}

// Mostly short answers = low confidence
if (signal.answerCount > 0 && signal.shortAnswers >= Math.ceil(signal.answerCount * 0.6)) {
  score = Math.min(score, 38);
}

// Sales: no discovery + no objection handling + no closing = unusable
if (
  role === "sales" &&
  signal.discoverySignals < 1 &&
  signal.objectionSignals < 1 &&
  signal.closingSignals === 0
) {
  score = Math.min(score, 24);
}

// Sales: cannot be hire-level without closing or objection handling
if (
  role === "sales" &&
  (signal.closingSignals === 0 || signal.objectionSignals < 1)
) {
  score = Math.min(score, 58);
}

// Sales: cannot be strong hire without all core sales signals
if (
  role === "sales" &&
  (signal.discoverySignals < 2 || signal.objectionSignals < 2 || signal.closingSignals < 1)
) {
  score = Math.min(score, 74);
}

// Support: cannot be hire-level without ownership + empathy/de-escalation signal
if (
  role === "support" &&
  (signal.ownershipSignals < 2 || signal.empathySignals < 1)
) {
  score = Math.min(score, 58);
}

// Claimed experience but weak proof = reject
if (
  experience === "experienced" &&
  signal.candidateWordCount < 160 &&
  signal.simulationAnswerCount < 2
) {
  score = Math.min(score, 32);
}

// Pressure failure = not hire-ready
if (
  signal.followUpCount >= 2 &&
  signal.shortAnswers >= 2 &&
  signal.averageAnswerWords < 25
) {
  score = Math.min(score, 34);
}

// Too generic = not hire-ready
if (
  signal.genericSignals >= 3 &&
  signal.simulationAnswerCount < 2
) {
  score = Math.min(score, 35);
}

  if (
  signal.genericSignals > 3 &&
  signal.discoverySignals < 2 &&
  signal.objectionSignals < 2
) {
  score = Math.min(score, 38);
}

  const interviewQuality = qualityFromSignal(signal);

  return {
    score,
    verdict: verdictFromScore(score),
    summary:
      cleanText(raw.summary, 1200) ||
      "Candidate assessment completed. The transcript did not provide enough detail for a stronger recommendation.",
    strengths: normalizeStringArray(raw.strengths, 6, 500),
    weaknesses: normalizeStringArray(raw.weaknesses, 8, 500).length
      ? normalizeStringArray(raw.weaknesses, 8, 500)
      : ["Insufficient evidence of role-ready performance."],
    redFlags,
    dimensionScores: {
  discovery: signal.discoverySignals < 2 ? Math.min(3, clampTen(dimensionScoresRaw.discovery)) : clampTen(dimensionScoresRaw.discovery),
  communication: (
  signal.discoverySignals < 2 &&
  signal.objectionSignals < 2 &&
  signal.closingSignals === 0
)
  ? Math.min(4, clampTen(dimensionScoresRaw.communication))
  : score < 45
  ? Math.min(5, clampTen(dimensionScoresRaw.communication))
  : clampTen(dimensionScoresRaw.communication),
  objectionHandling: signal.objectionSignals < 2 ? Math.min(3, clampTen(dimensionScoresRaw.objectionHandling)) : clampTen(dimensionScoresRaw.objectionHandling),
  control: (
  role === "sales" &&
  signal.discoverySignals < 2 &&
  signal.closingSignals === 0
)
  ? Math.min(3, clampTen(dimensionScoresRaw.control))
  : clampTen(dimensionScoresRaw.control),
  closing: signal.closingSignals === 0 ? Math.min(2, clampTen(dimensionScoresRaw.closing)) : clampTen(dimensionScoresRaw.closing),
  trust: (
  signal.candidateWordCount < 120 ||
  signal.simulationAnswerCount < 2 ||
  signal.genericSignals >= 3
)
  ? Math.min(4, clampTen(dimensionScoresRaw.trust))
  : clampTen(dimensionScoresRaw.trust),
  roleFit: (
  signal.simulationAnswerCount < 2 ||
  signal.candidateWordCount < 120
)
  ? Math.min(4, clampTen(dimensionScoresRaw.roleFit))
  : clampTen(dimensionScoresRaw.roleFit),
  coachability: (
  signal.followUpCount >= 2 &&
  signal.shortAnswers >= 2
)
  ? Math.min(3, clampTen(dimensionScoresRaw.coachability))
  : clampTen(dimensionScoresRaw.coachability),
},
    phaseScores: {
  core: score < 45 ? Math.min(4, clampTen(phaseScoresRaw.core)) : clampTen(phaseScoresRaw.core),
  levelFit: score < 45 ? Math.min(4, clampTen(phaseScoresRaw.levelFit)) : clampTen(phaseScoresRaw.levelFit),
  experienceFit: score < 45 ? Math.min(4, clampTen(phaseScoresRaw.experienceFit)) : clampTen(phaseScoresRaw.experienceFit),
  simulation: signal.hasCustomerSimulation ? clampTen(phaseScoresRaw.simulation) : 0,
  finalScenario: signal.finalScenarioAnswerCount === 0 ? 0 : clampTen(phaseScoresRaw.finalScenario),
},
    recommendation:
      cleanText(raw.recommendation, 1000) ||
      "Do not advance unless external evidence strongly contradicts this screening.",
    hiringRisk: riskFromScore(score),
    interviewQuality,
    evidence: {
      bestMoment:
        cleanText(raw.evidence?.bestMoment, 700) ||
        "No clear standout moment was identified.",
      worstMoment:
        cleanText(raw.evidence?.worstMoment, 700) ||
        "Weak or incomplete answers reduced confidence.",
      decisionReason:
        cleanText(raw.evidence?.decisionReason, 900) ||
        "Decision based on transcript evidence and role-fit signal.",
    },
  };
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Missing Supabase server configuration" },
        { status: 500 }
      );
    }

    const body = await req.json();

    const role = normalizeRole(body.role);
    const level = normalizeLevel(body.level);
    const experience = normalizeExperience(body.experience);
    const seed = cleanText(body.seed, 500) || null;
    const screeningId = cleanText(body.screeningId, 200);
    const candidate = (body.candidate || {}) as Candidate;

    const candidateName = cleanText(candidate.name, 200);
    const candidateEmail = cleanText(candidate.email, 300).toLowerCase();

    if (!screeningId) {
      return NextResponse.json({ error: "Missing screeningId" }, { status: 400 });
    }

    if (!candidateName || !candidateEmail) {
      return NextResponse.json({ error: "Missing candidate details" }, { status: 400 });
    }

    const cleanMessages = safeMessages(body.messages);

    if (cleanMessages.length < 4) {
      return NextResponse.json({ error: "Transcript is too short to evaluate" }, { status: 400 });
    }

    const signal = buildSignalProfile(cleanMessages);
    const hardRedFlags = detectHardRedFlags(cleanMessages, role, level, experience);
    const transcript = buildTranscript(cleanMessages);

    const roleRules =
      role === "support"
        ? `
This is WIRELESS CUSTOMER SERVICE screening.

Primary evaluation:
- de-escalation without fake empathy
- ownership and concrete next steps
- billing/network/device issue handling
- policy honesty without sounding helpless
- customer recovery and retention risk handling
- ability to explain clearly under pressure
- avoiding generic phrases like "I understand" without action
`
        : `
This is WIRELESS SALES screening.

Primary evaluation:
- discovery before recommendation
- commercial judgment and plan fit
- objection handling under resistance
- trust building without sounding pushy
- ability to recommend confidently
- control of conversation
- closing instinct
- wireless retail realism
`;

    const levelRules: Record<Level, string> = {
      rep: `
Frontline rep standard:
- clear customer-facing wording
- basic discovery
- confidence
- honest recommendation
- basic objection handling
- ability to move the conversation forward
`,
      senior: `
Senior rep standard:
- stronger commercial judgment
- competitor handling
- confident recommendation
- cleaner objection control
- ability to guide confused customers
- higher consistency than regular rep
`,
      manager: `
Store manager standard:
- customer recovery
- escalation handling
- coaching reps
- accountability
- protecting store standards
- diagnosing behavior behind complaints
- judgment under pressure
`,
      district_lead: `
District lead standard:
- multi-store diagnosis
- manager accountability
- pattern recognition
- churn/retention judgment
- business impact thinking
- repeat issue prevention
- operational leadership
`,
    };

    const experienceRules =
      experience === "newcomer"
        ? `
Newcomer standard:
- Do not punish missing telecom jargon.
- Do punish weak thinking, vague answers, poor listening, fake empathy, poor control, and no structure.
- Reward transferable sales/customer skill only when it is specific and usable.
- For manager/district lead, leadership judgment still must be strong.
`
        : `
Experienced wireless standard:
- Expect practical wireless knowledge.
- Punish weak handling of billing, plans, fees, device payments, trade-ins, upgrades, roaming/data issues, competitor offers, and customer recovery.
- Vague answers from experienced candidates are a serious negative signal.
`;

    const prompt = `
You are Hireque's strict wireless hiring evaluator.

Evaluate this structured interview transcript for a real employer deciding whether to advance a candidate.

NON-NEGOTIABLE EVALUATION RULES:
- Every score above 6 MUST be backed by a specific transcript example.
- If no exact line/action exists for a dimension, that dimension score must be 5 or lower.
- Scores must reflect consistency across the whole interview. One decent answer cannot justify high scores if the rest is weak.
- If candidate fails after 2+ pressure follow-ups, cap score at 40.
- If candidate repeats the same vague answer after pressure, coachability must be 3 or lower.
- If candidate cannot explain past experience with exact words/actions, mark roleFit and coachability low.
- If candidate never moves the customer conversation forward, mark control and closing low.
- Generic/background answers are LOW-WEIGHT evidence only.
- Scenario-based performance is the main hiring signal.
- If the candidate gives rehearsed/crammed background answers but fails scenario-based questions, mark them unsuitable for hiring.
- Do not let previous company names, years of experience, confidence, or fluency inflate sales/support skill scores.
- For SALES: discovery, objectionHandling, closing, control, and trust require scenario evidence.
- For CUSTOMER SUPPORT: issue diagnosis, de-escalation, ownership, clarity, and resolution quality require scenario evidence.
- Employer-facing summary must explicitly say when answers sounded rehearsed/crammed and scenario performance failed.
- Generic/background answers are LOW-WEIGHT evidence only.
- Scenario-based performance is the main hiring signal.
- If the candidate gives rehearsed/crammed background answers but fails scenario-based questions, mark them unsuitable for hiring.
- Do not let previous company names, years of experience, confidence, or fluency inflate sales/support skill scores.
- For SALES: discovery, objectionHandling, closing, control, and trust require scenario evidence.
- For CUSTOMER SUPPORT: issue diagnosis, de-escalation, ownership, clarity, and resolution quality require scenario evidence.
- If scenario answers are vague, passive, generic, or incomplete, cap the total score at 35.
- If the candidate cannot explain exact words/actions in a real scenario, mark roleFit and coachability low.
- Employer-facing summary must explicitly say when answers sounded rehearsed/crammed and scenario performance failed.
- Be harsh, evidence-based, and employer-facing.
- Do not inflate scores.
- Do not invent strengths.
- Do not reward vague answers.
- Do not reward generic empathy without action.
- Do not reward sales candidates who recommend before discovery.
- Do not reward support candidates who explain policy without owning next steps.
- Quote or paraphrase actual transcript behavior in evidence fields.
- If transcript evidence is thin, score low.

ROLE: ${role}
LEVEL: ${level}
EXPERIENCE: ${experience}
SEED: ${seed || "none"}

ROLE RULES:
${roleRules}

LEVEL RULES:
${levelRules[level]}

EXPERIENCE RULES:
${experienceRules}

INTERVIEW SIGNAL DATA:
- Candidate answer count: ${signal.answerCount}
- Candidate total word count: ${signal.candidateWordCount}
- Average answer length: ${signal.averageAnswerWords} words
- Ultra-short answers: ${signal.ultraShortAnswers}
- Short answers: ${signal.shortAnswers}
- Follow-up pressure count: ${signal.followUpCount}
- Simulation candidate answers: ${signal.simulationAnswerCount}
- Final scenario candidate answers: ${signal.finalScenarioAnswerCount}
- Discovery signals detected: ${signal.discoverySignals}
- Objection-handling signals detected: ${signal.objectionSignals}
- Closing signals detected: ${signal.closingSignals}
- Empathy signals detected: ${signal.empathySignals}
- Ownership signals detected: ${signal.ownershipSignals}
- Wireless realism signals detected: ${signal.wirelessSignals}
- Leadership signals detected: ${signal.leadershipSignals}
- Generic/canned signals detected: ${signal.genericSignals

}
- Candidate questions asked: ${signal.questionCount}
- Customer simulation present: ${signal.hasCustomerSimulation ? "yes" : "no"}
- Hard red flags detected before evaluation: ${hardRedFlags.length ? hardRedFlags.join(" | ") : "none"}

FOLLOW-UP SCORING RULE:
Follow-ups are not automatically bad. But repeated follow-ups usually mean the candidate gave vague, incomplete, evasive, or weak answers. If follow-ups were required and the candidate still did not improve, penalize heavily.

FINAL ELITE SCORING LAW:
- The evaluator must grade what the candidate actually DID, not what they claimed.
- A candidate cannot score above 60 without real scenario evidence.
- A candidate cannot score above 75 without clear discovery + recommendation/control + objection handling or ownership.
- A candidate cannot score above 88 unless they show consistent, specific, role-ready performance across multiple phases.
- Generic background experience is never enough for hire.
- Fluent but empty answers must be penalized.
- If transcript evidence and numeric score conflict, numeric score must be lowered.
- Employer-facing summary must clearly explain why the candidate is or is not safe to advance.
- Never give 10/10 unless the transcript shows exceptional evidence for that exact dimension.
- If any dimension has no transcript evidence, it must be 0-4.
- If candidate fails scenario-based questioning, they are not suitable for hiring even if background answers sound good.

SCORING STANDARD:
Most candidates should land between 35 and 68.
A score above 75 requires strong transcript evidence across multiple dimensions.
A score above 88 requires exceptional, specific, role-ready performance with clear discovery/control/objection handling/closing or support ownership.

VERDICT RULES:
strong_hire = 88-100
hire = 78-87
lean_hire = 68-77
lean_reject = 52-67
reject = 35-51
strong_reject = 0-34

HARD CAPS YOU MUST RESPECT:
- Fewer than 6 candidate answers: max 45.
- Fewer than 4 candidate answers: max 30.
- Candidate word count below 100: max 35.
- No live customer simulation: max 55.
- Mostly generic answers: max 58.
- Candidate cannot give exact customer-facing wording when pushed: max 60.
- Sales candidate weak discovery: max 58.
- Sales candidate no close: max 64.
- Support candidate weak ownership: max 60.
- Manager candidate weak leadership judgment: max 60.
- District lead candidate weak operational leadership: max 64.
- Experienced wireless candidate weak wireless realism: max 62.
- Abusive/threatening language: max 25.
- Candidate says they do not know, cannot remember, cannot perform the task, or never closed a sale: max 24.
- Sales candidate admits never closing a sale: max 18.
- Candidate claims experience but cannot provide one concrete example under pressure: max 24.

DIMENSION DEFINITIONS:
- discovery: asks useful needs/budget/provider/problem questions before recommending.
- communication: clear, human, concise, not robotic.
- objectionHandling: handles price, trust, contract, complaints, or resistance with logic.
- control: guides conversation without being rude or passive.
- closing: asks for a practical next step or commitment where relevant.
- trust: honest, transparent, credible.
- roleFit: matches the selected role and seniority.
- coachability: adapts after pressure/follow-up instead of repeating weak answers.

Return STRICT JSON only. No markdown. No commentary.

JSON SHAPE:
{
  "score": number,
  "verdict": "strong_hire" | "hire" | "lean_hire" | "lean_reject" | "reject" | "strong_reject",
  "summary": "strict 2-4 sentence employer-facing assessment",
  "strengths": ["specific transcript-based strength"],
  "weaknesses": ["specific transcript-based weakness"],
  "redFlags": ["specific transcript-based red flag"],
  "dimensionScores": {
    "discovery": number,
    "communication": number,
    "objectionHandling": number,
    "control": number,
    "closing": number,
    "trust": number,
    "roleFit": number,
    "coachability": number
  },
  "phaseScores": {
    "core": number,
    "levelFit": number,
    "experienceFit": number,
    "simulation": number,
    "finalScenario": number
  },
  "recommendation": "clear employer recommendation",
  "hiringRisk": "low" | "medium" | "high" | "severe",
  "interviewQuality": "complete" | "partial" | "weak_signal" | "invalid",
  "evidence": {
    "bestMoment": "best transcript-supported moment",
    "worstMoment": "worst transcript-supported moment",
    "decisionReason": "why this verdict was assigned"
  }
}

TRANSCRIPT:
${transcript}
`;

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: prompt,
      temperature: 0.15,
      max_output_tokens: 2200,
    });

    let parsedRaw: unknown;

    try {
      parsedRaw = extractJsonObject(response.output_text || "");
    } catch {
      parsedRaw = fallbackScore("Evaluator returned non-JSON output.");
    }
const { data: screening, error: screeningError } = await supabase
  .from("screenings")
  .select("id, role, level, experience, scenario_seed, status, company_id")
  .eq("id", screeningId)
  .eq("status", "active")
  .single();

if (screeningError || !screening) {
  return NextResponse.json(
    { error: "Invalid or inactive screening" },
    { status: 404 }
  );
}

if (
  screening.role !== role ||
  screening.level !== level ||
  screening.experience !== experience ||
  screening.scenario_seed !== seed
) {
  return NextResponse.json(
    { error: "Screening mismatch" },
    { status: 403 }
  );
}
    const { data: companyProfile, error: usageError } = await supabase
      .from("profiles")
      .select("id, plan, subscription_status, monthly_candidate_limit, current_month_candidates, overage_price")
      .eq("company_id", screening.company_id)
      .maybeSingle();

    if (usageError || !companyProfile) {
      return NextResponse.json(
        { error: "Company billing profile not found." },
        { status: 403 }
      );
    }

    const used = Number(companyProfile.current_month_candidates || 0);
    const limit = Number(companyProfile.monthly_candidate_limit || 5);
    const overage = Number(companyProfile.overage_price || 0);

    if (used >= limit) {
      return NextResponse.json(
        {
          error: `Candidate limit reached. Your plan includes ${limit} candidates/month. Extra candidates are ${overage || 8} each. Upgrade or enable overage billing.`,
        },
        { status: 403 }
      );
    }

    const parsed = normalizeScorePayload(parsedRaw, hardRedFlags, signal, role, level, experience);

    const { error } = await supabase.from("screening_attempts").insert({
      screening_id: screeningId,
      candidate_name: candidateName,
      candidate_email: candidateEmail,
      role,
      level,
      experience,
      seed,
      status: "completed",
      score: parsed.score,
      verdict: parsed.verdict,
      summary: parsed.summary,
      strengths: parsed.strengths,
      weaknesses: parsed.weaknesses,
      red_flags: parsed.redFlags,
      dimension_scores: parsed.dimensionScores,
      phase_scores: parsed.phaseScores,
      recommendation: parsed.recommendation,
      transcript: cleanMessages,
      evidence: parsed.evidence,
      hiring_risk: parsed.hiringRisk,
      interview_quality: parsed.interviewQuality,
    });

    if (!error) {
      await supabase
        .from("profiles")
        .update({ current_month_candidates: used + 1 })
        .eq("id", companyProfile.id);
    }

    if (error) {
      console.error("Supabase save error:", error);

      return NextResponse.json(
        { error: "Score generated but failed to save result" },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Submit error:", err);

    return NextResponse.json(
      {
        score: 0,
        verdict: "strong_reject",
        summary: "Evaluation failed.",
      },
      { status: 500 }
    );
  }
}














