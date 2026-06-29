import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/event-picker/supabase";
import {
  STATUS_LABEL,
  type EventRow,
  type WinnerRow,
} from "@/lib/event-picker/types";
import { deleteEvent, promoteBackup } from "../actions";
import { RedrawButton } from "./RedrawButton";
import { CollectPanel, RefinePanel, DrawPanel } from "./panels";
import { ResultStudio } from "./ResultStudio";
import { CaptionPanel } from "./CaptionPanel";
import { ReplyPanel } from "./ReplyPanel";
import { DMPanel } from "./DMPanel";
import { ClaimLink } from "./ClaimLink";
import { ExportExcelButton } from "@/components/event-picker/ExportExcelButton";
import { graphConfigured } from "@/lib/event-picker/instagram-graph";

export const dynamic = "force-dynamic";

function Section({
  step,
  title,
  desc,
  children,
}: {
  step: number;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ep-hairline bg-ep-card p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ep-accent text-xs text-ep-on-accent">
            {step}
          </span>
          {title}
        </h2>
        {desc && <p className="mt-1 text-sm text-ep-ink-muted">{desc}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = getSupabaseAdmin();

  const { data: ev } = await sb
    .from("events")
    .select("*")
    .eq("id", id)
    .single<EventRow>();
  if (!ev) notFound();

  const { data: allComments } = await sb
    .from("comments")
    .select("username, text, source")
    .eq("event_id", id)
    .returns<{ username: string; text: string | null; source: string }[]>();

  // 수동 확정 당첨(source='seed')은 일반 후보·통계에서 분리
  const seeded = (allComments ?? [])
    .filter((c) => c.source === "seed")
    .map((c) => c.username);
  const comments = (allComments ?? []).filter((c) => c.source !== "seed");
  const { data: winners } = await sb
    .from("winners")
    .select("*")
    .eq("event_id", id)
    .order("is_backup", { ascending: true })
    .order("rank", { ascending: true })
    .returns<WinnerRow[]>();

  const allUsernames = (comments ?? []).map((c) => c.username);
  const collectedCount = allUsernames.length;
  const excluded = new Set(ev.excluded);
  let candidates = allUsernames.filter((u) => !excluded.has(u));
  if (ev.dedupe) candidates = Array.from(new Set(candidates));
  const candidateCount = candidates.length;

  const mainWinners = (winners ?? []).filter((w) => !w.is_backup);
  const backupWinners = (winners ?? []).filter((w) => w.is_backup);

  // 당첨자별 댓글 본문 (Apify 수집 시 저장됨, 붙여넣기는 없음)
  const commentsByUser = new Map<string, string[]>();
  for (const c of comments ?? []) {
    const t = (c.text ?? "").trim();
    if (!t) continue;
    const arr = commentsByUser.get(c.username) ?? [];
    arr.push(t);
    commentsByUser.set(c.username, arr);
  }
  const commentOf = (u: string) => commentsByUser.get(u)?.join("  /  ") ?? "";

  const { data: claims } = await sb
    .from("claims")
    .select("username, name, submitted_at")
    .eq("event_id", id)
    .order("submitted_at", { ascending: false })
    .returns<{ username: string; name: string; submitted_at: string }[]>();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      {/* 헤더 */}
      <div className="mb-6">
        <Link
          href="/finance/marketing/event-picker"
          className="text-sm text-ep-ink-muted underline-offset-4 hover:underline"
        >
          ← 이벤트 목록
        </Link>
      </div>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {ev.title}
            </h1>
            <span className="shrink-0 rounded-full bg-ep-parchment px-2.5 py-1 text-xs font-medium text-ep-ink-muted">
              {STATUS_LABEL[ev.status]}
            </span>
          </div>
          {ev.urls.length > 0 ? (
            <ul className="flex flex-col gap-0.5">
              {ev.urls.map((u) => (
                <li key={u}>
                  <a
                    href={u}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-sm text-ep-accent underline-offset-2 hover:underline"
                  >
                    {u}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ep-ink-faint">등록된 URL 없음</p>
          )}
        </div>
        <form action={deleteEvent}>
          <input type="hidden" name="eventId" value={ev.id} />
          <button
            type="submit"
            className="text-sm text-ep-ink-muted underline-offset-4 hover:text-ep-accent"
          >
            삭제
          </button>
        </form>
      </header>

      {/* 진행 통계 */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="수집된 댓글" value={collectedCount} />
        <Stat label="추첨 후보" value={candidateCount} />
        <Stat label="당첨 인원" value={`${ev.winner_count}명`} />
      </div>

      <div className="flex flex-col gap-5">
        {/* 1. 수집 */}
        <Section
          step={1}
          title="댓글 수집"
          desc="Apify 자동 수집 또는 댓글 붙여넣기로 참여자 아이디를 모읍니다."
        >
          <CollectPanel eventId={ev.id} hasUrls={ev.urls.length > 0} />
        </Section>

        {/* 2. 정제 */}
        <Section
          step={2}
          title="후보 정제"
          desc="중복 제거·제외 명단·인원수를 정합니다."
        >
          <RefinePanel
            eventId={ev.id}
            dedupe={ev.dedupe}
            excluded={ev.excluded}
            seeded={seeded}
            winnerCount={ev.winner_count}
            backupCount={ev.backup_count}
          />
        </Section>

        {/* 3. 추첨 */}
        <Section
          step={3}
          title="추첨"
          desc="시드 기반 랜덤 추첨 — 같은 후보·시드면 결과가 동일하게 재현됩니다."
        >
          {collectedCount === 0 && seeded.length === 0 ? (
            <p className="text-sm text-ep-ink-muted">
              먼저 댓글을 수집하세요. (또는 2단계에서 확정 당첨 아이디를 입력)
            </p>
          ) : (
            <DrawPanel eventId={ev.id} drawn={ev.status === "drawn"} />
          )}
        </Section>

        {/* 4. 결과 */}
        {mainWinners.length > 0 && (
          <Section
            step={4}
            title="추첨 결과"
            desc="각 당첨자의 댓글을 확인하고, 이상한 댓글이면 '재추첨'으로 그 사람만 교체하세요 (제외 후 대체자 1명 추첨)."
          >
            <div className="flex flex-col gap-4">
              {/* 당첨자 아이디 + 댓글 엑셀 다운로드 (댓글별 선물 정리용) */}
              <a
                href={`/api/event-picker/winners?event=${id}`}
                className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full bg-ep-accent px-4 text-[13px] font-semibold text-ep-on-accent transition active:scale-[0.96]"
              >
                ⬇ 당첨자·댓글 엑셀 다운로드
              </a>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ep-ink">
                  당첨자 ({mainWinners.length}명)
                </h3>
                {mainWinners.length < ev.winner_count && (
                  <p className="mb-3 rounded-lg border border-ep-hairline bg-ep-parchment px-3 py-2 text-xs leading-relaxed text-ep-ink-muted">
                    설정 당첨 인원은 <b>{ev.winner_count}명</b>이지만, 댓글 참여자(고유{" "}
                    {candidateCount}명)가 부족해 <b>{mainWinners.length}명</b>만 추첨됐어요.
                    더 뽑으려면 댓글이 더 많은 게시물이 필요합니다.
                  </p>
                )}
                <ul className="flex flex-col gap-2">
                  {mainWinners.map((w) => {
                    const c = commentOf(w.username);
                    return (
                      <li
                        key={w.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-ep-hairline bg-ep-parchment p-3"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-ep-accent">
                            @{w.username}
                          </p>
                          <p className="mt-0.5 break-words text-sm text-ep-ink-muted">
                            {c || (
                              <span className="text-ep-ink-faint">
                                (댓글 본문 없음 — 붙여넣기 수집)
                              </span>
                            )}
                          </p>
                        </div>
                        <RedrawButton eventId={ev.id} username={w.username} />
                      </li>
                    );
                  })}
                </ul>
              </div>
              {backupWinners.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-ep-ink">
                    보결 ({backupWinners.length}명)
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {backupWinners.map((w) => {
                      const c = commentOf(w.username);
                      return (
                        <li
                          key={w.id}
                          className="flex items-start justify-between gap-3 rounded-xl border border-ep-hairline p-3"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-ep-ink">
                              @{w.username}
                            </p>
                            <p className="mt-0.5 break-words text-sm text-ep-ink-muted">
                              {c || <span className="text-ep-ink-faint">(댓글 본문 없음)</span>}
                            </p>
                          </div>
                          <form action={promoteBackup}>
                            <input type="hidden" name="eventId" value={ev.id} />
                            <input type="hidden" name="username" value={w.username} />
                            <button
                              type="submit"
                              title="본선 당첨자로 승급"
                              className="shrink-0 rounded-full bg-ep-accent px-3 py-1 text-xs font-medium text-ep-on-accent"
                            >
                              승급
                            </button>
                          </form>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {ev.seed && (
                <p className="text-xs text-ep-ink-faint">
                  추첨 시드: <code className="font-mono">{ev.seed}</code> · 후보{" "}
                  {candidateCount}명 (공정성 검증용)
                </p>
              )}
            </div>
          </Section>
        )}

        {/* 5. 결과물 생성 */}
        {mainWinners.length > 0 && (
          <Section
            step={5}
            title="결과물 생성"
            desc="추첨 영상(슬롯머신)과 당첨자 캐러셀을 만들어 인스타에 올리세요."
          >
            <ResultStudio
              title={ev.title}
              winners={mainWinners.map((w) => w.username)}
              pool={candidates.slice(0, 120)}
            />
          </Section>
        )}

        {/* 6. AI 캡션 */}
        {mainWinners.length > 0 && (
          <Section
            step={6}
            title="AI 캡션 작성"
            desc="당첨 발표용 인스타 캡션을 Claude가 작성합니다 (축하 + 당첨자 + 배송 신청 안내). 참고 문구를 넣으면 반영해요."
          >
            <CaptionPanel eventId={ev.id} />
          </Section>
        )}

        {/* 7. 당첨자 댓글 답글 */}
        {mainWinners.length > 0 && (
          <Section
            step={7}
            title="당첨자 댓글에 답글 (자동)"
            desc="당첨자들의 인스타 댓글에 공개 축하 답글을 한 번에 답니다. 먼저 미리보기로 확인하세요."
          >
            <ReplyPanel
              eventId={ev.id}
              available={graphConfigured() && ev.urls.length > 0}
            />
          </Section>
        )}

        {/* 8. 당첨자 안내 DM */}
        {mainWinners.length > 0 && (
          <Section
            step={8}
            title="당첨자 안내 DM (자동)"
            desc="당첨자 댓글에 비공개 답장(DM)으로 배송정보 입력 링크를 보냅니다. 댓글 작성 후 7일 이내만 가능."
          >
            <DMPanel
              eventId={ev.id}
              available={graphConfigured() && ev.urls.length > 0}
            />
          </Section>
        )}

        {/* 9. 당첨자 정보 수집 */}
        {mainWinners.length > 0 && (
          <Section
            step={9}
            title="당첨자 정보 수집"
            desc="이 링크를 인스타 발표글·DM으로 안내하면, 당첨자가 배송정보를 입력합니다 (Supabase 저장)."
          >
            <div className="flex flex-col gap-5">
              <ClaimLink eventId={ev.id} />
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-ep-ink">
                    제출 현황 ({claims?.length ?? 0}/{mainWinners.length})
                  </h3>
                  {(claims?.length ?? 0) > 0 && (
                    <ExportExcelButton event={ev.id} compact />
                  )}
                </div>
                {!claims?.length ? (
                  <p className="text-sm text-ep-ink-muted">아직 제출한 당첨자가 없습니다.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-ep-hairline">
                    {claims.map((c) => (
                      <li
                        key={c.username}
                        className="flex items-center justify-between gap-3 py-2 text-sm"
                      >
                        <span className="font-medium">@{c.username}</span>
                        <span className="text-ep-ink-muted">{c.name}</span>
                        <span className="text-xs text-ep-ink-faint">
                          {new Date(c.submitted_at).toLocaleString("ko-KR", {
                            timeZone: "Asia/Seoul",
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-xs text-ep-ink-faint">
                  전체 배송정보(주소·전화)는{" "}
                  <Link href="/finance/marketing/event-picker/claims" className="underline underline-offset-2">
                    제출 내역
                  </Link>{" "}
                  에서 검색·다운로드. 개인정보는 배송 완료 후 파기.
                </p>
              </div>
            </div>
          </Section>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-ep-hairline bg-ep-card p-4">
      <p className="text-xs text-ep-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
