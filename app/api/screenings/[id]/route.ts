import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: screeningId } = await params;

    if (!screeningId) {
      return NextResponse.json({ error: "Missing screening id" }, { status: 400 });
    }

    const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseUserClient.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const body = await req.json();
    const nextStatus = body?.status;

    if (!["active", "archived"].includes(nextStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile?.company_id) {
      return NextResponse.json({ error: "Company profile not found" }, { status: 403 });
    }

    const { data: screening, error: screeningError } = await supabaseAdmin
      .from("screenings")
      .select("id, company_id")
      .eq("id", screeningId)
      .maybeSingle();

    if (screeningError) {
      return NextResponse.json({ error: "Screening lookup failed" }, { status: 500 });
    }

    if (!screening || screening.company_id !== profile.company_id) {
      return NextResponse.json({ error: "Screening not found" }, { status: 404 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("screenings")
      .update({ status: nextStatus })
      .eq("id", screeningId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update screening" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Screening PATCH error:", error);
    return NextResponse.json({ error: "Failed to update screening" }, { status: 500 });
  }
}
