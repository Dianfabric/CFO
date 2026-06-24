"use client";

import { useEffect, useState } from "react";

export function ClaimLink({ eventId }: { eventId: string }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}/claim/${eventId}`);
  }, [eventId]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard 차단 시 무시 — 사용자가 직접 복사 */
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="h-11 flex-1 rounded-xl border border-ep-hairline bg-ep-parchment px-3.5 text-[14px] text-ep-ink"
      />
      <button
        onClick={copy}
        className="h-11 rounded-full bg-ep-accent px-5 text-[14px] font-semibold text-ep-on-accent transition active:scale-[0.97]"
      >
        {copied ? "복사됨!" : "링크 복사"}
      </button>
    </div>
  );
}
