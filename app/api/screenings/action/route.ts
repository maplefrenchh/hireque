import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function PATCH(req: Request) {
  try {
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

    const { screeningId, action } = await req.json();

    if (!screeningId || !["archive", "restore", "delete"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.company_id) {
      return NextResponse.json({ error: "Company profile not found" }, { status: 403 });
    }

    const { data: screening, error: screeningError } = await supabaseAdmin
      .from("screenings")
      .select("id, company_id")
      .eq("id", screeningId)
      .single();

    if (screeningError || !screening || screening.company_id !== profile.company_id) {
      return NextResponse.json({ error: "Screening not found" }, { status: 404 });
    }

    if (action === "delete") {
      const { error } = await supabaseAdmin
        .from("screenings")
        .delete()
        .eq("id", screeningId)
        .eq("company_id", profile.company_id);

      if (error) console.error("API error:", error); return NextResponse.json({ error: "Request failed. Please try again." }, { status: 500 });
    } else {
      const nextStatus = action === "archive" ? "archived" : "active";

      const { error } = await supabaseAdmin
        .from("screenings")
        .update({ status: nextStatus })
        .eq("id", screeningId)
        .eq("company_id", profile.company_id);

      if (error) console.error("API error:", error); return NextResponse.json({ error: "Request failed. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
