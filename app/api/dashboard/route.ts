export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const statusFilter =
      url.searchParams.get("status") === "archived" ? "archived" : "active";

    const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();

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
      .select("company_id, role, approval_status")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profile?.company_id) {
      return NextResponse.json(
        { error: "Company profile not found" },
        { status: 400 }
      );
    }
    if (profile.role !== "admin" && profile.approval_status !== "approved") {
  return NextResponse.json(
    { error: "Company approval pending" },
    { status: 403 }
  );
}

    const { data: screenings, error: screeningsError } = await supabaseAdmin
      .from("screenings")
      .select(
        "id, title, role, level, experience, industry, scenario_seed, status, created_at"
      )
      .eq("company_id", profile.company_id)
      .eq("status", statusFilter)
      .order("created_at", { ascending: false });

    if (screeningsError) {
      console.error("Dashboard screenings error:", screeningsError);
      return NextResponse.json(
        { error: "Failed to load screenings" },
        { status: 500 }
      );
    }

    const screeningIds = (screenings || []).map((s) => s.id);

    let attempts: any[] = [];

    if (screeningIds.length > 0) {
      const { data: reportsData, error: reportsError } = await supabaseAdmin
        .from("candidate_reports")
        .select(
          `
          id,
          screening_id,
          candidate_name,
          candidate_email,
          overall_score,
          score,
          verdict,
          red_flags,
          strengths,
          weaknesses,
          created_at
        `
        )
        .eq("company_id", profile.company_id)
        .in("screening_id", screeningIds)
        .order("created_at", { ascending: false });

      if (reportsError) {
        console.error("Dashboard reports error:", reportsError);
        return NextResponse.json(
          { error: "Failed to load candidates" },
          { status: 500 }
        );
      }

      attempts = (reportsData || []).map((r: any) => ({
        id: r.id,
        screening_id: r.screening_id,
        candidate_name: r.candidate_name,
        candidate_email: r.candidate_email,
        score: r.overall_score ?? r.score ?? 0,
        verdict: r.verdict,
        red_flags: r.red_flags || [],
        strengths: r.strengths || [],
        weaknesses: r.weakness || [],
        created_at: r.created_at,
      }));
    }

    return NextResponse.json({
      screenings: screenings || [],
      attempts,
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}



