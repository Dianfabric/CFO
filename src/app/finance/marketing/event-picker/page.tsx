import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/event-picker/supabase";
import { STATUS_LABEL, type EventRow } from "@/lib/event-picker/types";
import { createEvent } from "./actions";
import { DeleteEventButton } from "./DeleteEventButton";

export const dynamic = "force-dynamic";

const inputCls =
  "h-11 rounded-xl border border-ep-hairline bg-ep-field px-3.5 text-[17px] text-ep-ink outline-none transition focus:border-ep-accent focus:ring-4 focus:ring-ep-accent-soft";

export default async function EventsPage() {
  const sb = getSupabaseAdmin();
  const { data: events } = await sb
    .from("events")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<EventRow[]>();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-14">
      <header className="mb-9 flex items-center justify-between gap-4">
        <h1 className="text-[22px] font-semibold tracking-[-0.022em] text-ep-ink sm:text-[26px]">
          댓글 이벤트 앱
        </h1>
        <Link
          href="/finance/marketing/event-picker/claims"
          className="text-[14px] text-ep-ink-muted underline-offset-4 hover:text-ep-ink"
        >
          제출 내역
        </Link>
      </header>

      {/* 새 이벤트 만들기 */}
      <section className="mb-12 rounded-[18px] border border-ep-hairline bg-ep-card p-6 sm:p-7">
        <h2 className="mb-5 text-[17px] font-semibold text-ep-ink">새 이벤트 만들기</h2>
        <form action={createEvent} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ep-ink-muted">이벤트 제목</span>
            <input
              name="title"
              required
              placeholder="예: 6월 신상 색동 댓글 이벤트"
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ep-ink-muted">
              피드 URL (여러 개면 줄바꿈)
            </span>
            <textarea
              name="urls"
              rows={2}
              placeholder="https://www.instagram.com/p/XXXX/"
              className="rounded-xl border border-ep-hairline bg-ep-field p-3.5 text-[17px] text-ep-ink outline-none transition focus:border-ep-accent focus:ring-4 focus:ring-ep-accent-soft"
            />
          </label>
          <div className="flex flex-col gap-4 sm:flex-row">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ep-ink-muted">당첨 인원</span>
              <input name="winnerCount" type="number" min={1} defaultValue={1} className={inputCls} />
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ep-ink-muted">보결 인원</span>
              <input name="backupCount" type="number" min={0} defaultValue={0} className={inputCls} />
            </label>
          </div>
          <button
            type="submit"
            className="h-12 rounded-full bg-ep-accent px-5 text-[16px] font-semibold text-ep-on-accent transition active:scale-[0.97]"
          >
            이벤트 생성
          </button>
        </form>
      </section>

      {/* 이벤트 목록 */}
      <section>
        <h2 className="mb-4 text-[17px] font-semibold text-ep-ink">이벤트 목록</h2>
        {!events?.length ? (
          <p className="rounded-[18px] border border-dashed border-ep-hairline p-10 text-center text-[15px] text-ep-ink-muted">
            아직 이벤트가 없습니다. 위에서 첫 이벤트를 만들어 보세요.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {events.map((ev) => (
              <li key={ev.id} className="flex items-stretch gap-2">
                <Link
                  href={`/finance/marketing/event-picker/${ev.id}`}
                  className="flex flex-1 items-center justify-between gap-3 rounded-[14px] border border-ep-hairline bg-ep-card p-4 transition hover:border-ep-ink-faint"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ep-ink">{ev.title}</p>
                    <p className="mt-0.5 text-[13px] text-ep-ink-muted">
                      당첨 {ev.winner_count}명
                      {ev.backup_count > 0 && ` · 보결 ${ev.backup_count}명`} ·{" "}
                      {new Date(ev.created_at).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-ep-parchment px-3 py-1 text-[12px] font-medium text-ep-ink-muted">
                    {STATUS_LABEL[ev.status]}
                  </span>
                </Link>
                <DeleteEventButton eventId={ev.id} title={ev.title} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
