export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { email, password, companyName } = await req.json();

    if (!email || !password || !companyName) {
      return NextResponse.json(
        { error: "Missing email, password, or company name" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}` ||
      "http://localhost:3000";

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${appUrl}/login?verified=1`,
        data: {
          company_name: companyName,
        },
      },
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "Signup failed" },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();

    if (!existingProfile?.company_id) {
      const { data: company, error: companyError } = await supabaseAdmin
        .from("companies")
        .insert({ name: companyName })
        .select()
        .single();

      if (companyError || !company) {
        return NextResponse.json(
          { error: companyError?.message || "Company creation failed" },
          { status: 400 }
        );
      }

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: userId,
          company_id: company.id,
          email,
        });

      if (profileError) {
        return NextResponse.json(
          { error: profileError.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
  success: true,
  redirect: "/login?verify=1",
  message: "Signup successful. Check your email to verify your account."
});
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}