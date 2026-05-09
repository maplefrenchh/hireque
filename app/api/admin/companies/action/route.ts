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

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const profileId = String(body.profileId || "");
    const action = String(body.action || "");

    if (!profileId || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const approval_status = action === "approve" ? "approved" : "rejected";

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ approval_status })
      .eq("id", profileId)
      .neq("email", ADMIN_EMAIL);

    if (error) {
      console.error("Admin approval action error:", error);
      return NextResponse.json({ error: "Failed to update company" }, { status: 500 });
    }

    return NextResponse.json({ success: true, approval_status });
  } catch (error) {
    console.error("Admin company action API error:", error);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
