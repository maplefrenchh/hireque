import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
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

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("company_id, role, approval_status")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.company_id) {
    return NextResponse.json(
      { error: "Company profile not found" },
      { status: 403 }
    );
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
    },
    company_id: profile.company_id,
    profile: {
      company_id: profile.company_id,
      role: profile.role || "company",
      approval_status: profile.approval_status || "pending",
    },
  });
}
