"use client";

import { useState } from "react";

export default function CopyInviteButton({ inviteUrl }: { inviteUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const fullUrl = `${window.location.origin}${inviteUrl}`;

    await navigator.clipboard.writeText(fullUrl);

    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copyLink}
      className="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}