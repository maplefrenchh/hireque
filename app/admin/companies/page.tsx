"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type CompanyProfile = {
  id: string;
  email: string | null;
  company_id: string | null;
  role: string | null;
  approval_status: string | null;
  created_at: string | null;
};

export default function AdminCompaniesPage() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadCompanies() {
    setLoading(true);
    setError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const token = session?.access_token;

    if (!token) {
      window.location.href = "/login?next=/admin/companies";
      return;
    }

    const res = await fetch("/api/admin/companies", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError("You are not allowed to access this admin page.");
      setLoading(false);
      return;
    }

    setCompanies(data.companies || []);
    setLoading(false);
  }

  async function updateCompany(profileId: string, action: "approve" | "reject") {
    setBusyId(profileId);
    setError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const token = session?.access_token;

    if (!token) {
      window.location.href = "/login?next=/admin/companies";
      return;
    }

    const res = await fetch("/api/admin/companies/action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ profileId, action }),
    });

    if (!res.ok) {
      setError("Could not update company.");
      setBusyId(null);
      return;
    }

    await loadCompanies();
    setBusyId(null);
  }

  useEffect(() => {
    loadCompanies();
  }, []);

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Company approvals</h1>
            <p className="mt-2 text-sm text-white/50">
              Approve or reject companies before they can use Hireque.
            </p>
          </div>

          <button
            onClick={loadCompanies}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold hover:bg-white/10"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
            Loading companies...
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-white/10 text-white/70">
                <tr>
                  <th className="p-4">Email</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Created</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {companies.map((company) => (
                  <tr key={company.id} className="border-t border-white/10">
                    <td className="p-4 font-medium">{company.email || "No email"}</td>
                    <td className="p-4 text-white/60">{company.role || "company"}</td>
                    <td className="p-4">
                      <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold">
                        {company.approval_status || "pending"}
                      </span>
                    </td>
                    <td className="p-4 text-white/50">
                      {company.created_at
                        ? new Date(company.created_at).toLocaleString()
                        : "-"}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <button
                          disabled={busyId === company.id || company.role === "admin"}
                          onClick={() => updateCompany(company.id, "approve")}
                          className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-black disabled:opacity-40"
                        >
                          Approve
                        </button>
                        <button
                          disabled={busyId === company.id || company.role === "admin"}
                          onClick={() => updateCompany(company.id, "reject")}
                          className="rounded-xl bg-red-500 px-4 py-2 text-xs font-black text-white disabled:opacity-40"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {companies.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-white/50">
                      No companies found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

