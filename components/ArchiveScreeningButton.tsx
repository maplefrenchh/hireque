"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ArchiveScreeningButton({
  screeningId,
}: {
  screeningId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleArchive = async () => {
    const confirmAction = window.confirm(
      "Archive this screening? It will move out of active list but data stays."
    );

    if (!confirmAction) return;

    setLoading(true);

    try {
      const token = localStorage.getItem("hireque_access_token");

      if (!token) {
        alert("Session expired. Login again.");
        return;
      }

      const res = await fetch(`/api/screenings/${screeningId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "archived" }),
      });

      const text = await res.text();

let data: { error?: string } = {};
try {
  data = JSON.parse(text);
} catch {
  throw new Error(`Archive API returned HTML/non-JSON. Status ${res.status}. Check route path.`);
}

      if (!res.ok) {
        alert(data.error || "Failed to archive.");
        return;
      }

      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleArchive}
      disabled={loading}
      className="rounded-full border border-white/10 px-4 py-3 text-sm font-bold text-slate-300 hover:bg-white/10 disabled:opacity-50"
    >
      {loading ? "Archiving..." : "Archive"}
    </button>
  );
}