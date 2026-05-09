export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";

type Role = "sales" | "support";
type Level = "rep" | "senior" | "manager" | "district_lead";
type Experience = "newcomer" | "experienced";

const validRoles: readonly Role[] = ["sales", "support"];
const validLevels: readonly Level[] = ["rep", "senior", "manager", "district_lead"];
const validExperiences: readonly Experience[] = ["newcomer", "experienced"];

function isValid<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function getRoleLabel(role: Role) {
  return role === "sales" ? "Wireless Sales" : "Wireless Customer Service";
}

function getLevelLabel(level: Level) {
  const labels: Record<Level, string> = {
    rep: "Retail Rep",
    senior: "Senior Rep",
    manager: "Store Manager",
    district_lead: "District Lead",
  };

  return labels[level];
}

function getExperienceLabel(experience: Experience) {
  return experience === "newcomer" ? "Newcomer" : "Experienced";
}

function getDifficulty(level: Level, experience: Experience) {
  if (level === "district_lead") return "executive";
  if (level === "manager") return "advanced";
  if (level === "senior") return experience === "experienced" ? "advanced" : "intermediate";
  return experience === "experienced" ? "intermediate" : "entry";
}

function getTitle(role: Role, level: Level, experience: Experience) {
  return `${getRoleLabel(role)} Â· ${getLevelLabel(level)} Â· ${getExperienceLabel(
    experience
  )}`;
}

function buildInviteUrl({
  origin,
  screeningId,
  role,
  level,
  experience,
  seed,
}: {
  origin: string | null;
  screeningId: string;
  role: Role;
  level: Level;
  experience: Experience;
  seed: string;
}) {
  const baseUrl =
    origin ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "";

  const path = `/interview/${screeningId}?role=${encodeURIComponent(
    role
  )}&level=${encodeURIComponent(level)}&experience=${encodeURIComponent(
    experience
  )}&seed=${encodeURIComponent(seed)}`;

  return baseUrl ? `${baseUrl}${path}` : path;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      return NextResponse.json(
        { error: "Missing Supabase public configuration" },
        { status: 500 }
      );
    }

    const supabaseUserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: userData, error: userError } =
      await supabaseUserClient.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const role = body.role;
    const level = body.level;
    const experience = body.experience;

    if (!isValid(role, validRoles)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    if (!isValid(level, validLevels)) {
      return NextResponse.json({ error: "Invalid level" }, { status: 400 });
    }

    if (!isValid(experience, validExperiences)) {
      return NextResponse.json({ error: "Invalid experience" }, { status: 400 });
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

    const scenarioSeed = crypto.randomUUID();
    const title = getTitle(role, level, experience);
    const difficulty = getDifficulty(level, experience);

    const scenarioProfile = {
      industry: "wireless",
      role,
      level,
      experience,
      difficulty,
      evaluationFocus:
        role === "sales"
          ? [
              "discovery",
              "needs analysis",
              "plan recommendation",
              "objection handling",
              "closing ability",
              "confidence under pressure",
            ]
          : [
              "issue diagnosis",
              "de-escalation",
              "policy-safe resolution",
              "clarity",
              "ownership",
              "customer retention",
            ],
      pressureLevel:
        level === "district_lead" || level === "manager"
          ? "high"
          : experience === "experienced"
          ? "medium-high"
          : "medium",
    };

    const { data: screening, error: screeningError } = await supabaseAdmin
      .from("screenings")
      .insert({
        company_id: profile.company_id,
        role,
        level,
        experience,
        industry: "wireless",
        title,
        scenario_seed: scenarioSeed,
        status: "active",
      })
      .select(
        "id, company_id, role, level, experience, industry, title, scenario_seed, status, created_at"
      )
      .single();

    if (screeningError || !screening) {
      console.error("Create screening DB error:", screeningError);

      return NextResponse.json(
        { error: "Failed to create screening" },
        { status: 500 }
      );
    }

    const origin = req.headers.get("origin");

    const inviteUrl = buildInviteUrl({
      origin,
      screeningId: screening.id,
      role,
      level,
      experience,
      seed: screening.scenario_seed,
    });

    return NextResponse.json({
      success: true,
      screening: {
        ...screening,
        scenarioProfile,
      },
      inviteUrl,
    });
  } catch (error) {
    console.error("Create screening error:", error);

    return NextResponse.json(
      { error: "Failed to create screening" },
      { status: 500 }
    );
  }
}


