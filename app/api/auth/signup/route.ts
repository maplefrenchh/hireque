export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { companyName, email, password } = await req.json();

    if (!companyName || !email || !password) {
      return NextResponse.json(
        { error: "Missing company name, email, or password" },
        { status: 400 }
      );
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "Signup failed" },
        { status: 400 }
      );
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .insert({ name: companyName })
      .select()
      .single();

    if (companyError) {
      return NextResponse.json({ error: companyError.message }, { status: 400 });
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: authData.user.id,
      company_id: company.id,
      email,
    });

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}