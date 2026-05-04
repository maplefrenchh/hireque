export const dynamic = "force-dynamic";

import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Message = {
  sender: "customer" | "candidate";
  text: string;
};

export async function POST(req: Request) {
  try {
    const { role, messages } = await req.json();

    const transcript = messages
      .map((m: Message) => `${m.sender === "customer" ? "Customer" : "Candidate"}: ${m.text}`)
      .join("\n");

    const systemPrompt =
      role === "support"
        ? `
You are a strict evaluator for wireless customer service hiring.

Evaluate the candidate based on actual customer support ability, not whether the customer liked them.

Score 0-10:
- empathy
- listening_accuracy
- issue_diagnosis
- de_escalation
- clarity
- ownership
- resolution_quality
- professionalism
- wireless_context_awareness

Return ONLY valid JSON:
{
  "overall_score": number,
  "verdict": "Hire" | "Maybe" | "Reject",
  "risk_level": "Low" | "Medium" | "High",
  "scores": {
    "empathy": number,
    "listening_accuracy": number,
    "issue_diagnosis": number,
    "de_escalation": number,
    "clarity": number,
    "ownership": number,
    "resolution_quality": number,
    "professionalism": number,
    "wireless_context_awareness": number
  },
  "strengths": string[],
  "red_flags": string[],
  "decision_insight": string,
  "recommendation": string
}
`
        : `
You are a strict evaluator for wireless sales hiring.

Evaluate the candidate based on sales skill, not whether the customer bought.

A candidate can still score high if the customer refuses, as long as the candidate showed strong selling behavior.

Score 0-10:
- wireless_knowledge
- discovery
- budget_handling
- objection_handling
- value_framing
- plan_comparison
- confidence
- proactivity
- closing_attempt
- listening_accuracy
- pressure_handling

Return ONLY valid JSON:
{
  "overall_score": number,
  "verdict": "Hire" | "Maybe" | "Reject",
  "risk_level": "Low" | "Medium" | "High",
  "scores": {
    "wireless_knowledge": number,
    "discovery": number,
    "budget_handling": number,
    "objection_handling": number,
    "value_framing": number,
    "plan_comparison": number,
    "confidence": number,
    "proactivity": number,
    "closing_attempt": number,
    "listening_accuracy": number,
    "pressure_handling": number
  },
  "strengths": string[],
  "red_flags": string[],
  "decision_insight": string,
  "recommendation": string
}
`;

    const response = await client.responses.create({
      model: "gpt-5.5",
      input: `${systemPrompt}

Transcript:
${transcript}

Evaluate strictly. Do not be nice. Return JSON only.`,
    });

    const text = response.output_text || "{}";

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {
        overall_score: 0,
        verdict: "Reject",
        risk_level: "High",
        scores: {},
        strengths: [],
        red_flags: ["Scoring response failed to parse."],
        decision_insight: "Unable to evaluate reliably.",
        recommendation: "Manual review required.",
      };
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Scoring error:", error);
    return NextResponse.json(
      { error: "Scoring failed" },
      { status: 500 }
    );
  }
}
