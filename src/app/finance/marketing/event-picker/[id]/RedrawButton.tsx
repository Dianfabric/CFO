"use client";

import { useActionState } from "react";
import { redrawWinner, type ActionResult } from "../actions";

const initial: ActionResult = { ok: false };

export function RedrawButton({
  eventId,
  username,
}: {
  eventId: string;
  username: string;
}) {
  const [state, action, pending] = useActionState(redrawWinner, initial);
  return (
    <form action={action} className="flex shrink-0 flex-col items-end gap-1">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="username" value={username} />
      <button
        type="submit"
        disabled={pending}
        title="이 당첨자를 제외하고 대체자 1명 재추첨"
        className="rounded-full border border-ep-hairline px-3 py-1 text-[12px] font-medium text-ep-accent transition hover:border-ep-accent disabled:opacity-50"
      >
        {pending ? "추첨 중…" : "재추첨"}
      </button>
      {state.error && (
        <span className="max-w-[200px] text-right text-[11px] leading-tight text-ep-accent">
          {state.error}
        </span>
      )}
    </form>
  );
}
