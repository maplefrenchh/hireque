export const dynamic = "force-dynamic";

import OpenAI from "openai";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Message = {
  sender: "customer" | "candidate";
  text: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      screening_id,
      candidate_name,
      candidate_email,
      role,
      level,
      experience,
      messages,
    } = body;

    if (!screening_id || !candidate_name || !candidate_email || !role || !messages?.length) {
      return NextResponse.json(
        { error: "Missing required scoring/report fields" },
        { status: 400 }
      );
    }

    const transcript = messages
      .map((m: Message) =>
        `${m.sender === "customer" ? "Customer" : "Candidate"}: ${m.text}`
      )
      .join("\n");

    const systemPrompt =
      role === "support"
        ? `
You are a strict evaluator for wireless customer service hiring.

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
  "scores": {},
  "strengths": string[],
  "weaknesses": string[],
  "red_flags": string[],
  "summary": string,
  "feedback": string,
  "recommendation": string
}
`
        : `
You are a strict evaluator for wireless sales hiring.

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
  "scores": {},
  "strengths": string[],
  "weaknesses": string[],
  "red_flags": string[],
  "summary": string,
  "feedback": string,
  "recommendation": string
}
`;

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.5",
      input: `${systemPrompt}

Transcript:
${transcript}

Evaluate strictly. Return JSON only.`,
    });

    const text = response.output_text || "{}";

    let parsed: any;

    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {
        overall_score: 0,
        verdict: "Reject",
        risk_level: "High",
        scores: {},
        strengths: [],
        weaknesses: ["AI response could not be parsed."],
        red_flags: ["Scoring response failed to parse."],
        summary: "Evaluation failed.",
        feedback: "Manual review required.",
        recommendation: "Reject until manually reviewed.",
      };
    }
    const { data: screening, error: screeningError } = await supabaseAdmin
  .from("screenings")
  .select("id, company_id")
  .eq("id", screening_id)
  .single();

if (screeningError || !screening?.company_id) {
  return NextResponse.json(
    { error: "Invalid screening or missing company ownership" },
    { status: 400 }
  );
}


    const { data: report, error: insertError } = await supabaseAdmin
      .from("candidate_reports")
      
      .insert({
        screening_id,
        candidate_name,
        candidate_email,
        transcript,
        role,
        level: level || null,
        experience: experience || null,
        overall_score: parsed.overall_score ?? 0,
        score: parsed.overall_score ?? 0,
        verdict: parsed.verdict || "Reject",
        strengths: parsed.strengths || [],
        weakness: parsed.weaknesses || [],
        red_flags: parsed.red_flags || [],
        recommendation: parsed.recommendation || "",
        summary: parsed.summary || parsed.decision_insight || "",
        feedback: parsed.feedback || "",
        raw_evaluation: parsed,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("candidate_reports insert error:", insertError);
      return NextResponse.json(
        { error: "Scoring succeeded but report save failed", details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...parsed,
      report_id: report.id,
      saved: true,
    });
  } catch (error) {
    console.error("Scoring error:", error);
    return NextResponse.json({ error: "Scoring failed" }, { status: 500 });
  }
}