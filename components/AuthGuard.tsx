"use client";

import { useEffect, useState } from "react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function verify() {
      const token = localStorage.getItem("hireque_access_token");

      if (!token) {
        window.location.replace("/login");
        return;
      }

      try {
        const res = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        if (!res.ok) {
          localStorage.removeItem("hireque_access_token");
          localStorage.removeItem("hireque_user_email");
          document.cookie = "hireque_access_token=; path=/; max-age=0";
          window.location.replace("/login");
          return;
        }

        setAllowed(true);
      } catch {
        localStorage.removeItem("hireque_access_token");
        localStorage.removeItem("hireque_user_email");
        document.cookie = "hireque_access_token=; path=/; max-age=0";
        window.location.replace("/login");
      } finally {
        setChecking(false);
      }
    }

    verify();
  }, []);

  if (checking || !allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p className="text-slate-400">Verifying company access...</p>
      </main>
    );
  }

  return <>{children}</>;
}