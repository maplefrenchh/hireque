export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getSupabaseAdmin } from "@/lib/supabase";

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  return new OpenAI({ apiKey });
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const openai = getOpenAI();

    const body = await req.json();

    const {
      screeningId,
      candidateName,
      candidateEmail,
      transcript,
      role,
      level,
      experience,
    } = body;

    if (!screeningId || !candidateName || !candidateEmail || !transcript) {
      return NextResponse.json(
        { error: "Missing required submission fields" },
        { status: 400 }
      );
    }

    const evaluation = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a strict wireless retail hiring evaluator. Score candidates harshly and practically. Return valid JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify({
            role,
            level,
            experience,
            transcript,
            scoring_required: {
              overall_score: "0-100",
              verdict: "Strong Hire | Hire | Maybe | Reject | Strong Reject",
              strengths: "array",
              weaknesses: "array",
              red_flags: "array",
              summary: "short practical hiring summary",
            },
          }),
        },
      ],
    });

    const raw = evaluation.choices[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        overall_score: 0,
        verdict: "Reject",
        strengths: [],
        weaknesses: ["AI response was not valid JSON."],
        red_flags: ["Evaluation parsing failed."],
        summary: raw,
      };
    }

    const { data, error } = await supabase
      .from("candidate_reports")
      .insert({
        screening_id: screeningId,
        candidate_name: candidateName,
        candidate_email: candidateEmail,
        transcript,
        role,
        level,
        experience,
        score: parsed.overall_score ?? 0,
        verdict: parsed.verdict ?? "Reject",
        strengths: parsed.strengths ?? [],
        weaknesses: parsed.weaknesses ?? [],
        red_flags: parsed.red_flags ?? [],
        summary: parsed.summary ?? "",
        raw_evaluation: parsed,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ report: data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Submission failed" },
      { status: 500 }
    );
  }
}
