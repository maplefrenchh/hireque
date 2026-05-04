import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await params;
    const screeningId = resolvedParams.id;

    // 1. Get token
    const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Validate user
    const supabaseUserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: userData, error: userError } =
      await supabaseUserClient.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // 3. Get company
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

    // 4. Update screening → archived
    const { data: screening, error: updateError } = await supabaseAdmin
      .from("screenings")
      .update({ status: "archived" })
      .eq("id", screeningId)
      .eq("company_id", profile.company_id)
      .select("id, status")
      .single();

    if (updateError || !screening) {
      return NextResponse.json(
        { error: "Screening not found or not allowed" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      screening,
    });
  } catch (error) {
    console.error("Archive error:", error);

    return NextResponse.json(
      { error: "Failed to archive screening" },
      { status: 500 }
    );
  }
}