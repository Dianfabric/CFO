"use client";

import { useActionState, useState } from "react";
import { handleReplies, type ActionResult } from "../actions";

const initial: ActionResult = { ok: false };

const DEFAULT_TEMPLATE =
  "🎉 @{username}님, 당첨을 축하합니다! 배송정보 입력 링크를 DM으로 보내드렸어요, 확인 부탁드려요 :)";

const inputCls =
  "rounded-xl border border-ep-hairline bg-ep-field p-3.5 text-[15px] leading-relaxed text-ep-ink outline-none transition focus:border-ep-accent focus:ring-4 focus:ring-ep-accent-soft";

export function ReplyPanel({
  eventId,
  available,
}: {
  eventId: string;
  available: boolean;
}) {
  const [state, action, pending] = useActionState(handleReplies, initial);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);

  if (!available) {
    return (
      <p className="rounded-xl border border-ep-hairline bg-ep-parchment px-3.5 py-3 text-[13px] leading-relaxed text-ep-ink-muted">
        자동 답글은 <b>공식 Graph API로 수집한 이벤트</b>(게시물 URL 있음)에서만 가능해요. 붙여넣기로
        모은 이벤트는 인스타 댓글 ID가 없어 답글을 달 수 없습니다.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="eventId" value={eventId} />
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ep-ink-muted">
          답글 문구 — <code className="rounded bg-ep-parchment px-1">{"{username}"}</code> 자리에 각 당첨자
          아이디가 들어갑니다
        </span>
        <textarea
          name="template"
          rows={3}
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          className={inputCls}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="intent"
          value="preview"
          disabled={pending}
          className="h-11 rounded-full border border-ep-hairline px-5 text-[15px] font-medium text-ep-ink transition active:scale-[0.97] disabled:opacity-50"
        >
          {pending ? "처리 중…" : "미리보기 (게시 안 함)"}
        </button>
        <button
          type="submit"
          name="intent"
          value="post"
          disabled={pending}
          onClick={(e) => {
            if (
              !confirm(
                "당첨자들의 실제 인스타 댓글에 공개 답글을 답니다.\n계속할까요? (이미 답글을 단 사람에게 다시 실행하면 중복으로 달릴 수 있어요)",
              )
            ) {
              e.preventDefault();
            }
          }}
          className="h-11 rounded-full bg-ep-accent px-5 text-[15px] font-semibold text-ep-on-accent transition active:scale-[0.97] disabled:opacity-50"
        >
          {pending ? "게시 중…" : "댓글에 답글 달기"}
        </button>
      </div>

      {state.error && <p className="text-[14px] text-ep-accent">{state.error}</p>}
      {state.ok && state.message && (
        <p className="text-[14px] text-ep-ink-muted">{state.message}</p>
      )}

      {state.replies && state.replies.length > 0 && (
        <ul className="flex flex-col divide-y divide-ep-hairline rounded-xl border border-ep-hairline">
          {state.replies.map((r) => (
            <li key={r.username} className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="font-medium text-ep-ink">@{r.username}</p>
                <p className="mt-0.5 truncate text-[13px] text-ep-ink-muted">{r.preview}</p>
                {r.error && <p className="mt-0.5 text-[12px] text-ep-accent">{r.error}</p>}
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium ${
                  r.posted
                    ? "bg-ep-accent text-ep-on-accent"
                    : r.matched
                      ? "bg-ep-parchment text-ep-ink-muted"
                      : "bg-ep-parchment text-ep-ink-faint"
                }`}
              >
                {r.posted ? "게시됨" : r.matched ? "매칭됨" : "댓글 없음"}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-ep-ink-faint">
        먼저 <b>미리보기</b>로 매칭·문구를 확인한 뒤 <b>답글 달기</b>를 누르세요. 답글은 색동공장
        계정으로 게시됩니다.
      </p>
    </form>
  );
}
