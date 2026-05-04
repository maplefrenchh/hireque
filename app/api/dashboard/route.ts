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
      .select("company_id")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profile?.company_id) {
      return NextResponse.json(
        { error: "Company profile not found" },
        { status: 400 }
      );
    }

    const { data: screenings, error: screeningsError } = await supabaseAdmin
      .from("screenings")
      .select(
        "id, title, role, level, experience, industry, scenario_seed, status, created_at"
      )
      .eq("company_id", profile.company_id).eq("status", statusFilter)
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
      const { data: attemptsData, error: attemptsError } = await supabaseAdmin
        .from("screening_attempts")
        .select(
          `
          id,
          screening_id,
          candidate_name,
          candidate_email,
          score,
          verdict,
          red_flags,
          strengths,
          created_at
        `
        )
        .in("screening_id", screeningIds)
        .order("created_at", { ascending: false });

      if (attemptsError) {
        console.error("Dashboard attempts error:", attemptsError);
        return NextResponse.json(
          { error: "Failed to load candidates" },
          { status: 500 }
        );
      }

      attempts = attemptsData || [];
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

