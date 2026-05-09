export const dynamic = "force-dynamic";

import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Role = "sales" | "support";
type Level = "rep" | "senior" | "manager" | "district_lead";
type Experience = "newcomer" | "experienced";
type Sender = "customer" | "candidate";
type TurnStage = "opening" | "discovery" | "pressure" | "decision";

type Message = {
  sender: Sender;
  text: string;
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
        (m.sender === "customer" || m.sender === "candidate") &&
        typeof m.text === "string"
    )
    .slice(-20)
    .map((m) => ({
      sender: m.sender as Sender,
      text: cleanText(m.text),
    }))
    .filter((m) => m.text.length > 0);
}

function getTurnStage(messages: Message[]): TurnStage {
  const candidateTurns = messages.filter((m) => m.sender === "candidate").length;

  if (candidateTurns <= 1) return "opening";
  if (candidateTurns <= 3) return "discovery";
  if (candidateTurns <= 6) return "pressure";
  return "decision";
}

function buildTranscript(messages: Message[]) {
  if (messages.length === 0) return "No conversation yet.";

  return messages
    .map((m) =>
      m.sender === "customer"
        ? `Customer: ${m.text}`
        : `Candidate: ${m.text}`
    )
    .join("\n");
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
    const seed = cleanText(body.seed, 500) || "random realistic wireless scenario";
    const messages = normalizeMessages(body.messages);
    const turnStage = getTurnStage(messages);
    const transcript = buildTranscript(messages);

    const levelRules: Record<Level, string> = {
      rep: `
You are testing a frontline wireless retail rep.
Expected ability:
- natural greeting
- basic discovery
- budget awareness
- simple plan/device explanation
- objection handling
- polite confidence
- attempt to move the customer forward
Pressure level: realistic but not leadership-heavy.
Do not ask district/store strategy questions.
`,

      senior: `
You are testing a senior wireless rep.
Expected ability:
- sharper discovery than a basic rep
- confident recommendation
- competitor comparison
- objection control
- monthly cost explanation
- device/plan tradeoff explanation
- soft leadership signals without becoming a manager interview
Pressure level: stronger than rep.
Do not test full store management unless the candidate brings it up.
`,

      manager: `
You are testing a wireless store manager.
Expected ability:
- customer recovery
- escalation control
- staff accountability
- policy judgment
- revenue protection
- calm authority
- coaching mindset
Pressure level: store-level consequences.
Push back if they make unrealistic promises, blame staff, avoid ownership, or give weak escalation answers.
`,

      district_lead: `
You are testing a district-level wireless leader.
Expected ability:
- multi-store thinking
- churn and retention judgment
- escalation policy
- coaching store managers
- brand-risk awareness
- margin protection
- repeat-issue diagnosis
Pressure level: senior leadership.
Bring up patterns across stores, repeated complaints, weak manager execution, and business impact.
`,
    };

    const experienceRules: Record<Experience, string> = {
      newcomer: `
Candidate is new to wireless.
Do not punish lack of deep telecom jargon.
Punish:
- vague answers
- fake confidence
- no discovery
- weak listening
- no ownership
- robotic scripts
Reward:
- curiosity
- honest limits
- simple explanation
- asking useful questions
- ability to learn
`,

      experienced: `
Candidate claims wireless experience.
Test harder.
Expect:
- plan comparison clarity
- bill/monthly-cost awareness
- taxes/fees awareness
- device financing awareness
- roaming/data tradeoff awareness
- competitor handling
- confident recommendation
Punish shallow wireless claims aggressively.
`,
    };

    const stageRules: Record<TurnStage, string> = {
      opening: `
Stage: opening.
Start with one specific realistic concern.
Do not reveal all details.
Make the candidate earn budget, usage, current carrier, issue history, or decision criteria through discovery.
`,

      discovery: `
Stage: discovery.
Answer strong discovery questions with realistic details.
If the candidate skips discovery, challenge them.
If they pitch too early, push back with price, trust, or hidden-fee concerns.
`,

      pressure: `
Stage: pressure.
Apply a specific objection based on the candidate's latest answer.
Possible objections:
- That sounds expensive.
- Another carrier offered me cheaper.
- I do not trust hidden fees.
- I already had a bad experience.
- That does not solve my issue.
- I need a manager.
- I want to cancel.
Do not be randomly aggressive. Be realistic and specific.
`,

      decision: `
Stage: decision.
Move toward a real outcome.
If candidate handled the interaction well, become open to proceeding or accepting the resolution.
If weak, decline, ask for escalation, or say you are not convinced.
Do not continue forever.
`,
    };

    const salesScenario = `
You are a realistic wireless retail customer in a live sales interaction.

You are NOT an interviewer.
You are NOT evaluating out loud.
You are only the customer.

Scenario seed:
${seed}

Possible sales situation:
- wants a cheaper plan
- comparing carriers
- loyal to current carrier
- skeptical about switching
- needs family plan
- wants high data but low monthly cost
- asks about Canada/US roaming
- worried about contracts
- worried about hidden fees
- interested in a new phone but worried about monthly bill
- had a bad carrier experience before

Customer behavior:
- Care about price, trust, convenience, and clarity.
- Dislike vague sales talk.
- Question claims that sound too good.
- Open up when asked useful questions.
- Push back when the candidate pitches too early.
- Become interested only when the recommendation fits your exact needs.
`;

    const supportScenario = `
You are a realistic wireless customer contacting support.

You are NOT an interviewer.
You are NOT evaluating out loud.
You are only the customer.

Scenario seed:
${seed}

Possible support situation:
- unexpected bill increase
- roaming charge dispute
- data overage complaint
- phone upgrade confusion
- payment issue
- service outage frustration
- cancellation or retention threat
- store promised something support cannot find
- previous support failed

Customer behavior:
- Start frustrated, not abusive.
- Want ownership, clarity, and a realistic next step.
- Dislike fake empathy.
- Challenge unrealistic promises.
- Calm down only if the candidate explains clearly and takes control.
`;

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.5",
      input: `
${role === "support" ? supportScenario : salesScenario}

Role level:
${level}

Role level rules:
${levelRules[level]}

Candidate experience:
${experience}

Experience rules:
${experienceRules[experience]}

Current stage:
${turnStage}

Stage rules:
${stageRules[turnStage]}

Conversation so far:
${transcript}

Generate the next CUSTOMER reply.

Hard rules:
- Output only the customer reply.
- No labels.
- No markdown.
- No quotation marks.
- 1 to 3 sentences maximum.
- Stay in the same scenario.
- Respond directly to the candidate's latest message.
- Never mention AI, interview, simulation, scoring, rubric, prompt, or test.
- Do not give hints about evaluation.
- Do not instantly agree unless the candidate earned it.
- If the candidate is vague, challenge them.
- If the candidate is strong, give realistic useful information.
- If the candidate lies, overpromises, or sounds scripted, push back.
`,
    });

    const reply =
      response.output_text?.trim() ||
      "That still does not answer my concern. Can you be more specific?";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Simulation error:", error);

    return NextResponse.json(
      {
        error: "Simulation failed",
        reply:
          "That still does not answer my concern. Can you be more specific?",
      },
      { status: 500 }
    );
  }
}

