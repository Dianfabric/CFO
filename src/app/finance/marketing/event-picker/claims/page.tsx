import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/event-picker/supabase";
import { ClaimsTable, type ClaimRowVM } from "@/components/event-picker/ClaimsTable";

export const dynamic = "force-dynamic";

interface ClaimRow {
  id: number;
  event_id: string;
  username: string;
  name: string;
  postal_code: string | null;
  address: string;
  address_detail: string | null;
  phone: string;
  submitted_at: string;
  events: { title: string } | null;
}

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; event?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const event = sp.event ?? "";

  const sb = getSupabaseAdmin();
  const { data: events } = await sb
    .from("events")
    .select("id, title")
    .order("created_at", { ascending: false })
    .returns<{ id: string; title: string }[]>();

  let query = sb
    .from("claims")
    .select("*, events(title)")
    .order("submitted_at", { ascending: false });
  if (event) query = query.eq("event_id", event);
  let claims = (await query.returns<ClaimRow[]>()).data ?? [];

  if (q) {
    const ql = q.toLowerCase();
    claims = claims.filter((c) =>
      [c.username, c.name, c.phone, c.address, c.events?.title].some((v) =>
        String(v ?? "").toLowerCase().includes(ql),
      ),
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/finance/marketing/event-picker"
            className="text-[14px] text-ep-ink-muted underline-offset-4 hover:text-ep-ink"
          >
            ← 이벤트 목록
          </Link>
          <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.022em] text-ep-ink sm:text-[26px]">
            당첨자 제출 내역
          </h1>
        </div>
      </header>

      {/* 검색 */}
      <form method="get" className="mb-5 flex flex-col gap-2 sm:flex-row">
        <select
          name="event"
          defaultValue={event}
          className="h-11 rounded-xl border border-ep-hairline bg-ep-field px-3 text-[14px] text-ep-ink outline-none focus:border-ep-accent sm:w-64"
        >
          <option value="">전체 이벤트</option>
          {events?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
        <input
          name="q"
          defaultValue={q}
          placeholder="아이디·이름·전화·주소 검색"
          className="h-11 flex-1 rounded-xl border border-ep-hairline bg-ep-field px-3.5 text-[14px] text-ep-ink outline-none transition focus:border-ep-accent focus:ring-4 focus:ring-ep-accent-soft"
        />
        <button
          type="submit"
          className="h-11 rounded-full border border-ep-hairline px-6 text-[14px] font-medium text-ep-ink transition active:scale-[0.97]"
        >
          검색
        </button>
      </form>

      <p className="mb-3 text-[14px] text-ep-ink-muted">{claims.length}건</p>

      {/* 테이블 + 선택 다운로드 */}
      {!claims.length ? (
        <p className="rounded-[18px] border border-dashed border-ep-hairline p-10 text-center text-[15px] text-ep-ink-muted">
          제출된 내역이 없습니다.
        </p>
      ) : (
        <ClaimsTable
          rows={claims.map<ClaimRowVM>((c) => ({
            id: c.id,
            eventTitle: c.events?.title ?? "",
            username: c.username,
            name: c.name,
            phone: c.phone,
            address: `${c.address}${c.address_detail ? " " + c.address_detail : ""}`,
            // 서버(Vercel)가 UTC 라 timeZone 명시 안 하면 9시간 느리게 표시됨
            submittedAt: new Date(c.submitted_at).toLocaleString("ko-KR", {
              timeZone: "Asia/Seoul",
            }),
          }))}
          event={event}
          q={q}
        />
      )}

      <p className="mt-4 text-[12px] text-ep-ink-faint">
        개인정보(주소·연락처)는 배송 목적에 한해 이용하고, 배송 완료 후 파기하세요.
      </p>
    </main>
  );
}
