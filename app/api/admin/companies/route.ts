import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";

const ADMIN_EMAIL = "aashnanagpal1209@gmail.com";

function getUserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userClient = getUserClient();

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);

    if (userError || !user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, company_id, role, approval_status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Admin companies load error:", error);
      return NextResponse.json({ error: "Failed to load companies" }, { status: 500 });
    }

    return NextResponse.json({ companies: data || [] });
  } catch (error) {
    console.error("Admin companies API error:", error);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
