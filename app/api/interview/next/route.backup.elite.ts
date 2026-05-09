export const dynamic = "force-dynamic";

import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Role = "sales" | "support";
type Level = "rep" | "senior" | "manager" | "district_lead";
type Experience = "newcomer" | "experienced";
type Sender = "interviewer" | "customer" | "candidate";

type Message = {
  sender: Sender;
  text: string;
  followUp?: boolean;
};

type InterviewPhase =
  | "intro"
  | "core"
  | "level"
  | "experience"
  | "simulation"
  | "final_scenario"
  | "elite_stretch"
  | "complete"
  | "terminated";

type InterviewStep = {
  phase: InterviewPhase;
  sender: Sender;
  topic: string;
  instruction: string;
};

type GatekeeperResult = {
  shouldAdvance: boolean;
  severity: "pass" | "follow_up" | "warning" | "terminate";
  reason: string;
  followUp?: string;
};

type BehaviorAnalysis = {
  candidateTurns: number;
  weakSignals: number;
  vagueSignals: number;
  dodgeSignals: number;
  discoverySignals: number;
  exactLanguageSignals: number;
  ownershipSignals: number;
  closingSignals: number;
  leadershipSignals: number;
  questionSignals: number;
  strongSignals: number;
  repeatedWeakness: boolean;
  eliteCandidate: boolean;
  pressureTier: "normal" | "sharp" | "final_warning" | "terminate_risk";
  summary: string;
};

function cleanText(value: unknown, max = 1600) {
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
function normalizeMessages(value: unknown): Message[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (m) =>
        m &&
        ["interviewer", "customer", "candidate"].includes(m.sender) &&
        typeof m.text === "string"
    )
    .slice(-90)
    .map((m) => ({
      sender: m.sender as Sender,
      text: cleanText(m.text),
      followUp: typeof m.followUp === "boolean" ? m.followUp : false,
    }))
    .filter((m) => m.text.length > 0);
}

function getLastCandidateMessage(messages: Message[]) {
  return [...messages].reverse().find((m) => m.sender === "candidate");
}

function getLastNonCandidateMessage(messages: Message[]) {
  return [...messages].reverse().find((m) => m.sender !== "candidate");
}

function buildTranscript(messages: Message[]) {
  if (messages.length === 0) return "No conversation yet.";

  return messages
    .map((m) => {
      if (m.sender === "candidate") return `Candidate: ${m.text}`;
      if (m.sender === "customer") return `Customer: ${m.text}`;
      return `Interviewer: ${m.text}`;
    })
    .join("\n");
}

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function hasSevereMisconduct(text: string) {
  const lower = text.toLowerCase();

  const violent = [
    "i will shoot",
    "i'll shoot",
    "shoot you",
    "kill you",
    "i will kill",
    "i'll kill",
    "gun in my hand",
    "beat you",
    "stab you",
  ];

  const abusive = [
    "bitch",
    "fuck you",
    "go fuck",
    "motherfucker",
    "madarchod",
    "bhenchod",
    "behenchod",
    "chutiya",
  ];

  return violent.some((x) => lower.includes(x)) || abusive.some((x) => lower.includes(x));
}

function analyzeBehaviorPattern(messages: Message[]): BehaviorAnalysis {
  const candidateMessages = messages.filter((m) => m.sender === "candidate");
  const recentCandidateMessages = candidateMessages.slice(-5);

  const vaguePatterns = [
    /\bi would help\b/i,
    /\bi will help\b/i,
    /\btry my best\b/i,
    /\bgood customer service\b/i,
    /\bbe nice\b/i,
    /\bbe polite\b/i,
    /\bunderstand their needs\b/i,
    /\bfind the best option\b/i,
    /\bgive them a good deal\b/i,
    /\bexplain everything\b/i,
    /\bhandle it professionally\b/i,
    /\bsolve the problem\b/i,
    /\bmake them happy\b/i,
    /\bprovide better service\b/i,
  ];

  const dodgePatterns = [
    /\bi don'?t know\b/i,
    /\bnot sure\b/i,
    /\bit depends\b/i,
    /\bmaybe\b/i,
    /\bwhatever\b/i,
    /\bask my manager\b/i,
    /\bcall support\b/i,
    /\bthat'?s not my job\b/i,
    /\bi can'?t do anything\b/i,
  ];

  const discoveryPatterns = [
    /\bask\b/i,
    /\bquestions?\b/i,
    /\bwhat are you using\b/i,
    /\bwhat do you need\b/i,
    /\bmonthly budget\b/i,
    /\bcurrent plan\b/i,
    /\bwho is using\b/i,
    /\bhow much data\b/i,
    /\bmain concern\b/i,
    /\bwhat happened\b/i,
    /\bwhen did\b/i,
    /\bcan you show me\b/i,
  ];

  const exactLanguagePatterns = [
    /\bi would say\b/i,
    /\bi'd say\b/i,
    /\blet me\b/i,
    /\bhere'?s what\b/i,
    /\bfirst,?\b/i,
    /\bthen\b/i,
    /\bnext\b/i,
    /".+"/,
    /'.+'/,
  ];

  const ownershipPatterns = [
    /\bi understand\b/i,
    /\blet me take a look\b/i,
    /\bi can check\b/i,
    /\bi will check\b/i,
    /\bwhat i can do\b/i,
    /\bnext step\b/i,
    /\bfollow up\b/i,
    /\bresolve\b/i,
    /\bown\b/i,
    /\baccountable\b/i,
  ];

  const closingPatterns = [
    /\bnext step\b/i,
    /\bwould you like\b/i,
    /\blet'?s get\b/i,
    /\bmove forward\b/i,
    /\bset this up\b/i,
    /\bstart with\b/i,
    /\bbook\b/i,
    /\bconfirm\b/i,
  ];

  const leadershipPatterns = [
    /\bcoach\b/i,
    /\btrain\b/i,
    /\baccountability\b/i,
    /\bmanager\b/i,
    /\bstore\b/i,
    /\bteam\b/i,
    /\bpattern\b/i,
    /\bmetrics\b/i,
    /\broot cause\b/i,
    /\bfollow up\b/i,
  ];

  let vagueSignals = 0;
  let dodgeSignals = 0;
  let discoverySignals = 0;
  let exactLanguageSignals = 0;
  let ownershipSignals = 0;
  let closingSignals = 0;
  let leadershipSignals = 0;
  let questionSignals = 0;
  let weakSignals = 0;
  let strongSignals = 0;

  for (const message of recentCandidateMessages) {
    const text = message.text.trim();
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    const vague = countMatches(text, vaguePatterns);
    const dodge = countMatches(text, dodgePatterns);
    const discovery = countMatches(text, discoveryPatterns);
    const exact = countMatches(text, exactLanguagePatterns);
    const ownership = countMatches(text, ownershipPatterns);
    const closing = countMatches(text, closingPatterns);
    const leadership = countMatches(text, leadershipPatterns);
    const questions = (text.match(/\?/g) || []).length;

    vagueSignals += vague;
    dodgeSignals += dodge;
    discoverySignals += discovery;
    exactLanguageSignals += exact;
    ownershipSignals += ownership;
    closingSignals += closing;
    leadershipSignals += leadership;
    questionSignals += questions;

    if (wordCount < 16) weakSignals += 2;
    if (wordCount >= 28) strongSignals += 1;
    if (vague > 0 && exact === 0) weakSignals += 2;
    if (dodge > 0) weakSignals += 3;
    if (questions === 0 && discovery === 0 && text.length > 0) weakSignals += 1;
    if (discovery > 0) strongSignals += 1;
    if (exact > 0) strongSignals += 1;
    if (ownership > 0) strongSignals += 1;
    if (closing > 0) strongSignals += 1;
    if (leadership > 0) strongSignals += 1;
  }

  const repeatedWeakness = weakSignals >= 4 || vagueSignals >= 3 || dodgeSignals >= 2;
  const eliteCandidate =
    candidateMessages.length >= 4 &&
    strongSignals >= 5 &&
    weakSignals <= 3 &&
    discoverySignals >= 2 &&
    exactLanguageSignals >= 1;

  const pressureTier: BehaviorAnalysis["pressureTier"] =
    weakSignals >= 8 || dodgeSignals >= 3
      ? "terminate_risk"
      : weakSignals >= 6 || dodgeSignals >= 2
      ? "final_warning"
      : repeatedWeakness
      ? "sharp"
      : "normal";

  const summary = [
    `candidateTurns=${candidateMessages.length}`,
    `weakSignals=${weakSignals}`,
    `vagueSignals=${vagueSignals}`,
    `dodgeSignals=${dodgeSignals}`,
    `discoverySignals=${discoverySignals}`,
    `exactLanguageSignals=${exactLanguageSignals}`,
    `ownershipSignals=${ownershipSignals}`,
    `closingSignals=${closingSignals}`,
    `leadershipSignals=${leadershipSignals}`,
    `questionSignals=${questionSignals}`,
    `strongSignals=${strongSignals}`,
    `repeatedWeakness=${repeatedWeakness}`,
    `eliteCandidate=${eliteCandidate}`,
    `pressureTier=${pressureTier}`,
  ].join("; ");

  return {
    candidateTurns: candidateMessages.length,
    weakSignals,
    vagueSignals,
    dodgeSignals,
    discoverySignals,
    exactLanguageSignals,
    ownershipSignals,
    closingSignals,
    leadershipSignals,
    questionSignals,
    strongSignals,
    repeatedWeakness,
    eliteCandidate,
    pressureTier,
    summary,
  };
}

function shouldTerminateEarly(behavior: BehaviorAnalysis, elapsedSeconds: number | null) {
  if (behavior.candidateTurns < 4) return false;

  if (elapsedSeconds !== null && elapsedSeconds >= 60) {
    return behavior.weakSignals >= 5 || behavior.dodgeSignals >= 2 || behavior.vagueSignals >= 3;
  }

  return behavior.candidateTurns >= 5 && behavior.pressureTier === "terminate_risk";
}

function getSimulationProfile(role: Role, level: Level, experience: Experience, seed: string) {
  const seedValue = seed || "default";

  const personas = [
    "price-sensitive and skeptical",
    "rushed and impatient",
    "confused and overwhelmed",
    "loyal to current provider but curious",
    "frustrated from a previous bad experience",
    "logical and detail-focused",
    "angry but still persuadable if handled well",
    "quiet and hard to open up",
  ];

  const issuesSales = [
    "needs a simple affordable phone for a family member",
    "wants cheaper monthly cost but does not want poor service",
    "is comparing another carrier's offer",
    "wants a new phone but is worried about hidden fees",
    "needs a family plan but does not understand options",
    "is interested but afraid of being locked into something expensive",
    "walked in for only a charger but may upgrade if the rep earns trust",
    "wants to leave their current provider but is scared of surprise charges",
  ];

  const issuesSupport = [
    "unexpected bill increase",
    "roaming charge dispute",
    "data overage complaint",
    "upgrade confusion",
    "previous store promise not visible in account",
    "threatening to cancel after poor service",
    "phone stopped working after a recent change and customer blames the store",
    "customer was told one thing by a rep and now sees something different on the bill",
  ];

  const hash = Array.from(seedValue).reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const persona = personas[hash % personas.length];
  const issue = role === "support" ? issuesSupport[hash % issuesSupport.length] : issuesSales[hash % issuesSales.length];

  const pressure =
    level === "rep"
      ? "frontline pressure"
      : level === "senior"
      ? "strong objection pressure"
      : level === "manager"
      ? "escalation, recovery, and coaching pressure"
      : "multi-store business impact, churn risk, and manager accountability pressure";

  const technicalDepth =
    experience === "newcomer"
      ? "Do not require telecom technical knowledge. Judge behavior, discovery, trust, and control."
      : "Use realistic wireless details and expect practical industry judgment.";

  return `
Locked customer profile:
- Personality: ${persona}
- Core issue: ${issue}
- Pressure level: ${pressure}
- Experience rule: ${technicalDepth}

Simulation behavior:
- Stay consistent with this same customer profile.
- Do not reveal all details immediately.
- Reward strong discovery by giving useful details.
- Punish vague, scripted, dishonest, pushy, or generic answers.
- If candidate recommends before discovery, resist.
- If candidate ignores the concern, push back directly.
- If candidate asks strong questions, answer naturally but increase difficulty.
- If candidate earns trust, become slightly more cooperative but still require a clear next step.
- If candidate fails repeatedly, ask for escalation or end the conversation.
`;
}

function getExperienceRules(experience: Experience): string {
  if (experience === "newcomer") {
    return `
Candidate is new to wireless.

STRICT:
Do NOT ask technical wireless knowledge questions.
Do NOT ask about carrier-specific plans, porting, SIM/eSIM provisioning, activation fees, financing rules, roaming packages, or internal policy.

Still test hard:
- discovery
- objection handling
- persuasion
- trust
- confidence
- customer control
- exact wording
- judgment
- ownership
- leadership judgment if manager/district lead
`;
  }

  return `
Candidate has wireless experience.

Test practical wireless judgment:
- bills
- fees
- upgrades
- plans
- device payments
- trade-in confusion
- roaming/data issues
- competitor objections
- retention risk
- customer recovery
- store-floor decision-making
`;
}

function getBlueprint(role: Role, level: Level, experience: Experience, behavior: BehaviorAnalysis): InterviewStep[] {
  const baseSales: InterviewStep[] = [
    {
      phase: "intro",
      sender: "interviewer",
      topic: "background_fit",
      instruction: "Ask for a brief sales, retail, or customer-facing background. Demand a specific example, not a generic claim.",
    },
    {
      phase: "core",
      sender: "interviewer",
      topic: "discovery",
      instruction: "Customer wants the cheapest option. Ask what exact questions the candidate asks before recommending anything.",
    },
    {
      phase: "core",
      sender: "interviewer",
      topic: "price_objection",
      instruction: "Ask how they handle a customer saying another carrier is cheaper. Require exact wording.",
    },
    {
      phase: "core",
      sender: "interviewer",
      topic: "trust_control",
      instruction: "Ask how they build trust with a skeptical customer who thinks they are just being sold to.",
    },
  ];

  const baseSupport: InterviewStep[] = [
    {
      phase: "intro",
      sender: "interviewer",
      topic: "background_fit",
      instruction: "Ask for customer-facing background and a specific example of handling a difficult customer.",
    },
    {
      phase: "core",
      sender: "interviewer",
      topic: "deescalation",
      instruction: "Ask how they handle a frustrated customer without sounding fake or scripted. Require exact words.",
    },
    {
      phase: "core",
      sender: "interviewer",
      topic: "ownership",
      instruction: "Ask how they take ownership when the customer believes the company caused the issue.",
    },
    {
      phase: "core",
      sender: "interviewer",
      topic: "clarity",
      instruction: "Ask how they explain a confusing bill, charge, or support issue simply with a clear next step.",
    },
  ];

  const levelSales: Record<Level, InterviewStep[]> = {
    rep: [
      { phase: "level", sender: "interviewer", topic: "rep_close", instruction: "Ask how they move a hesitant customer toward a decision without being pushy. Require exact words." },
      { phase: "level", sender: "interviewer", topic: "rep_short_answers", instruction: "Ask how they handle a customer who gives short answers and will not open up." },
    ],
    senior: [
      { phase: "level", sender: "interviewer", topic: "senior_comparison", instruction: "Ask how they compare options and make a confident recommendation without confusing the customer." },
      { phase: "level", sender: "interviewer", topic: "senior_save", instruction: "Ask how they save a near-lost customer who is ready to leave for a competitor." },
    ],
    manager: [
      { phase: "level", sender: "interviewer", topic: "manager_rep_behavior", instruction: "Scenario: a rep is pushing too aggressively and complaints are rising. Ask what they do today, this week, and how they coach." },
      { phase: "level", sender: "interviewer", topic: "manager_escalation", instruction: "Scenario: angry customer, rep mistake, public store tension. Ask how they recover customer trust and hold the rep accountable." },
    ],
    district_lead: [
      { phase: "level", sender: "interviewer", topic: "dtl_underperformance", instruction: "Scenario: five stores underperform and managers blame low traffic. Ask what they investigate and what actions they take." },
      { phase: "level", sender: "interviewer", topic: "dtl_pattern_complaints", instruction: "Scenario: repeated customer complaints across stores. Ask how they identify the root cause and enforce manager accountability." },
    ],
  };

  const levelSupport: Record<Level, InterviewStep[]> = {
    rep: [
      { phase: "level", sender: "interviewer", topic: "support_rep_resolution", instruction: "Ask how they calm a customer and give a clear realistic next step." },
      { phase: "level", sender: "interviewer", topic: "support_no_promise", instruction: "Ask how they respond when the customer demands something they cannot promise." },
    ],
    senior: [
      { phase: "level", sender: "interviewer", topic: "support_repeat_issue", instruction: "Ask how they handle a repeat issue where previous support failed." },
      { phase: "level", sender: "interviewer", topic: "support_retention", instruction: "Ask how they handle a customer threatening to cancel after a bad support experience." },
    ],
    manager: [
      { phase: "level", sender: "interviewer", topic: "support_manager_coaching", instruction: "Scenario: team member gives unclear answers and complaints rise. Ask how they coach and verify improvement." },
      { phase: "level", sender: "interviewer", topic: "support_manager_recovery", instruction: "Scenario: the store made a mistake. Ask how they recover the customer and prevent repeat failure." },
    ],
    district_lead: [
      { phase: "level", sender: "interviewer", topic: "support_dtl_repeat_issues", instruction: "Scenario: repeated support complaints across stores. Ask how they find the pattern and fix it." },
      { phase: "level", sender: "interviewer", topic: "support_dtl_accountability", instruction: "Ask how they hold managers accountable without simply blaming frontline staff." },
    ],
  };

  const newcomer: InterviewStep[] = [
    { phase: "experience", sender: "interviewer", topic: "newcomer_transferable", instruction: "Ask a hard customer scenario testing persuasion, discovery, and control without technical wireless knowledge." },
    { phase: "experience", sender: "interviewer", topic: "newcomer_pressure", instruction: "Ask how they handle pressure from a customer demanding a quick cheap answer." },
  ];

  const experiencedSales: InterviewStep[] = [
    { phase: "experience", sender: "interviewer", topic: "experienced_wireless_bill", instruction: "Ask a wireless-specific sales question involving monthly cost clarity, fees, device payments, or value comparison." },
    { phase: "experience", sender: "interviewer", topic: "experienced_competitor", instruction: "Ask a practical competitor objection question with a realistic wireless detail." },
  ];

  const experiencedSupport: InterviewStep[] = [
    { phase: "experience", sender: "interviewer", topic: "experienced_billing_dispute", instruction: "Ask a wireless support question involving billing dispute, roaming charge, upgrade confusion, or data overage." },
    { phase: "experience", sender: "interviewer", topic: "experienced_policy_explanation", instruction: "Ask how they explain policy clearly while keeping the customer calm." },
  ];

  const simulation: InterviewStep[] = [
    { phase: "simulation", sender: "customer", topic: "live_customer_opening", instruction: "Start a realistic wireless customer roleplay. Customer has one clear concern. Candidate must handle it." },
    { phase: "simulation", sender: "customer", topic: "live_customer_pushback", instruction: "Continue as customer. Push back based on candidate's last answer." },
    { phase: "simulation", sender: "customer", topic: "live_customer_deeper_objection", instruction: "Continue as customer. Make objection specific. Force clarification, control, or recovery." },
    { phase: "simulation", sender: "customer", topic: "live_customer_decision", instruction: "If candidate is strong, become open to next step. If weak, say you are not convinced or ask for escalation." },
  ];

  const finalScenario: Record<Level, InterviewStep> = {
    rep: { phase: "final_scenario", sender: "interviewer", topic: "final_rep", instruction: "Hard final frontline scenario: skeptical customer, price pressure, and moving conversation forward. Require exact words." },
    senior: { phase: "final_scenario", sender: "interviewer", topic: "final_senior", instruction: "Hard final senior scenario: competitor pressure, hesitation, and confident recommendation." },
    manager: { phase: "final_scenario", sender: "interviewer", topic: "final_manager", instruction: "Hard final manager scenario: angry customer, rep mistake, coaching, and accountability after the interaction." },
    district_lead: { phase: "final_scenario", sender: "interviewer", topic: "final_dtl", instruction: "Hard final district lead scenario: multiple underperforming stores, complaints, churn risk, and manager accountability." },
  };

  const eliteStretch: InterviewStep[] = behavior.eliteCandidate
    ? [
        {
          phase: "elite_stretch",
          sender: level === "rep" || level === "senior" ? "customer" : "interviewer",
          topic: "elite_stretch_pressure",
          instruction:
            level === "manager" || level === "district_lead"
              ? "Candidate is strong. Ask one tougher leadership scenario involving business impact, customer trust, and coaching/accountability."
              : "Candidate is strong. Continue as a harder customer with a hidden objection. Test whether they can close or recover without becoming pushy.",
        },
      ]
    : [];

  const base = role === "support" ? baseSupport : baseSales;
  const levelBlock = role === "support" ? levelSupport[level] : levelSales[level];
  const experienceBlock = experience === "newcomer" ? newcomer : role === "support" ? experiencedSupport : experiencedSales;

  return [...base, ...levelBlock, ...experienceBlock, ...simulation, finalScenario[level], ...eliteStretch];
}

type AnswerWeakness = {
  lacksNumbers: boolean;
  lacksOwnership: boolean;
  vague: boolean;
  noOutcome: boolean;
  noExactWords: boolean;
};

function analyzeAnswerWeakness(answer: string): AnswerWeakness {
  const text = answer.toLowerCase();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return {
    lacksNumbers: !/\d+|percent|percentage|revenue|dollar|save|saved|retention|churn|lines?|customers?|days?|weeks?|months?/i.test(text),
    lacksOwnership:
      /\bwe\b/i.test(text) &&
      !/\bi\b|\bmy\b|\bme\b|\bi personally\b|\bi took\b|\bi handled\b|\bi asked\b|\bi explained\b/i.test(text),
    vague:
      wordCount < 55 ||
      /\bhelp them\b|\btry my best\b|\bgood service\b|\bhandle professionally\b|\bmake them happy\b|\bexplain everything\b|\bsolve the problem\b/i.test(text),
    noOutcome:
      !/\bresult\b|\boutcome\b|\bresolved\b|\bsaved\b|\bclosed\b|\bstayed\b|\bcancelled\b|\bescalated\b|\bretained\b|\bde-escalated\b|\bconverted\b/i.test(text),
    noExactWords:
      !/"[^"]{8,}"/.test(answer) &&
      !/\bi would say\b|\bi'd say\b|\bmy exact words\b|\bi told them\b|\bi asked them\b/i.test(text),
  };
}

function generatePrecisionFollowUp(
  answer: string,
  step: InterviewStep,
  behavior: BehaviorAnalysis
): string | null {
  const weakness = analyzeAnswerWeakness(answer);
  const isLeadership = step.topic.includes("manager") || step.topic.includes("dtl") || step.topic.includes("lead");
  const isCustomerRoleplay = step.sender === "customer";

  if (isLeadership && weakness.lacksOwnership) {
    return "You are speaking in team terms. What exactly did you personally do as the leader, and what standard did you enforce?";
  }

  if (isLeadership && weakness.noOutcome) {
    return "What changed after your action—customer retention, team behavior, complaint rate, or store execution?";
  }

  if (weakness.lacksNumbers && behavior.pressureTier !== "normal") {
    return "Give me exact numbers: how many customers, how much revenue, how many lines, what retention impact, or what timeline?";
  }

  if (weakness.noOutcome) {
    return isCustomerRoleplay
      ? "That still does not tell me what happens next. Do I stay, cancel, escalate, or get a clear resolution?"
      : "What was the final outcome—did the customer stay, cancel, escalate, buy, or accept the next step?";
  }

  if (weakness.noExactWords) {
    return isCustomerRoleplay
      ? "Give me the exact words you would say to me right now."
      : "Give me the exact words you would use, not the general idea.";
  }

  if (weakness.vague) {
    return "That is too broad. Walk me through the exact first three actions you would take.";
  }

  return null;
}
function getPressureInstruction(behavior: BehaviorAnalysis, step: InterviewStep): string {
  const speaker = step.sender === "customer" ? "as the customer" : "as the interviewer";

  if (behavior.pressureTier === "terminate_risk") {
    return `
Pressure mode: TERMINATION RISK.
The candidate has repeatedly failed with vague, dodging, or unusable answers.
Challenge them ${speaker} one final time only if not already terminated.
Demand exact words and exact next action.
`;
  }

  if (behavior.pressureTier === "final_warning") {
    return `
Pressure mode: FINAL WARNING.
Do not move on casually.
Challenge them ${speaker} with consequence.
Demand exact words, exact question, or exact next action.
`;
  }

  if (behavior.pressureTier === "sharp") {
    return `
Pressure mode: SHARP.
Cross-question ${speaker}.
Force specificity.
Do not accept generic claims.
`;
  }

  return `
Pressure mode: NORMAL.
Ask a clean premium question.
If the last answer was vague, cross-question instead of moving forward.
`;
}

async function evaluateLastAnswer({
  role,
  level,
  experience,
  currentStep,
  messages,
  behavior,
}: {
  role: Role;
  level: Level;
  experience: Experience;
  currentStep: InterviewStep;
  messages: Message[];
  behavior: BehaviorAnalysis;
}): Promise<GatekeeperResult> {
  const lastCandidate = getLastCandidateMessage(messages);
  const lastPrompt = getLastNonCandidateMessage(messages);

  if (!lastCandidate || !lastPrompt) {
    return { shouldAdvance: true, severity: "pass", reason: "No candidate answer to evaluate." };
  }

  if (hasSevereMisconduct(lastCandidate.text)) {
    return {
      shouldAdvance: false,
      severity: "terminate",
      reason: "Severe misconduct or threatening/abusive language.",
      followUp:
        "This interview is being ended because your last response was abusive, threatening, or completely unacceptable for a customer-facing role.",
    };
  }

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    input: `
You are Hireque's elite answer-quality gatekeeper.

Role: ${role}
Level: ${level}
Experience: ${experience}

Current required step:
Phase: ${currentStep.phase}
Topic: ${currentStep.topic}
Instruction: ${currentStep.instruction}

Behavior memory:
${behavior.summary}

Last prompt:
${lastPrompt.sender}: ${lastPrompt.text}

Candidate answer:
${lastCandidate.text}

Decision rules:
Advance only if the answer directly addresses the prompt with usable substance.

Do NOT advance if:
- vague
- generic
- dodging
- no concrete next action 
- no exact wording when needed
- ignores customer concern
- recommends before discovery
- unrealistic promise
- blames customer
- fake HR-style answer
- weak leadership judgment for manager/district_lead

Escalation:
- normal: one direct follow-up
- sharp: call out vagueness and demand exact wording/action
- final_warning: harsher consequence-based follow-up
- terminate_risk: terminate if answer is still vague, dodging, disrespectful, or unusable

Follow-up quality rules:
- Never ask generic "can you elaborate?"
- Pin the candidate to numbers, exact words, ownership, outcome, or next action.
- One precise challenge only.
- If they already had a follow-up, pivot instead of repeating.

Return STRICT JSON only:
{
  "shouldAdvance": boolean,
  "severity": "pass" | "follow_up" | "warning" | "terminate",
  "reason": "short reason",
  "followUp": "one concise follow-up question/challenge if not advancing"
}
`,
  });

  try {
    const parsed = JSON.parse(response.output_text || "{}") as Partial<GatekeeperResult>;

    if (typeof parsed.shouldAdvance !== "boolean") throw new Error("Invalid JSON");

    return {
      shouldAdvance: parsed.shouldAdvance,
      severity: parsed.severity || (parsed.shouldAdvance ? "pass" : "follow_up"),
      reason: parsed.reason || "No reason provided.",
      followUp: parsed.followUp,
    };
  } catch {
    return {
      shouldAdvance: false,
      severity: behavior.pressureTier === "terminate_risk" ? "warning" : "follow_up",
      reason: "Answer could not be accepted confidently.",
      followUp:
        currentStep.sender === "customer"
          ? "You are still being vague. What exactly are you going to do for me right now?"
          : "That is still generic. Give me the exact words you would use and the exact next action.",
    };
  }
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const body = await req.json();

    const role = normalizeRole(body.role);
    const level = normalizeLevel(body.level);
    const experience = normalizeExperience(body.experience);
    const seed = cleanText(body.seed, 500) || "wireless retail screening";
    const messages = normalizeMessages(body.messages);
    const behavior = analyzeBehaviorPattern(messages);

    const recentFollowUps = messages
      .slice(-6)
      .filter((m) => m.followUp).length;

    const maxFollowUps =
      behavior.pressureTier === "terminate_risk" ? 2 :
      behavior.pressureTier === "final_warning" ? 2 :
      behavior.pressureTier === "sharp" ? 1 : 1;

    const shouldPivotInsteadOfRepeat =
      recentFollowUps >= maxFollowUps &&
      behavior.pressureTier !== "terminate_risk";

    const elapsedSeconds =
      typeof body.elapsedSeconds === "number" && Number.isFinite(body.elapsedSeconds)
        ? Math.max(0, body.elapsedSeconds)
        : null;

    const acceptedPromptCount =
      typeof body.acceptedPromptCount === "number" && Number.isFinite(body.acceptedPromptCount)
        ? Math.max(0, Math.floor(body.acceptedPromptCount))
        : 0;

    const blueprint = getBlueprint(role, level, experience, behavior);
    const lastCompletedStep = acceptedPromptCount > 0 ? blueprint[acceptedPromptCount - 1] : undefined;

    if (shouldTerminateEarly(behavior, elapsedSeconds)) {
      return NextResponse.json({
        phase: "terminated",
        sender: "interviewer",
        topic: "early_quality_fail",
        text:
          "I am ending the interview here. Your answers stayed too vague or off-target for this customer-facing role, and I do not have enough concrete evidence to continue.",
        complete: true,
        terminated: true,
        reason: "Repeated vague, dodging, or unusable answers.",
        behavior,
      });
    }

    if (acceptedPromptCount > 0 && lastCompletedStep) {
      const gate = await evaluateLastAnswer({
        role,
        level,
        experience,
        currentStep: lastCompletedStep,
        messages,
        behavior,
      });

      const lastCandidateMessage = getLastCandidateMessage(messages);
      const precisionFollowUp = lastCandidateMessage
        ? generatePrecisionFollowUp(lastCandidateMessage.text, lastCompletedStep, behavior)
        : null;

      if (gate.severity === "terminate") {
        return NextResponse.json({
          phase: "terminated",
          sender: "interviewer",
          topic: "terminated",
          text:
            gate.followUp ||
            "This interview is being ended because the last response was unacceptable for a customer-facing role.",
          complete: true,
          terminated: true,
          reason: gate.reason,
          behavior,
        });
      }

      if (!gate.shouldAdvance && shouldPivotInsteadOfRepeat) {
        const pivotStep = blueprint[Math.min(acceptedPromptCount + 1, blueprint.length - 1)];

        if (pivotStep) {
          const pivotResponse = await client.responses.create({
            model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
            input: `
You are Hireque's elite wireless hiring examiner.

The candidate gave an incomplete answer and already received one follow-up.
Do NOT repeat the same question again.
Pivot to a new but related scenario that tests the same weakness from a different angle.

Role: ${role}
Level: ${level}
Experience: ${experience}

Next pivot step:
Phase: ${pivotStep.phase}
Topic: ${pivotStep.topic}
Sender: ${pivotStep.sender}
Instruction: ${pivotStep.instruction}

Conversation so far:
${buildTranscript(messages)}

Rules:
- One message only.
- 1 to 3 sentences.
- Do not say "you failed" or mention scoring.
- Keep pressure, but move the interview forward.
- If manager/district_lead, pivot toward coaching/accountability.
- If rep/senior, pivot toward customer handling, discovery, or next step.
- If customer roleplay, speak as the customer.
`,
          });

          return NextResponse.json({
            phase: pivotStep.phase,
            sender: pivotStep.sender,
            topic: `${pivotStep.topic}_pivot`,
            text:
              pivotResponse.output_text?.trim() ||
              "Let us shift to a different scenario. A customer is still frustrated after your first attempt to help. What exactly do you do next?",
            complete: false,
            followUp: false,
            pivoted: true,
            reason: gate.reason,
            pressureTier: behavior.pressureTier,
          });
        }
      }

      if (!gate.shouldAdvance) {
        return NextResponse.json({
          phase: lastCompletedStep.phase,
          sender: lastCompletedStep.sender,
          topic: `${lastCompletedStep.topic}_follow_up`,
          text:
            precisionFollowUp ||
            gate.followUp ||
            (lastCompletedStep.sender === "customer"
              ? "That still does not answer my concern. What exactly would you do for me right now?"
              : "That did not directly answer the question. Give me the exact action you would take and the words you would use."),
          complete: false,
          followUp: true,
          reason: gate.reason,
          pressureTier: behavior.pressureTier,
        });
      }
    }

    const step = blueprint[acceptedPromptCount];

    if (!step) {
      return NextResponse.json({
        phase: "complete",
        sender: "interviewer",
        topic: "complete",
        text:
          behavior.eliteCandidate
            ? "That completes the interview. You handled the pressure well enough for final evaluation. Please submit your interview."
            : "That completes the interview. Please submit your final response.",
        complete: true,
        pressureTier: behavior.pressureTier,
        eliteCandidate: behavior.eliteCandidate,
      });
    }

    const transcript = buildTranscript(messages);
    const simulationProfile = getSimulationProfile(role, level, experience, seed);
    const pressureInstruction = getPressureInstruction(behavior, step);

    const roleRules =
      role === "support"
        ? "Wireless customer support screening. Test ownership, de-escalation, clarity, realistic resolution, retention risk, honesty, and control under pressure."
        : "Wireless sales screening. Test discovery, persuasion, trust, objection handling, recommendation quality, customer control, closing instinct, and ability to avoid sounding fake.";

    const levelRules: Record<Level, string> = {
      rep: "Frontline role. Test execution, clarity, confidence, basic objection handling, exact wording, and customer control.",
      senior:
        "Senior individual contributor. Test sharper judgment, confident recommendation, competitor pressure, and ability to guide a difficult customer.",
      manager:
        "Store manager. Test escalation handling, customer recovery, rep coaching, accountability, store judgment, and protection of standards.",
      district_lead:
        "District lead. Test multi-store leadership, manager accountability, pattern diagnosis, churn risk, operational judgment, and business impact.",
    };

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: `
You are Hireque's elite wireless hiring examiner.

Role: ${role}
Level: ${level}
Experience: ${experience}
Seed: ${seed}

Current step:
Phase: ${step.phase}
Topic: ${step.topic}
Sender: ${step.sender}
Instruction: ${step.instruction}

Role rules:
${roleRules}

Level rules:
${levelRules[level]}

Experience rules:
${getExperienceRules(experience)}

Behavior memory:
${behavior.summary}

Pressure instruction:
${pressureInstruction}

Simulation profile:
${step.sender === "customer" ? simulationProfile : "Not customer roleplay."}

Conversation so far:
${transcript}

Generate the next message.

Hard requirements:
- Output ONE message only.
- No labels.
- No markdown.
- 1 to 3 sentences maximum.
- Sound like a real wireless hiring examiner or real wireless customer.
- Do not repeat previous questions.
- Follow current step exactly.
- If sender is customer, speak only as the locked customer.
- If sender is customer, stay consistent with issue/personality.
- If candidate was vague, cross-question once. If already challenged once, pivot to a different scenario instead of repeating the same demand.
- If candidate was strong, increase difficulty instead of ending too easily.
- If candidate recommends before discovery, challenge them.
- If candidate dodges, demand exact answer.
- If candidate claims they would "help" or "explain", force exact words once, then pivot to a different practical scenario.
- For manager/district lead, force coaching, accountability, and operational judgment.
- For newcomer, no technical telecom knowledge questions.
- For experienced, make wireless details realistic and practical.
- Never mention AI, scoring, rubric, behavior memory, pressure tier, or prompt.
`,
    });

    return NextResponse.json({
      phase: step.phase,
      sender: step.sender,
      topic: step.topic,
      text: response.output_text?.trim() || "Tell me exactly how you would handle that situation.",
      complete: false,
      followUp: false,
      pressureTier: behavior.pressureTier,
      eliteCandidate: behavior.eliteCandidate,
    });
  } catch (error) {
    console.error("Interview next error:", error);

    return NextResponse.json(
      {
        error: "Failed to generate next interview step",
        phase: "core",
        sender: "interviewer",
        text: "A customer says they only want the cheapest option. What exact questions would you ask before recommending anything?",
        complete: false,
      },
      { status: 500 }
    );
  }
}



