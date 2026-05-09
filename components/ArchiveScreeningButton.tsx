"use client";

import { useState } from "react";

type ScreeningStatus = "active" | "archived";

export default function ArchiveScreeningButton({
  screeningId,
  status = "active",
}: {
  screeningId: string;
  status?: ScreeningStatus | string | null;
}) {
  const [loading, setLoading] = useState(false);

  const currentStatus: ScreeningStatus =
    status === "archived" ? "archived" : "active";

  async function handleAction(action: "archive" | "restore" | "delete") {
    if (loading) return;

    if (action === "delete") {
      const ok = window.confirm(
        "Delete this screening permanently? This cannot be undone."
      );
      if (!ok) return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/screenings/action", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screeningId, action }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Action failed");
      }

      window.location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Action failed");
      setLoading(false);
    }
  }

  if (currentStatus === "archived") {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => handleAction("restore")}
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Working..." : "Move to Active"}
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => handleAction("delete")}
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-black text-rose-300 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Working..." : "Delete"}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => handleAction("archive")}
      className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-black text-slate-300 hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? "Archiving..." : "Archive"}
    </button>
  );
}
