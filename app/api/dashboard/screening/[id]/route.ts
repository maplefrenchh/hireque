import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await params;
    const screeningId = resolvedParams.id;

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: userData, error: userError } =
      await supabaseUserClient.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profile?.company_id) {
      return NextResponse.json(
        { error: "Company profile not found" },
        { status: 400 }
      );
    }

    const { data: screening, error: screeningError } = await supabaseAdmin
      .from("screenings")
      .select(
        "id, title, role, level, experience, industry, scenario_seed, status, created_at"
      )
      .eq("id", screeningId)
      .eq("company_id", profile.company_id)
      .single();

    if (screeningError || !screening) {
      return NextResponse.json(
        { error: "Screening not found" },
        { status: 404 }
      );
    }

    const { data: attempts, error: attemptsError } = await supabaseAdmin
      .from("screening_attempts")
      .select(
        `
        id,
        screening_id,
        candidate_name,
        candidate_email,
        role,
        level,
        experience,
        score,
        verdict,
        summary,
        recommendation,
        strengths,
        weaknesses,
        red_flags,
        dimension_scores,
        phase_scores,
        hiring_risk,
        interview_quality,
        created_at
      `
      )
      .eq("screening_id", screening.id);

    if (attemptsError) {
      console.error("Load screening attempts error:", attemptsError);

      return NextResponse.json(
        { error: "Failed to load candidates" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      screening,
      attempts: attempts || [],
    });
  } catch (error) {
    console.error("Screening API error:", error);

    return NextResponse.json(
      { error: "Failed to load screening" },
      { status: 500 }
    );
  }
}