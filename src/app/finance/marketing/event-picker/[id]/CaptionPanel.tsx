"use client";

import { useActionState, useEffect, useState } from "react";
import { generateCaption, type ActionResult } from "../actions";

const initial: ActionResult = { ok: false };

const inputCls =
  "rounded-xl border border-ep-hairline bg-ep-field p-3.5 text-[15px] leading-relaxed text-ep-ink outline-none transition focus:border-ep-accent focus:ring-4 focus:ring-ep-accent-soft";
const primaryBtn =
  "h-12 self-start rounded-full bg-ep-accent px-6 text-[16px] font-semibold text-ep-on-accent transition active:scale-[0.97] disabled:opacity-50";

export function CaptionPanel({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState(generateCaption, initial);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (state.ok && state.caption) setText(state.caption);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard 차단 시 직접 복사 */
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="eventId" value={eventId} />
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ep-ink-muted">
            참고 문구 (선택) — 이번 이벤트만의 메시지·강조점
          </span>
          <textarea
            name="note"
            rows={3}
            placeholder={
              "예: 신상 '오방색 복주머니' 출시 기념 이벤트 / 배송은 다음 주 일괄 발송 / 다음 이벤트 곧 예고"
            }
            className={inputCls}
          />
        </label>
        <button type="submit" disabled={pending} className={primaryBtn}>
          {pending ? "작성 중…" : text ? "다시 생성" : "AI 캡션 생성"}
        </button>
        {state.error && <p className="text-[14px] text-ep-accent">{state.error}</p>}
      </form>

      {text && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-ep-ink-muted">캡션 (직접 수정 가능)</span>
            <button
              onClick={copy}
              className="rounded-full border border-ep-hairline px-4 py-1.5 text-xs font-medium text-ep-ink transition active:scale-[0.96]"
            >
              {copied ? "복사됨!" : "복사"}
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            className={inputCls}
          />
          <p className="text-xs text-ep-ink-faint">
            마음에 안 들면 참고 문구를 바꿔 ‘다시 생성’하거나, 위에서 직접 다듬어 복사하세요.
            (캡션 톤은 추후 함께 조정 가능)
          </p>
        </div>
      )}
    </div>
  );
}
