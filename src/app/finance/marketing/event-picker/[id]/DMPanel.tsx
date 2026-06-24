"use client";

import { useActionState, useState } from "react";
import { handleDM, type ActionResult } from "../actions";

const initial: ActionResult = { ok: false };

const DEFAULT_TEMPLATE =
  "🎉 @{username}님, 당첨을 축하합니다!\n아래 링크에서 배송정보를 입력해 주세요 👇\n{claim_link}";

const inputCls =
  "rounded-xl border border-ep-hairline bg-ep-field p-3.5 text-[15px] leading-relaxed text-ep-ink outline-none transition focus:border-ep-accent focus:ring-4 focus:ring-ep-accent-soft";

export function DMPanel({
  eventId,
  available,
}: {
  eventId: string;
  available: boolean;
}) {
  const [state, action, pending] = useActionState(handleDM, initial);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);

  if (!available) {
    return (
      <p className="rounded-xl border border-ep-hairline bg-ep-parchment px-3.5 py-3 text-[13px] leading-relaxed text-ep-ink-muted">
        안내 DM은 <b>공식 Graph API로 수집한 이벤트</b>(게시물 URL 있음)에서만 가능해요. 또한 인스타
        <b> 메시지 권한(instagram_manage_messages)</b>이 토큰에 있어야 발송됩니다.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="eventId" value={eventId} />
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ep-ink-muted">
          DM 문구 — <code className="rounded bg-ep-parchment px-1">{"{username}"}</code> 와{" "}
          <code className="rounded bg-ep-parchment px-1">{"{claim_link}"}</code> 자리가 자동으로 채워집니다
        </span>
        <textarea
          name="template"
          rows={4}
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
          {pending ? "처리 중…" : "미리보기 (발송 안 함)"}
        </button>
        <button
          type="submit"
          name="intent"
          value="send"
          disabled={pending}
          onClick={(e) => {
            if (
              !confirm(
                "당첨자들에게 비공개 답장(DM)을 발송합니다.\n계속할까요? (댓글 작성 후 7일 이내만 발송 가능, 중복 발송 주의)",
              )
            ) {
              e.preventDefault();
            }
          }}
          className="h-11 rounded-full bg-ep-accent px-5 text-[15px] font-semibold text-ep-on-accent transition active:scale-[0.97] disabled:opacity-50"
        >
          {pending ? "발송 중…" : "안내 DM 발송"}
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
                <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[13px] text-ep-ink-muted">
                  {r.preview}
                </p>
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
                {r.posted ? "발송됨" : r.matched ? "매칭됨" : "댓글 없음"}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-ep-ink-faint">
        DM은 <b>댓글 작성 후 7일 이내</b>에만 발송돼요. 먼저 <b>미리보기</b>로 매칭·문구를 확인하세요.
        링크는 배포 도메인 기준으로 들어갑니다(로컬에선 localhost).
      </p>
    </form>
  );
}
