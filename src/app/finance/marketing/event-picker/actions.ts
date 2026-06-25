"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/event-picker/supabase";
import { scrapeComments } from "@/lib/event-picker/apify";
import { headers } from "next/headers";
import {
  graphConfigured,
  fetchCommentsForUrls,
  fetchCommentIndexForUrls,
  replyToComment,
  sendPrivateReply,
  resolveAccountForUrls,
  type IgAccount,
} from "@/lib/event-picker/instagram-graph";
import { cookieConfigured, fetchCookieForUrls } from "@/lib/event-picker/instagram-cookie";
import {
  extractUsernamesFromText,
  normalizeUsername,
} from "@/lib/event-picker/instagram";
import { seededShuffle, generateSeed } from "@/lib/event-picker/draw";
import { generateCaptionText } from "@/lib/event-picker/caption";
import type { EventRow, CommentRow } from "@/lib/event-picker/types";

export interface ReplyOutcome {
  username: string;
  matched: boolean;
  preview: string;
  posted: boolean;
  error?: string;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
  caption?: string;
  replies?: ReplyOutcome[];
}

function parseUrls(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ── 이벤트 생성 ─────────────────────────────────────────────
export async function createEvent(formData: FormData): Promise<void> {
  const title = String(formData.get("title") ?? "").trim();
  const urls = parseUrls(String(formData.get("urls") ?? ""));
  const winnerCount = Math.max(1, Number(formData.get("winnerCount") ?? 1));
  const backupCount = Math.max(0, Number(formData.get("backupCount") ?? 0));

  if (!title) throw new Error("제목을 입력하세요.");

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("events")
    .insert({
      title,
      urls,
      winner_count: winnerCount,
      backup_count: backupCount,
    })
    .select("id")
    .single();

  if (error) throw new Error(`이벤트 생성 실패: ${error.message}`);
  revalidatePath("/finance/marketing/event-picker");
  redirect(`/finance/marketing/event-picker/${data.id}`);
}

// ── 댓글 수집: Apify ────────────────────────────────────────
export async function collectViaApify(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const eventId = String(formData.get("eventId") ?? "");
  const sb = getSupabaseAdmin();

  const { data: ev, error: evErr } = await sb
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single<EventRow>();
  if (evErr || !ev) return { ok: false, error: "이벤트를 찾을 수 없습니다." };
  if (!ev.urls.length) return { ok: false, error: "이벤트에 수집할 URL이 없습니다." };

  let scraped;
  try {
    if (graphConfigured()) {
      // 인스타 공식 API — 전체 댓글(답글 포함)
      const g = await fetchCommentsForUrls(ev.urls);
      scraped = g.map((c) => ({ username: c.username, text: c.text, commentedAt: c.timestamp }));
    } else if (cookieConfigured()) {
      // 인스타 로그인 세션(쿠키) — 전체 댓글
      const g = await fetchCookieForUrls(ev.urls);
      scraped = g.map((c) => ({ username: c.username, text: c.text, commentedAt: c.timestamp }));
    } else {
      // 폴백: Apify (무로그인 — 첫 페이지만)
      scraped = await scrapeComments(ev.urls);
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "수집 실패" };
  }

  const rows = scraped
    .map((c) => {
      const username = normalizeUsername(c.username);
      if (!username) return null;
      return {
        event_id: eventId,
        username,
        text: c.text,
        commented_at: c.commentedAt,
        source: "apify" as const,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (!rows.length) {
    return { ok: false, error: "수집된 댓글이 없습니다. 붙여넣기 방식을 시도하세요." };
  }

  return await replaceComments(eventId, rows);
}

// ── 댓글 수집: 붙여넣기 폴백 ───────────────────────────────
export async function collectViaPaste(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const eventId = String(formData.get("eventId") ?? "");
  const text = String(formData.get("text") ?? "");
  const usernames = extractUsernamesFromText(text);
  if (!usernames.length) {
    return { ok: false, error: "텍스트에서 아이디를 찾지 못했습니다." };
  }
  const rows = usernames.map((username) => ({
    event_id: eventId,
    username,
    text: null,
    commented_at: null,
    source: "paste" as const,
  }));
  return await replaceComments(eventId, rows);
}

async function replaceComments(
  eventId: string,
  rows: Array<Omit<CommentRow, "id" | "created_at">>,
): Promise<ActionResult> {
  const sb = getSupabaseAdmin();
  await sb.from("comments").delete().eq("event_id", eventId);
  const { error } = await sb.from("comments").insert(rows);
  if (error) return { ok: false, error: `저장 실패: ${error.message}` };

  // 수집하면 이전 추첨 결과는 무효화 → collected 로
  await sb.from("winners").delete().eq("event_id", eventId);
  await sb
    .from("events")
    .update({ status: "collected", seed: null })
    .eq("id", eventId);
  revalidatePath(`/finance/marketing/event-picker/${eventId}`);
  return { ok: true, message: `${rows.length}건 수집 완료` };
}

// ── 후보 정제 설정 (1인1표 / 제외 명단) ────────────────────
export async function updateRefine(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const eventId = String(formData.get("eventId") ?? "");
  const dedupe = formData.get("dedupe") === "on";
  const excluded = extractUsernamesFromText(String(formData.get("excluded") ?? ""));
  const seeded = extractUsernamesFromText(String(formData.get("seeded") ?? ""));
  const winnerCount = Math.max(1, Number(formData.get("winnerCount") ?? 1));
  const backupCount = Math.max(0, Number(formData.get("backupCount") ?? 0));

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("events")
    .update({
      dedupe,
      excluded,
      winner_count: winnerCount,
      backup_count: backupCount,
    })
    .eq("id", eventId);
  if (error) return { ok: false, error: error.message };

  // 수동 확정 당첨 참가자 = source='seed' 댓글 행으로 동기화 (전체 교체)
  await sb.from("comments").delete().eq("event_id", eventId).eq("source", "seed");
  if (seeded.length) {
    const rows = seeded.map((username) => ({ event_id: eventId, username, source: "seed" }));
    const { error: sErr } = await sb.from("comments").insert(rows);
    if (sErr) return { ok: false, error: `확정 당첨 저장 실패: ${sErr.message}` };
  }

  revalidatePath(`/finance/marketing/event-picker/${eventId}`);
  return { ok: true, message: "정제 설정 저장됨" };
}

// ── 추첨 실행 ───────────────────────────────────────────────
export async function runDraw(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const eventId = String(formData.get("eventId") ?? "");
  const sb = getSupabaseAdmin();

  const { data: ev } = await sb
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single<EventRow>();
  if (!ev) return { ok: false, error: "이벤트를 찾을 수 없습니다." };

  const { data: comments } = await sb
    .from("comments")
    .select("username, source")
    .eq("event_id", eventId)
    .returns<{ username: string; source: string }[]>();

  // 수동 확정 당첨(source='seed')과 일반 후보 분리
  const seededList = Array.from(
    new Set((comments ?? []).filter((c) => c.source === "seed").map((c) => c.username)),
  );
  const realComments = (comments ?? []).filter((c) => c.source !== "seed");
  if (!realComments.length && !seededList.length) {
    return { ok: false, error: "수집된 댓글이 없습니다." };
  }

  const excluded = new Set(ev.excluded);
  const seededSet = new Set(seededList);
  // 일반 후보 풀: 제외·수동확정 제거 (dedupe면 유니크, 아니면 중복=가중치)
  let pool = realComments
    .map((c) => c.username)
    .filter((u) => !excluded.has(u) && !seededSet.has(u));
  if (ev.dedupe) pool = Array.from(new Set(pool));

  const seed = generateSeed();
  const shuffled = seededShuffle(pool, seed);

  // 일반 후보에서 서로 다른 아이디 추출 (가중치 모드여도 중복 당첨 방지)
  const seen = new Set<string>(seededSet);
  const randomPicks: string[] = [];
  for (const u of shuffled) {
    if (seen.has(u)) continue;
    seen.add(u);
    randomPicks.push(u);
  }

  // 수동 확정 당첨은 무조건 당첨, 나머지 자리만 랜덤으로 채움
  const seededWinners = seededList.slice(0, ev.winner_count);
  const droppedSeeded = seededList.length - seededWinners.length;
  const fillNeeded = Math.max(0, ev.winner_count - seededWinners.length);
  const randomWinners = randomPicks.slice(0, fillNeeded);
  // 명단·영상이 자연스럽게 보이도록 당첨자 순서를 섞음
  const winners = seededShuffle([...seededWinners, ...randomWinners], `${seed}-order`);
  const backups = randomPicks.slice(fillNeeded, fillNeeded + ev.backup_count);

  if (!winners.length) return { ok: false, error: "추첨할 후보가 부족합니다." };

  // 기존 결과 교체
  await sb.from("winners").delete().eq("event_id", eventId);
  const winnerRows = [
    ...winners.map((username, i) => ({
      event_id: eventId,
      username,
      rank: i + 1,
      is_backup: false,
    })),
    ...backups.map((username, i) => ({
      event_id: eventId,
      username,
      rank: i + 1,
      is_backup: true,
    })),
  ];
  const { error: wErr } = await sb.from("winners").insert(winnerRows);
  if (wErr) return { ok: false, error: `당첨자 저장 실패: ${wErr.message}` };

  await sb.from("draw_logs").insert({
    event_id: eventId,
    candidate_count: pool.length,
    winner_count: ev.winner_count,
    backup_count: ev.backup_count,
    seed,
    winners,
    backups,
  });

  await sb
    .from("events")
    .update({ status: "drawn", seed })
    .eq("id", eventId);
  revalidatePath(`/finance/marketing/event-picker/${eventId}`);
  const notes: string[] = [];
  if (winners.length < ev.winner_count) {
    notes.push(`일반 후보 부족으로 설정 ${ev.winner_count}명 중 ${winners.length}명만`);
  }
  if (droppedSeeded > 0) {
    notes.push(`확정 당첨이 당첨 인원보다 ${droppedSeeded}명 많아 제외됨 (당첨 인원을 늘리세요)`);
  }
  const mix = seededWinners.length
    ? ` (확정 ${seededWinners.length} + 랜덤 ${randomWinners.length})`
    : "";
  const suffix = notes.length ? ` — ${notes.join(" / ")}` : "";
  return { ok: true, message: `${winners.length}명 추첨 완료${mix}${suffix}` };
}

// ── 추첨 초기화 ─────────────────────────────────────────────
export async function resetDraw(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const eventId = String(formData.get("eventId") ?? "");
  const sb = getSupabaseAdmin();
  await sb.from("winners").delete().eq("event_id", eventId);
  await sb.from("draw_logs").delete().eq("event_id", eventId);
  await sb.from("events").update({ status: "collected", seed: null }).eq("id", eventId);
  revalidatePath(`/finance/marketing/event-picker/${eventId}`);
  return { ok: true, message: "추첨 초기화됨" };
}

// ── 보결 승급 (미응답 당첨자 대체) ─────────────────────────
export async function promoteBackup(formData: FormData): Promise<void> {
  const eventId = String(formData.get("eventId") ?? "");
  const username = String(formData.get("username") ?? "");
  const sb = getSupabaseAdmin();

  const { data: mains } = await sb
    .from("winners")
    .select("rank")
    .eq("event_id", eventId)
    .eq("is_backup", false);
  const nextRank =
    (mains?.reduce((m, r) => Math.max(m, r.rank), 0) ?? 0) + 1;

  await sb
    .from("winners")
    .update({ is_backup: false, rank: nextRank })
    .eq("event_id", eventId)
    .eq("username", username)
    .eq("is_backup", true);
  revalidatePath(`/finance/marketing/event-picker/${eventId}`);
}

// ── 단일 당첨자 재추첨 (이상 댓글자 교체) ──────────────────
// 우선순위: ① 남은 댓글 참여자 중 새 후보 → ② 보결 승급 → ③ 둘 다 없으면 교체 거부(삭제 안 함).
export async function redrawWinner(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const eventId = String(formData.get("eventId") ?? "");
  const username = String(formData.get("username") ?? "");
  if (!eventId || !username) return { ok: false, error: "잘못된 요청입니다." };
  const sb = getSupabaseAdmin();

  const { data: ev } = await sb
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single<EventRow>();
  if (!ev) return { ok: false, error: "이벤트를 찾을 수 없습니다." };

  const { data: comments } = await sb
    .from("comments")
    .select("username")
    .eq("event_id", eventId);
  const { data: existing } = await sb
    .from("winners")
    .select("username, rank, is_backup")
    .eq("event_id", eventId);
  const rows = existing ?? [];
  const oldRow = rows.find((w) => w.username === username);
  if (!oldRow) return { ok: false, error: "당첨자 목록에 없습니다." };

  const excluded = Array.from(new Set([...ev.excluded, username]));

  // ① 남은 새 후보 (현재 당첨자/보결 + 제외 제외)
  const taken = new Set([...rows.map((w) => w.username), ...excluded]);
  let pool = (comments ?? []).map((c) => c.username).filter((u) => !taken.has(u));
  if (ev.dedupe) pool = Array.from(new Set(pool));

  if (pool.length) {
    const replacement = seededShuffle(pool, generateSeed())[0];
    await sb.from("winners").delete().eq("event_id", eventId).eq("username", username);
    await sb.from("winners").insert({
      event_id: eventId,
      username: replacement,
      rank: oldRow.rank,
      is_backup: false,
    });
    await sb.from("events").update({ excluded }).eq("id", eventId);
    revalidatePath(`/finance/marketing/event-picker/${eventId}`);
    return { ok: true, message: `@${username} → @${replacement} 교체` };
  }

  // ② 새 후보 없으면 보결을 승급해 대체
  const backup = rows.find((w) => w.is_backup && w.username !== username);
  if (backup) {
    await sb.from("winners").delete().eq("event_id", eventId).eq("username", username);
    await sb
      .from("winners")
      .update({ is_backup: false, rank: oldRow.rank })
      .eq("event_id", eventId)
      .eq("username", backup.username);
    await sb.from("events").update({ excluded }).eq("id", eventId);
    revalidatePath(`/finance/marketing/event-picker/${eventId}`);
    return { ok: true, message: `@${username} 제외 → 보결 @${backup.username} 승급` };
  }

  // ③ 둘 다 없음 — 삭제하지 않고 거부
  return {
    ok: false,
    error: "교체할 새 후보가 없습니다. 모든 댓글 참여자가 이미 당첨자예요 (당첨 인원을 줄이거나 댓글이 더 많은 게시물이 필요).",
  };
}

// ── 이벤트 삭제 ─────────────────────────────────────────────
export async function deleteEvent(formData: FormData): Promise<void> {
  const eventId = String(formData.get("eventId") ?? "");
  const sb = getSupabaseAdmin();
  await sb.from("events").delete().eq("id", eventId);
  revalidatePath("/finance/marketing/event-picker");
  redirect("/finance/marketing/event-picker");
}

// ── AI 캡션 생성 ────────────────────────────────────────────
export async function generateCaption(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const eventId = String(formData.get("eventId") ?? "");
  const note = String(formData.get("note") ?? "");
  if (!eventId) return { ok: false, error: "이벤트를 찾을 수 없습니다." };

  const sb = getSupabaseAdmin();
  const { data: ev } = await sb
    .from("events")
    .select("title")
    .eq("id", eventId)
    .single<{ title: string }>();
  if (!ev) return { ok: false, error: "이벤트를 찾을 수 없습니다." };

  const { data: winners } = await sb
    .from("winners")
    .select("username")
    .eq("event_id", eventId)
    .eq("is_backup", false)
    .order("rank", { ascending: true })
    .returns<{ username: string }[]>();
  const list = (winners ?? []).map((w) => w.username);
  if (!list.length) return { ok: false, error: "먼저 추첨을 진행하세요." };

  try {
    const caption = await generateCaptionText({ title: ev.title, winners: list, note });
    if (!caption) return { ok: false, error: "캡션이 비어 있습니다. 다시 시도하세요." };
    return { ok: true, caption };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "캡션 생성에 실패했습니다." };
  }
}

// ── 당첨자 댓글 자동 답글 ───────────────────────────────────
function renderReply(template: string, username: string): string {
  return template.replaceAll("{username}", username);
}

async function loadReplyTargets(
  eventId: string,
): Promise<{ error?: string; urls?: string[]; winners?: string[]; account?: IgAccount }> {
  if (!graphConfigured()) {
    return { error: "공식 Graph API 연결이 필요합니다 (자동 답글)." };
  }
  const sb = getSupabaseAdmin();
  const { data: ev } = await sb
    .from("events")
    .select("urls")
    .eq("id", eventId)
    .single<{ urls: string[] }>();
  if (!ev) return { error: "이벤트를 찾을 수 없습니다." };
  if (!ev.urls?.length) {
    return { error: "게시물 URL이 없어 댓글을 찾을 수 없습니다 (붙여넣기 수집 이벤트)." };
  }
  // 게시물 소유 계정 자동 감지 (다계정 라우팅)
  const account = await resolveAccountForUrls(ev.urls);
  if (!account) {
    return { error: "이 게시물을 연결된 계정에서 찾지 못했습니다. 계정 연결을 확인하세요." };
  }
  const { data: w } = await sb
    .from("winners")
    .select("username")
    .eq("event_id", eventId)
    .eq("is_backup", false)
    .order("rank", { ascending: true })
    .returns<{ username: string }[]>();
  const winners = (w ?? []).map((x) => x.username);
  if (!winners.length) return { error: "먼저 추첨을 진행하세요." };
  return { urls: ev.urls, winners, account };
}

/** 미리보기 — 실제 게시하지 않고 매칭/문구만 확인 */
export async function previewReplies(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const eventId = String(formData.get("eventId") ?? "");
  const template = String(formData.get("template") ?? "").trim();
  if (!template) return { ok: false, error: "답글 문구를 입력하세요." };

  const t = await loadReplyTargets(eventId);
  if (t.error) return { ok: false, error: t.error };

  let index;
  try {
    index = await fetchCommentIndexForUrls(t.urls!);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "댓글 조회 실패" };
  }

  const replies: ReplyOutcome[] = t.winners!.map((u) => ({
    username: u,
    matched: index.has(u.toLowerCase()),
    preview: renderReply(template, u),
    posted: false,
  }));
  const matched = replies.filter((r) => r.matched).length;
  return {
    ok: true,
    message: `${matched}/${replies.length}명 댓글 매칭됨 (미리보기 — 아직 게시 안 함)`,
    replies,
  };
}

/** 실제 게시 — 당첨자 댓글마다 공개 답글 작성 */
export async function replyToWinners(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const eventId = String(formData.get("eventId") ?? "");
  const template = String(formData.get("template") ?? "").trim();
  if (!template) return { ok: false, error: "답글 문구를 입력하세요." };

  const t = await loadReplyTargets(eventId);
  if (t.error) return { ok: false, error: t.error };

  let index;
  try {
    index = await fetchCommentIndexForUrls(t.urls!);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "댓글 조회 실패" };
  }

  const replies: ReplyOutcome[] = [];
  for (const u of t.winners!) {
    const ref = index.get(u.toLowerCase());
    const preview = renderReply(template, u);
    if (!ref) {
      replies.push({ username: u, matched: false, preview, posted: false, error: "댓글 못 찾음" });
      continue;
    }
    const r = await replyToComment(ref.id, preview, t.account!);
    replies.push({
      username: u,
      matched: true,
      preview,
      posted: r.ok,
      error: r.ok ? undefined : r.error,
    });
  }
  const posted = replies.filter((r) => r.posted).length;
  return { ok: true, message: `${posted}/${replies.length}명 답글 게시 완료`, replies };
}

/** 패널용 디스패처 — intent=post 면 실제 게시, 아니면 미리보기 */
export async function handleReplies(
  prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return formData.get("intent") === "post"
    ? replyToWinners(prev, formData)
    : previewReplies(prev, formData);
}

// ── 당첨자 안내 DM (Private Reply) ──────────────────────────
async function originFromHeaders(): Promise<string> {
  // 배포·터널 공개주소가 있으면 우선 사용 (localhost 링크는 폰에서 안 열림)
  const base = process.env.APP_BASE_URL?.trim();
  if (base) return base.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("host") ?? "localhost:3100";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function renderDM(template: string, username: string, claimLink: string): string {
  return template.replaceAll("{username}", username).replaceAll("{claim_link}", claimLink);
}

/** 미리보기 — 발송하지 않고 매칭/문구만 확인 */
export async function previewDM(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const eventId = String(formData.get("eventId") ?? "");
  const template = String(formData.get("template") ?? "").trim();
  if (!template) return { ok: false, error: "DM 문구를 입력하세요." };

  const t = await loadReplyTargets(eventId);
  if (t.error) return { ok: false, error: t.error };

  let index;
  try {
    index = await fetchCommentIndexForUrls(t.urls!);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "댓글 조회 실패" };
  }

  const claimLink = `${await originFromHeaders()}/c/${eventId.slice(0, 8)}`;
  const replies: ReplyOutcome[] = t.winners!.map((u) => ({
    username: u,
    matched: index.has(u.toLowerCase()),
    preview: renderDM(template, u, claimLink),
    posted: false,
  }));
  const matched = replies.filter((r) => r.matched).length;
  return {
    ok: true,
    message: `${matched}/${replies.length}명 댓글 매칭됨 (미리보기 — DM 미발송)`,
    replies,
  };
}

/** 실제 발송 — 당첨자 댓글에 대한 비공개 답장(DM) */
export async function sendDMs(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const eventId = String(formData.get("eventId") ?? "");
  const template = String(formData.get("template") ?? "").trim();
  if (!template) return { ok: false, error: "DM 문구를 입력하세요." };

  const t = await loadReplyTargets(eventId);
  if (t.error) return { ok: false, error: t.error };

  let index;
  try {
    index = await fetchCommentIndexForUrls(t.urls!);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "댓글 조회 실패" };
  }

  const claimLink = `${await originFromHeaders()}/c/${eventId.slice(0, 8)}`;
  const replies: ReplyOutcome[] = [];
  for (const u of t.winners!) {
    const ref = index.get(u.toLowerCase());
    const preview = renderDM(template, u, claimLink);
    if (!ref) {
      replies.push({ username: u, matched: false, preview, posted: false, error: "댓글 못 찾음" });
      continue;
    }
    const r = await sendPrivateReply(ref.id, preview, t.account!);
    replies.push({
      username: u,
      matched: true,
      preview,
      posted: r.ok,
      error: r.ok ? undefined : r.error,
    });
  }
  const sent = replies.filter((r) => r.posted).length;
  return { ok: true, message: `${sent}/${replies.length}명 DM 발송 완료`, replies };
}

/** 패널용 디스패처 — intent=send 면 실제 발송, 아니면 미리보기 */
export async function handleDM(
  prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return formData.get("intent") === "send"
    ? sendDMs(prev, formData)
    : previewDM(prev, formData);
}
