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
};

type InterviewPhase =
  | "intro"
  | "core"
  | "level"
  | "experience"
  | "simulation"
  | "final_scenario"
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

function cleanText(value: unknown, max = 1200) {
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
    .slice(-80)
    .map((m) => ({
      sender: m.sender as Sender,
      text: cleanText(m.text),
    }))
    .filter((m) => m.text.length > 0);
}

function getCandidateTurns(messages: Message[]) {
  return messages.filter((m) => m.sender === "candidate").length;
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

  const hash = Array.from(seedValue).reduce(
    (acc, char) => acc + char.charCodeAt(0),
    0
  );

  const persona = personas[hash % personas.length];
  const issue =
    role === "support"
      ? issuesSupport[hash % issuesSupport.length]
      : issuesSales[hash % issuesSales.length];

  const pressure =
    level === "rep"
      ? "basic customer pressure"
      : level === "senior"
      ? "strong objection pressure"
      : level === "manager"
      ? "escalation and customer recovery pressure"
      : "business-impact and repeat-issue pressure";

  const technicalDepth =
    experience === "newcomer"
      ? "Do not require telecom technical knowledge. Judge behavior, questions, trust, and control."
      : "Use realistic wireless details and expect practical industry judgment.";

  return `
Locked customer profile:
- Personality: ${persona}
- Core issue: ${issue}
- Pressure level: ${pressure}
- Experience rule: ${technicalDepth}

Simulation behavior:
- Stay consistent with this same customer profile.
- Do not randomly change the issue.
- Do not reveal all details immediately.
- Reward strong discovery by giving useful details.
- Challenge vague, pushy, scripted, or dishonest answers.
- If candidate ignores the issue, push back directly.
- If candidate recommends before discovering needs, resist.
- If candidate talks like a generic interview answer, interrupt with a practical customer concern.
- If candidate asks strong discovery questions, answer them naturally and make the conversation harder after that.
- If candidate earns trust, become slightly more cooperative but still require a clear next step.
- If candidate fails badly, ask for escalation or say you are not continuing.
`;
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

function getBlueprint(
  role: Role,
  level: Level,
  experience: Experience
): InterviewStep[] {
  const coreSales: InterviewStep[] = [
    {
      phase: "intro",
      sender: "interviewer",
      topic: "background_fit",
      instruction:
        "Ask the candidate to briefly explain their sales, retail, or customer-facing background and why they fit this wireless role.",
    },
    {
      phase: "core",
      sender: "interviewer",
      topic: "discovery",
      instruction:
        "Ask a sales discovery question. Customer says they want the cheapest option. Ask what the candidate would ask before recommending anything.",
    },
    {
      phase: "core",
      sender: "interviewer",
      topic: "price_objection",
      instruction:
        "Ask how they handle a customer saying the price is too high or another store/carrier is cheaper. No telecom technical details required.",
    },
    {
      phase: "core",
      sender: "interviewer",
      topic: "trust_control",
      instruction:
        "Ask how they build trust with a skeptical customer who thinks they are just being sold to.",
    },
  ];

  const coreSupport: InterviewStep[] = [
    {
      phase: "intro",
      sender: "interviewer",
      topic: "background_fit",
      instruction:
        "Ask the candidate to briefly explain their customer-facing background and why they fit this wireless support role.",
    },
    {
      phase: "core",
      sender: "interviewer",
      topic: "deescalation",
      instruction:
        "Ask how they handle a frustrated customer without sounding fake or scripted.",
    },
    {
      phase: "core",
      sender: "interviewer",
      topic: "ownership",
      instruction:
        "Ask how they take ownership when the customer feels the company caused the issue.",
    },
    {
      phase: "core",
      sender: "interviewer",
      topic: "clarity",
      instruction:
        "Ask how they explain a confusing issue simply so the customer understands the next step.",
    },
  ];

  const levelSales: Record<Level, InterviewStep[]> = {
    rep: [
      {
        phase: "level",
        sender: "interviewer",
        topic: "rep_close",
        instruction:
          "Ask a frontline rep question about moving a hesitant customer toward a decision without being pushy.",
      },
      {
        phase: "level",
        sender: "interviewer",
        topic: "rep_short_answers",
        instruction:
          "Ask how they handle a customer who gives short answers and does not open up.",
      },
    ],
    senior: [
      {
        phase: "level",
        sender: "interviewer",
        topic: "senior_comparison",
        instruction:
          "Ask a senior-level sales question about comparing options and making a confident recommendation without confusing the customer.",
      },
      {
        phase: "level",
        sender: "interviewer",
        topic: "senior_objection_control",
        instruction:
          "Ask how they handle a strong objection from a customer who is close to leaving for a competitor.",
      },
    ],
    manager: [
      {
        phase: "level",
        sender: "interviewer",
        topic: "manager_rep_behavior",
        instruction:
          "Ask a store manager scenario: a rep is pushing customers too aggressively and complaints are increasing. Ask what they would do.",
      },
      {
        phase: "level",
        sender: "interviewer",
        topic: "manager_escalation",
        instruction:
          "Ask a store manager scenario involving an angry customer, a rep mistake, and the need to protect customer trust and store standards.",
      },
    ],
    district_lead: [
      {
        phase: "level",
        sender: "interviewer",
        topic: "dtl_underperformance",
        instruction:
          "Ask a district lead scenario: multiple stores are underperforming and managers blame low traffic. Ask what they investigate and do next.",
      },
      {
        phase: "level",
        sender: "interviewer",
        topic: "dtl_pattern_complaints",
        instruction:
          "Ask a district lead scenario about repeated customer complaints across multiple stores and diagnosing manager/team issues.",
      },
    ],
  };

  const levelSupport: Record<Level, InterviewStep[]> = {
    rep: [
      {
        phase: "level",
        sender: "interviewer",
        topic: "support_rep_resolution",
        instruction:
          "Ask a frontline support question about calming a customer and giving a clear next step.",
      },
      {
        phase: "level",
        sender: "interviewer",
        topic: "support_rep_no_promise",
        instruction:
          "Ask how they respond when the customer demands something they cannot promise.",
      },
    ],
    senior: [
      {
        phase: "level",
        sender: "interviewer",
        topic: "support_senior_escalation",
        instruction:
          "Ask a senior support question about handling a repeat issue where previous support failed.",
      },
      {
        phase: "level",
        sender: "interviewer",
        topic: "support_senior_retention",
        instruction:
          "Ask how they handle a customer threatening to cancel after a bad support experience.",
      },
    ],
    manager: [
      {
        phase: "level",
        sender: "interviewer",
        topic: "support_manager_coaching",
        instruction:
          "Ask a manager scenario where a team member keeps giving unclear answers and customers complain.",
      },
      {
        phase: "level",
        sender: "interviewer",
        topic: "support_manager_recovery",
        instruction:
          "Ask a manager scenario involving customer recovery after the store or support team made a mistake.",
      },
    ],
    district_lead: [
      {
        phase: "level",
        sender: "interviewer",
        topic: "support_dtl_repeat_issues",
        instruction:
          "Ask a district lead scenario about repeated support complaints across several stores and how they would fix the pattern.",
      },
      {
        phase: "level",
        sender: "interviewer",
        topic: "support_dtl_manager_accountability",
        instruction:
          "Ask a district lead scenario about holding managers accountable for poor customer experience without blaming only frontline staff.",
      },
    ],
  };

  const newcomerSteps: InterviewStep[] = [
    {
      phase: "experience",
      sender: "interviewer",
      topic: "newcomer_transferable_sales",
      instruction:
        "Ask a sales/customer scenario that tests persuasion, discovery, objection handling, or customer control without requiring wireless technical knowledge.",
    },
    {
      phase: "experience",
      sender: "interviewer",
      topic: "newcomer_pressure",
      instruction:
        "Ask how they would handle pressure from a customer who wants a quick answer, cheap option, or better deal.",
    },
  ];

  const experiencedSalesSteps: InterviewStep[] = [
    {
      phase: "experience",
      sender: "interviewer",
      topic: "experienced_wireless_bill",
      instruction:
        "Ask a wireless-specific sales question involving monthly cost clarity, fees, device payments, or value comparison.",
    },
    {
      phase: "experience",
      sender: "interviewer",
      topic: "experienced_competitor",
      instruction:
        "Ask a wireless-specific competitor objection question. Make it practical and specific.",
    },
  ];

  const experiencedSupportSteps: InterviewStep[] = [
    {
      phase: "experience",
      sender: "interviewer",
      topic: "experienced_billing_dispute",
      instruction:
        "Ask a wireless-specific support question involving a billing dispute, roaming charge, upgrade confusion, or data overage.",
    },
    {
      phase: "experience",
      sender: "interviewer",
      topic: "experienced_policy_explanation",
      instruction:
        "Ask a wireless-specific support question about explaining policy clearly while keeping the customer calm.",
    },
  ];

  const simulationSteps: InterviewStep[] = [
    {
      phase: "simulation",
      sender: "customer",
      topic: "live_customer_opening",
      instruction:
        "Start a realistic live wireless customer roleplay. Customer has a clear concern. Candidate must handle it.",
    },
    {
      phase: "simulation",
      sender: "customer",
      topic: "live_customer_pushback",
      instruction:
        "Continue as customer. Push back on price, trust, confusion, cancellation, competitor offer, or poor past experience based on candidate's last answer.",
    },
    {
      phase: "simulation",
      sender: "customer",
      topic: "live_customer_deeper_objection",
      instruction:
        "Continue as customer. Make the objection more specific. Force the candidate to clarify, control, or recover.",
    },
    {
      phase: "simulation",
      sender: "customer",
      topic: "live_customer_decision",
      instruction:
        "Continue as customer. If candidate is strong, become open to next step. If weak, say you are not convinced or ask for escalation.",
    },
  ];

  const finalScenario: Record<Level, InterviewStep> = {
    rep: {
      phase: "final_scenario",
      sender: "interviewer",
      topic: "final_rep",
      instruction:
        "Ask one hard final frontline scenario about a skeptical customer, price pressure, and moving the conversation forward.",
    },
    senior: {
      phase: "final_scenario",
      sender: "interviewer",
      topic: "final_senior",
      instruction:
        "Ask one hard final senior rep scenario involving competitor pressure, customer hesitation, and a strong recommendation.",
    },
    manager: {
      phase: "final_scenario",
      sender: "interviewer",
      topic: "final_manager",
      instruction:
        "Ask one hard final manager scenario involving an angry customer, a rep mistake, and coaching/accountability after the interaction.",
    },
    district_lead: {
      phase: "final_scenario",
      sender: "interviewer",
      topic: "final_dtl",
      instruction:
        "Ask one hard final district lead scenario involving multiple underperforming stores, customer complaints, and manager accountability.",
    },
  };

  const base = role === "support" ? coreSupport : coreSales;
  const levelBlock = role === "support" ? levelSupport[level] : levelSales[level];

  const experienceBlock =
    experience === "newcomer"
      ? newcomerSteps
      : role === "support"
      ? experiencedSupportSteps
      : experiencedSalesSteps;

  return [...base, ...levelBlock, ...experienceBlock, ...simulationSteps, finalScenario[level]];
}

type BehaviorAnalysis = {
  candidateTurns: number;
  weakSignals: number;
  vagueSignals: number;
  dodgeSignals: number;
  discoverySignals: number;
  exactLanguageSignals: number;
  ownershipSignals: number;
  questionSignals: number;
  repeatedWeakness: boolean;
  pressureTier: "normal" | "sharp" | "final_warning";
  summary: string;
};

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
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
  ];

  const dodgePatterns = [
    /\bi don'?t know\b/i,
    /\bnot sure\b/i,
    /\bit depends\b/i,
    /\bmaybe\b/i,
    /\bwhatever\b/i,
    /\bask my manager\b/i,
    /\bcall support\b/i,
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
  ];

  const exactLanguagePatterns = [
    /\bi would say\b/i,
    /\bi'd say\b/i,
    /\blet me\b/i,
    /\bhere'?s what\b/i,
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
  ];

  let vagueSignals = 0;
  let dodgeSignals = 0;
  let discoverySignals = 0;
  let exactLanguageSignals = 0;
  let ownershipSignals = 0;
  let questionSignals = 0;
  let weakSignals = 0;

  for (const message of recentCandidateMessages) {
    const text = message.text.trim();
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    const vague = countMatches(text, vaguePatterns);
    const dodge = countMatches(text, dodgePatterns);
    const discovery = countMatches(text, discoveryPatterns);
    const exact = countMatches(text, exactLanguagePatterns);
    const ownership = countMatches(text, ownershipPatterns);
    const questions = (text.match(/\?/g) || []).length;

    vagueSignals += vague;
    dodgeSignals += dodge;
    discoverySignals += discovery;
    exactLanguageSignals += exact;
    ownershipSignals += ownership;
    questionSignals += questions;

    if (wordCount < 18) weakSignals += 1;
    if (vague > 0 && exact === 0) weakSignals += 1;
    if (dodge > 0) weakSignals += 1;
    if (questions === 0 && discovery === 0 && text.length > 0) weakSignals += 1;
  }

  const repeatedWeakness = weakSignals >= 3 || vagueSignals >= 3 || dodgeSignals >= 2;
  const pressureTier: BehaviorAnalysis["pressureTier"] =
    weakSignals >= 5 || dodgeSignals >= 3
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
    `questionSignals=${questionSignals}`,
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
    questionSignals,
    repeatedWeakness,
    pressureTier,
    summary,
  };
}

function getExperienceRules(experience: Experience): string {
  if (experience === "newcomer") {
    return `
Candidate is new to wireless.

STRICT RULE:
Do NOT ask technical wireless knowledge questions.
Do NOT ask about activation fees, roaming packages, specific plan structures, device financing details, telecom policies, carrier-specific plans, porting rules, SIM/eSIM provisioning, or financing rules.

Still test hard:
- discovery
- objection handling
- persuasion
- trust building
- confidence
- customer control
- exact wording under pressure
- judgment
- ownership
- leadership judgment if manager/district lead
`;
  }

  return `
Candidate has wireless experience.

You may ask wireless-specific questions.

Test practical knowledge of:
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
- realistic store-floor judgment
`;
}

function getPressureInstruction(behavior: BehaviorAnalysis, step: InterviewStep): string {
  const speaker = step.sender === "customer" ? "as the customer" : "as the interviewer";

  if (behavior.pressureTier === "final_warning") {
    return `
Pressure mode: FINAL WARNING.
The candidate has repeatedly been vague, dodging, or weak.
Do not move on casually.
Challenge them ${speaker} with a direct consequence-based follow-up.
Demand exact words or exact next action.
Make it clear that another vague answer is unacceptable.
`;
  }

  if (behavior.pressureTier === "sharp") {
    return `
Pressure mode: SHARP.
The candidate has shown repeated weak patterns.
Cross-question ${speaker} directly.
Reference the weakness without sounding like software.
Force specificity: exact words, exact question, exact next step.
`;
  }

  return `
Pressure mode: NORMAL.
Ask a clean premium question.
If the candidate was vague in the last answer, cross-question instead of moving forward.
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
    return {
      shouldAdvance: true,
      severity: "pass",
      reason: "No candidate answer to evaluate.",
    };
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

Decide whether the candidate's last answer is good enough to advance to the next interview step.

Role: ${role}
Level: ${level}
Experience: ${experience}

Current required step:
Phase: ${currentStep.phase}
Topic: ${currentStep.topic}
Instruction: ${currentStep.instruction}

Behavior memory:
${behavior.summary}

Last interviewer/customer prompt:
${lastPrompt.sender}: ${lastPrompt.text}

Candidate answer:
${lastCandidate.text}

Evaluate the candidate's last answer, but use behavior memory to increase pressure if they are repeatedly vague or dodging.

Advance only if the answer directly addresses the question/scenario with usable substance.

Do NOT advance if:
- answer is irrelevant
- answer dodges the question
- answer is too vague
- answer gives no concrete action
- answer only repeats buzzwords
- answer ignores customer concern
- answer lacks exact wording/action when the prompt asks what they would say/do
- candidate blames the customer
- candidate makes unrealistic claims
- candidate is disrespectful
- candidate gives technical wireless claims that sound false
- candidate is a newcomer and was asked technical telecom knowledge by mistake

Elite cross-questioning rule:
If the candidate gives a weak, vague, generic, fake, scripted, or incomplete answer, do not advance.
Force specificity.
Ask for exact words, exact next action, exact customer-facing question, or direct recovery step.

Repeated weakness escalation:
- If pressureTier=normal: one direct follow-up.
- If pressureTier=sharp: call out the vagueness and demand exact wording.
- If pressureTier=final_warning: make the follow-up harsher and consequence-based.

For simulation customer replies, follow-up must be as the customer.
For interviewer phases, follow-up must be as the interviewer.

Return STRICT JSON only:
{
  "shouldAdvance": boolean,
  "severity": "pass" | "follow_up" | "warning" | "terminate",
  "reason": "short reason",
  "followUp": "one concise follow-up question or challenge if not advancing"
}
`,
  });

  try {
    const parsed = JSON.parse(response.output_text || "{}") as Partial<GatekeeperResult>;

    if (typeof parsed.shouldAdvance !== "boolean") {
      throw new Error("Invalid gatekeeper JSON");
    }

    return {
      shouldAdvance: parsed.shouldAdvance,
      severity: parsed.severity || (parsed.shouldAdvance ? "pass" : "follow_up"),
      reason: parsed.reason || "No reason provided.",
      followUp: parsed.followUp,
    };
  } catch {
    return {
      shouldAdvance: false,
      severity: behavior.pressureTier === "final_warning" ? "warning" : "follow_up",
      reason: "Candidate answer could not be confidently accepted.",
      followUp:
        currentStep.sender === "customer"
          ? behavior.pressureTier === "normal"
            ? "That still does not answer my concern. What exactly would you do for me right now?"
            : "You’re still being vague. What exactly are you going to say or do to fix this for me?"
          : behavior.pressureTier === "normal"
          ? "That did not directly answer the question. Give me the exact action you would take and the words you would use."
          : "You’re still giving a generic answer. Give me the exact words you would say to the customer and the exact next step you would take.",
    };
  }
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    const body = await req.json();

    const role = normalizeRole(body.role);
    const level = normalizeLevel(body.level);
    const experience = normalizeExperience(body.experience);
    const seed = cleanText(body.seed, 500) || "wireless retail screening";
    const messages = normalizeMessages(body.messages);
    const behavior = analyzeBehaviorPattern(messages);

    const acceptedPromptCountFromClient =
  typeof body.acceptedPromptCount === "number"
    ? Math.max(0, body.acceptedPromptCount)
    : 0;

const turns = acceptedPromptCountFromClient;
const blueprint = getBlueprint(role, level, experience);
const lastCompletedStep = turns > 0 ? blueprint[turns - 1] : undefined;

    if (turns > 0 && lastCompletedStep) {
      const gate = await evaluateLastAnswer({
        role,
        level,
        experience,
        currentStep: lastCompletedStep,
        messages,
        behavior,
      });

      if (gate.severity === "terminate") {
        return NextResponse.json({
          phase: "terminated",
          sender: "interviewer",
          topic: "misconduct",
          text:
            gate.followUp ||
            "This interview is being ended because the last response was unacceptable for a customer-facing role.",
          complete: true,
          terminated: true,
          reason: gate.reason,
          behavior,
        });
      }

      if (!gate.shouldAdvance) {
        return NextResponse.json({
          phase: lastCompletedStep.phase,
          sender: lastCompletedStep.sender,
          topic: `${lastCompletedStep.topic}_follow_up`,
          text:
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

    const step = blueprint[turns];

    if (!step) {
      return NextResponse.json({
        phase: "complete",
        sender: "interviewer",
        topic: "complete",
        text: "That completes the interview. Please submit your final response.",
        complete: true,
      });
    }

    const transcript = buildTranscript(messages);
    const simulationProfile = getSimulationProfile(role, level, experience, seed);
    const pressureInstruction = getPressureInstruction(behavior, step);

    const roleRules =
      role === "support"
        ? `
This is wireless customer support screening.
Test ownership, de-escalation, clarity, realistic resolution, customer retention risk, honesty, and control under pressure.
`
        : `
This is wireless sales screening.
Test discovery, persuasion, trust, objection handling, recommendation quality, customer control, closing instinct, and ability to avoid sounding fake.
`;

    const levelRules: Record<Level, string> = {
      rep:
        "Frontline role. Test execution, clarity, confidence, basic objection handling, and customer-facing wording.",
      senior:
        "Senior individual contributor. Test sharper judgment, stronger recommendations, harder objections, consistency, and ability to guide weaker customers.",
      manager:
        "Store manager. Test escalation handling, customer recovery, rep coaching, accountability, store judgment, and ability to protect standards.",
      district_lead:
        "District lead. Test multi-store leadership, manager accountability, repeated issue diagnosis, churn risk, operational judgment, and business impact.",
    };

    const experienceRules = getExperienceRules(experience);

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: `
You are Hireque's elite structured hiring examiner.

Role:
${role}

Level:
${level}

Experience:
${experience}

Seed:
${seed}

Current required interview step:
Phase: ${step.phase}
Topic: ${step.topic}
Sender: ${step.sender}
Instruction: ${step.instruction}

Role rules:
${roleRules}

Level rules:
${levelRules[level]}

Experience rules:
${experienceRules}

Behavior memory:
${behavior.summary}

Pressure instruction:
${pressureInstruction}

Simulation profile:
${step.phase === "simulation" ? simulationProfile : "Not in simulation phase."}

Conversation so far:
${transcript}

Generate the next message.
Conversation control:
- Force the candidate through discovery, recommendation, objection handling, and closing.
- If the candidate recommends before asking discovery questions, challenge them.
- If the candidate is vague, demand exact words or exact next action.
- If the candidate dodges, repeat or reframe the concern.
- Increase resistance every 2 candidate turns.
- Introduce harder objections as the conversation progresses.
- If the candidate repeatedly fails, lose patience and threaten to leave or escalate.

Hard rules:
- Output only ONE message.
- No labels.
- No markdown.
- 1 to 3 sentences maximum.
- Sound like a real wireless store conversation, not an HR form.
- Do not repeat previous questions.
- Follow the current required step exactly.
- If sender is customer, speak only as the locked customer from the simulation profile.
- If sender is customer, stay consistent with the same personality, issue, pressure level, and emotional state.
- If sender is customer, do not invent a totally new problem.
- If sender is customer, remember whether the candidate asked discovery questions, gave exact wording, took ownership, or dodged.
- If sender is customer, cross-question weak answers instead of accepting them.
- If sender is customer, never say "great answer" or evaluate the candidate directly.
- If sender is customer and behavior memory shows repeated weakness, become more skeptical, impatient, or ready to escalate.
- If sender is interviewer, ask only as the interviewer.
- If repeated weakness exists, directly challenge vagueness and demand exact words or exact next action.
- Newcomer means no technical telecom knowledge questions.
- Manager and district lead newcomers still get leadership/management scenarios.
- Experienced candidates get more wireless-specific pressure.
- Ask for exact words when the answer needs customer-facing language.
- Never mention AI, scoring, rubric, prompt, behavior memory, pressure tier, or simulation.
`,
    });

    return NextResponse.json({
      phase: step.phase,
      sender: step.sender,
      topic: step.topic,
      text:
        response.output_text?.trim() ||
        "Tell me exactly how you would handle that situation.",
      complete: false,
      pressureTier: behavior.pressureTier,
    });
  } catch (error) {
    console.error("Interview next error:", error);

    return NextResponse.json(
      {
        error: "Failed to generate next interview step",
        phase: "core",
        sender: "interviewer",
        text: "A customer says they only want the cheapest option. What would you ask before recommending anything?",
        complete: false,
      },
      { status: 500 }
    );
  }
}
