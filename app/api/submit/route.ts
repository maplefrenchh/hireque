export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getSupabaseAdmin } from "@/lib/supabase";

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  return new OpenAI({ apiKey });
}

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function safeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(Boolean).map(String).slice(0, 12);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const screeningId = body.screeningId;
    const candidateName =
      body.candidateName || body.candidate?.name || "Unknown Candidate";
    const candidateEmail =
      body.candidateEmail || body.candidate?.email || "unknown@email.com";

    const transcript =
      body.transcript ||
      (Array.isArray(body.messages)
        ? body.messages
            .map((m: any) => `${m.sender || "unknown"}: ${m.text || ""}`)
            .join("\n")
        : "");

    if (!screeningId || !transcript || transcript.trim().length < 40) {
      return NextResponse.json(
        { error: "Missing required submission fields" },
        { status: 400 }
      );
    }

    const openai = getOpenAI();
    const supabase = getSupabaseAdmin();

    const { data: screening, error: screeningError } = await supabase
      .from("screenings")
      .select("id, company_id, role, level, experience, industry, title, scenario_seed, status")
      .eq("id", screeningId)
      .single();

    if (screeningError || !screening?.company_id) {
      return NextResponse.json(
        { error: "Invalid screening or missing company ownership" },
        { status: 400 }
      );
    }

    const role = body.role || screening.role || "";
    const level = body.level || screening.level || "";
    const experience = body.experience || screening.experience || "";

    const evaluation = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `
You are Hireque's harsh wireless hiring evaluator.

You score real interview transcripts for wireless retail sales and customer service roles.

Your job:
- reward specific, practical, role-ready answers
- punish vague answers brutally
- punish fake HR answers
- punish dodging
- punish no discovery
- punish no exact customer wording
- punish unrealistic promises
- punish weak ownership
- punish weak closing
- punish weak leadership judgment for manager/district lead

Scoring calibration:
90-100 = rare elite candidate, specific, calm, persuasive, high ownership, role-ready
80-89 = strong hire, minor gaps only
70-79 = hire/maybe hire, usable but not exceptional
55-69 = maybe, risky, needs training
35-54 = reject, weak evidence, generic, poor control
0-34 = strong reject, vague/dodging/unprofessional/no useful evidence

Verdict rules:
- 85+ Strong Hire
- 75-84 Hire
- 60-74 Maybe
- 35-59 Reject
- 0-34 Strong Reject

Strict penalties:
- mostly generic answers: max 55
- repeated vague answers: max 45
- no discovery in sales/support scenario: max 60
- no exact wording when asked: max 65
- dodging or "ask manager" dependency: max 50
- disrespectful/threatening language: max 10
- manager/district lead with no coaching/accountability: max 58
- experienced wireless candidate with no practical wireless judgment: max 62

Return JSON only.
`,
        },
        {
          role: "user",
          content: JSON.stringify({
            screening: {
              role,
              level,
              experience,
              industry: screening.industry,
              title: screening.title,
              scenario_seed: screening.scenario_seed,
            },
            transcript,
            required_json: {
              score: "0-100 integer",
              verdict: "Strong Hire | Hire | Maybe | Reject | Strong Reject",
              summary: "2-4 sentence blunt hiring summary",
              feedback: "direct feedback to hiring manager",
              strengths: ["specific evidence-based strengths"],
              weaknesses: ["specific evidence-based weaknesses"],
              red_flags: ["specific red flags"],
              recommendation: "clear final hiring recommendation",
              dimension_scores: {
                discovery: "0-10",
                objection_handling: "0-10",
                customer_control: "0-10",
                communication: "0-10",
                ownership: "0-10",
                role_fit: "0-10",
                level_readiness: "0-10",
              },
              evidence: {
                best_moment: "quote or paraphrase",
                worst_moment: "quote or paraphrase",
                why_score_not_higher: "reason",
              },
            },
          }),
        },
      ],
    });

    const raw = evaluation.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);

    const score = safeNumber(parsed.score ?? parsed.overall_score ?? 0);

    let verdict =
      parsed.verdict ||
      (score >= 85
        ? "Strong Hire"
        : score >= 75
        ? "Hire"
        : score >= 60
        ? "Maybe"
        : score >= 35
        ? "Reject"
        : "Strong Reject");

    const { data, error } = await supabase
      .from("candidate_reports")
      .insert({
        company_id: screening.company_id,
        screening_id: screeningId,
        candidate_name: candidateName,
        candidate_email: candidateEmail,
        transcript,
        role,
        level,
        experience,
        overall_score: score,
        score,
        verdict,
        strengths: safeArray(parsed.strengths),
                weaknesses: safeArray(parsed.weaknesses),
        red_flags: safeArray(parsed.red_flags),
        recommendation: parsed.recommendation ?? "",
        feedback: parsed.feedback ?? "",
        summary: parsed.summary ?? "",
        raw_evaluation: parsed,
      })
      .select()
      .single();

    if (error) {
      console.error("candidate_reports insert error:", error);
      console.error("API error:", error); return NextResponse.json({ error: "Request failed. Please try again." }, { status: 500 });
    }

    return NextResponse.json({
      ...parsed,
      score,
      overall_score: score,
      verdict,
      report_id: data.id,
      report: data,
      saved: true,
    });
  } catch (err: any) {
    console.error("Submit route error:", err);
    return NextResponse.json(
      { error: err.message || "Submission failed" },
      { status: 500 }
    );
  }
}


