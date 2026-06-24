"use client";

import { useState } from "react";

// 로젠 양식 엑셀 다운로드 — 품목명 입력 후 받기
export function ExportExcelButton({
  event,
  q,
  compact,
}: {
  event?: string;
  q?: string;
  compact?: boolean;
}) {
  const [item, setItem] = useState("");

  function download() {
    const p = new URLSearchParams();
    if (event) p.set("event", event);
    if (q) p.set("q", q);
    if (item.trim()) p.set("item", item.trim());
    window.location.href = `/api/event-picker/claims?${p.toString()}`;
  }

  return (
    <div className={`flex gap-2 ${compact ? "flex-col sm:flex-row" : "flex-wrap"}`}>
      <input
        value={item}
        onChange={(e) => setItem(e.target.value)}
        placeholder="품목명 (예: 오방색 복주머니)"
        className="h-9 flex-1 rounded-lg border border-ep-hairline bg-ep-field px-3 text-[13px] text-ep-ink outline-none focus:border-ep-accent sm:min-w-[180px]"
      />
      <button
        onClick={download}
        className="h-9 shrink-0 rounded-full bg-ep-accent px-4 text-[13px] font-semibold text-ep-on-accent transition active:scale-[0.96]"
      >
        엑셀 다운로드 (로젠)
      </button>
    </div>
  );
}
