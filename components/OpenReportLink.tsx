"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function findSupabaseToken(): string {
  try {
    const directKeys = Object.keys(localStorage);

    for (const key of directKeys) {
      if (!key.includes("auth-token")) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      const token =
        parsed?.access_token ||
        parsed?.currentSession?.access_token ||
        parsed?.session?.access_token;

      if (token) return token;
    }
  } catch {}

  return "";
}

export default function OpenReportLink({
  reportId,
  children,
  className = "",
}: {
  reportId: string;
  children: React.ReactNode;
  className?: string;
}) {
  async function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || findSupabaseToken();

    if (!token) {
      window.location.href = `/login?next=${encodeURIComponent(`/dashboard/report/${reportId}`)}`;
      return;
    }

    window.location.href = `/dashboard/report/${reportId}?token=${encodeURIComponent(token)}`;
  }

  return (
    <Link href={`/dashboard/report/${reportId}`} onClick={handleClick} className={className}>
      {children}
    </Link>
  );
}