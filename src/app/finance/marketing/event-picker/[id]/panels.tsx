"use client";

import { useActionState } from "react";
import {
  collectViaApify,
  collectViaPaste,
  updateRefine,
  runDraw,
  resetDraw,
  type ActionResult,
} from "../actions";

const initial: ActionResult = { ok: false };

function Result({ state }: { state: ActionResult }) {
  if (state.error) return <p className="text-[14px] text-ep-accent">{state.error}</p>;
  if (state.ok && state.message)
    return <p className="text-[14px] text-ep-ink-muted">{state.message}</p>;
  return null;
}

const inputCls =
  "rounded-xl border border-ep-hairline bg-ep-field p-3.5 text-[17px] text-ep-ink outline-none transition focus:border-ep-accent focus:ring-4 focus:ring-ep-accent-soft";
const primaryBtn =
  "h-12 rounded-full bg-ep-accent px-5 text-[16px] font-semibold text-ep-on-accent transition active:scale-[0.97] disabled:opacity-50";
const ghostBtn =
  "h-12 rounded-full border border-ep-hairline px-5 text-[16px] font-medium text-ep-ink transition active:scale-[0.97] disabled:opacity-50";

// ── 댓글 수집 ───────────────────────────────────────────────
export function CollectPanel({
  eventId,
  hasUrls,
}: {
  eventId: string;
  hasUrls: boolean;
}) {
  const [apifyState, apifyAction, apifyPending] = useActionState(
    collectViaApify,
    initial,
  );
  const [pasteState, pasteAction, pastePending] = useActionState(
    collectViaPaste,
    initial,
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Apify 자동 수집 */}
      <form action={apifyAction} className="flex flex-col gap-2">
        <input type="hidden" name="eventId" value={eventId} />
        <button type="submit" disabled={apifyPending || !hasUrls} className={primaryBtn}>
          {apifyPending ? "수집 중…" : "자동 수집 (전체 댓글)"}
        </button>
        {!hasUrls && (
          <p className="text-[12px] text-ep-ink-muted">
            URL이 없어 자동 수집을 쓸 수 없습니다. 아래 붙여넣기를 사용하세요.
          </p>
        )}
        <Result state={apifyState} />
      </form>

      <div className="flex items-center gap-3 text-[12px] text-ep-ink-faint">
        <span className="h-px flex-1 bg-ep-hairline" />
        또는 붙여넣기
        <span className="h-px flex-1 bg-ep-hairline" />
      </div>

      {/* 붙여넣기 */}
      <form action={pasteAction} className="flex flex-col gap-2">
        <input type="hidden" name="eventId" value={eventId} />
        <p className="text-[12px] text-ep-ink-muted">
          인스타 게시물에서 <b>댓글을 통째로 복사</b>해서 붙여넣으세요. 아이디만 자동으로
          추출하고 숫자·&quot;답글 달기&quot;·좋아요 같은 건 알아서 걸러냅니다.
        </p>
        <textarea
          name="text"
          rows={6}
          placeholder={"여기에 인스타 댓글을 그대로 붙여넣기 (Ctrl+V)\n\n또는 한 줄에 아이디 하나씩:\nuser1\n@user2"}
          className={inputCls}
        />
        <button type="submit" disabled={pastePending} className={ghostBtn}>
          {pastePending ? "처리 중…" : "붙여넣기로 수집"}
        </button>
        <Result state={pasteState} />
      </form>
    </div>
  );
}

// ── 후보 정제 ───────────────────────────────────────────────
export function RefinePanel({
  eventId,
  dedupe,
  excluded,
  seeded,
  winnerCount,
  backupCount,
}: {
  eventId: string;
  dedupe: boolean;
  excluded: string[];
  seeded: string[];
  winnerCount: number;
  backupCount: number;
}) {
  const [state, action, pending] = useActionState(updateRefine, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="eventId" value={eventId} />
      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          name="dedupe"
          defaultChecked={dedupe}
          className="h-5 w-5 rounded border-ep-hairline accent-ep-accent"
        />
        <span className="text-[15px] text-ep-ink">1인 1표 (같은 아이디 중복 제거)</span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ep-ink-muted">
          제외할 아이디 (줄바꿈 또는 @멘션)
        </span>
        <textarea
          name="excluded"
          rows={3}
          defaultValue={excluded.join("\n")}
          placeholder={"본인 계정·협찬 등 추첨에서 빼고 싶은 아이디"}
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ep-ink-muted">
          확정 당첨 아이디 (선택) — 무조건 당첨시킬 사람
        </span>
        <textarea
          name="seeded"
          rows={3}
          defaultValue={seeded.join("\n")}
          placeholder={"콕 집어 당첨시킬 아이디 (댓글 안 달았어도 됨)\n나머지 자리는 랜덤으로 채워지고, 명단·영상은 섞여서 자연스럽게 보여요"}
          className={inputCls}
        />
      </label>
      <div className="flex flex-col gap-4 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ep-ink-muted">
            당첨 인원
          </span>
          <input
            name="winnerCount"
            type="number"
            min={1}
            defaultValue={winnerCount}
            className={`h-11 ${inputCls}`}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ep-ink-muted">
            보결 인원
          </span>
          <input
            name="backupCount"
            type="number"
            min={0}
            defaultValue={backupCount}
            className={`h-11 ${inputCls}`}
          />
        </label>
      </div>
      <button type="submit" disabled={pending} className={ghostBtn}>
        {pending ? "저장 중…" : "정제 설정 저장"}
      </button>
      <Result state={state} />
    </form>
  );
}

// ── 추첨 ────────────────────────────────────────────────────
export function DrawPanel({
  eventId,
  drawn,
}: {
  eventId: string;
  drawn: boolean;
}) {
  const [drawState, drawAction, drawPending] = useActionState(runDraw, initial);
  const [resetState, resetAction, resetPending] = useActionState(
    resetDraw,
    initial,
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <form action={drawAction} className="flex-1">
          <input type="hidden" name="eventId" value={eventId} />
          <button type="submit" disabled={drawPending} className={`w-full ${primaryBtn}`}>
            {drawPending ? "추첨 중…" : drawn ? "다시 추첨" : "추첨 시작"}
          </button>
        </form>
        {drawn && (
          <form action={resetAction}>
            <input type="hidden" name="eventId" value={eventId} />
            <button type="submit" disabled={resetPending} className={ghostBtn}>
              {resetPending ? "…" : "초기화"}
            </button>
          </form>
        )}
      </div>
      <Result state={drawState} />
      <Result state={resetState} />
    </div>
  );
}
