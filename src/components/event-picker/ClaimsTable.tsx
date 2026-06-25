"use client";

import { useState } from "react";

export interface ClaimRowVM {
  id: number;
  eventTitle: string;
  username: string;
  name: string;
  phone: string;
  address: string;
  submittedAt: string;
}

export function ClaimsTable({
  rows,
  event,
  q,
}: {
  rows: ClaimRowVM[];
  event: string;
  q: string;
}) {
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [item, setItem] = useState("");

  const allSelected = rows.length > 0 && sel.size === rows.length;
  const toggle = (id: number) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSel(allSelected ? new Set() : new Set(rows.map((r) => r.id)));

  function download(selectedOnly: boolean) {
    const p = new URLSearchParams();
    if (event) p.set("event", event);
    if (q) p.set("q", q);
    if (item.trim()) p.set("item", item.trim());
    if (selectedOnly) p.set("ids", [...sel].join(","));
    window.location.href = `/api/event-picker/claims?${p.toString()}`;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 다운로드 바 */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ep-hairline bg-ep-parchment p-3">
        <input
          value={item}
          onChange={(e) => setItem(e.target.value)}
          placeholder="품목명 (예: 오방색 복주머니)"
          className="h-9 min-w-[160px] flex-1 rounded-lg border border-ep-hairline bg-ep-field px-3 text-[13px] text-ep-ink outline-none focus:border-ep-accent"
        />
        <button
          onClick={() => download(true)}
          disabled={sel.size === 0}
          className="h-9 rounded-full bg-ep-accent px-4 text-[13px] font-semibold text-ep-on-accent transition active:scale-[0.96] disabled:opacity-40"
        >
          선택 {sel.size}건 다운로드
        </button>
        <button
          onClick={() => download(false)}
          className="h-9 rounded-full border border-ep-hairline px-4 text-[13px] font-medium text-ep-ink transition active:scale-[0.96]"
        >
          전체 다운로드
        </button>
      </div>
      <p className="text-[12px] text-ep-ink-faint">
        체크박스로 <b>오늘 보낼 사람</b>만 골라 “선택 N건 다운로드”를 누르면 그 사람들만 로젠 엑셀로 받아요. 행을 눌러도 선택돼요.
      </p>

      {/* 테이블 */}
      <div className="overflow-x-auto rounded-[18px] border border-ep-hairline bg-ep-card">
        <table className="w-full min-w-[820px] text-[14px]">
          <thead className="bg-ep-parchment text-left text-[12px] text-ep-ink-muted">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-ep-hairline accent-ep-accent"
                  aria-label="전체 선택"
                />
              </th>
              <th className="px-4 py-3 font-medium">이벤트</th>
              <th className="px-4 py-3 font-medium">아이디</th>
              <th className="px-4 py-3 font-medium">이름</th>
              <th className="px-4 py-3 font-medium">연락처</th>
              <th className="px-4 py-3 font-medium">주소</th>
              <th className="px-4 py-3 font-medium">제출시각</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ep-hairline">
            {rows.map((r) => {
              const on = sel.has(r.id);
              return (
                <tr
                  key={r.id}
                  onClick={() => toggle(r.id)}
                  className={`cursor-pointer transition ${on ? "bg-ep-accent-soft" : "hover:bg-ep-parchment"}`}
                >
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(r.id)}
                      className="h-4 w-4 rounded border-ep-hairline accent-ep-accent"
                    />
                  </td>
                  <td className="px-4 py-3 text-ep-ink-muted">{r.eventTitle || "—"}</td>
                  <td className="px-4 py-3 font-semibold text-ep-accent">@{r.username}</td>
                  <td className="px-4 py-3 text-ep-ink">{r.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ep-ink">{r.phone}</td>
                  <td className="px-4 py-3 text-ep-ink">{r.address}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[12px] text-ep-ink-faint">
                    {r.submittedAt}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
