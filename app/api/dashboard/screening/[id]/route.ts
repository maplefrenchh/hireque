import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { id: screeningId } = await params;

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ CORRECT: get company_id from profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.company_id) {
      return NextResponse.json(
        { error: "Company profile not found" },
        { status: 404 }
      );
    }

    // ✅ validate screening ownership
    const { data: screening, error: screeningError } = await supabaseAdmin
      .from("screenings")
      .select("*")
      .eq("id", screeningId)
      .eq("company_id", profile.company_id)
      .single();

    if (screeningError || !screening) {
      return NextResponse.json(
        { error: "Screening not found" },
        { status: 404 }
      );
    }

    // ✅ get candidates (attempts)
    const { data: attempts, error: attemptsError } = await supabaseAdmin
      .from("candidate_reports")
      .select("*")
      .eq("screening_id", screeningId)
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false });

    if (attemptsError) {
      return NextResponse.json(
        { error: attemptsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      screening,
      attempts: attempts || [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}