import * as XLSX from "xlsx";
import { getSupabaseAdmin } from "@/lib/event-picker/supabase";

// 추첨 결과(당첨자 아이디 + 댓글) → 엑셀(.xlsx). 운영자 전용.
// 댓글에 따라 선물이 달라서 당첨자별 댓글을 한눈에 정리·다운로드.
// ?event= 필수.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const event = url.searchParams.get("event") ?? "";
  if (!event) return new Response("event 파라미터가 필요합니다.", { status: 400 });

  const sb = getSupabaseAdmin();

  // 이벤트명 (파일명용)
  const { data: ev } = await sb
    .from("events")
    .select("title")
    .eq("id", event)
    .single<{ title: string }>();

  // 댓글 본문 — 수동 확정(source='seed')은 제외, 당첨자별로 묶음
  const { data: comments } = await sb
    .from("comments")
    .select("username, text, source")
    .eq("event_id", event)
    .returns<{ username: string; text: string | null; source: string }[]>();

  const commentsByUser = new Map<string, string[]>();
  for (const c of comments ?? []) {
    if (c.source === "seed") continue;
    const t = (c.text ?? "").trim();
    if (!t) continue;
    const arr = commentsByUser.get(c.username) ?? [];
    arr.push(t);
    commentsByUser.set(c.username, arr);
  }
  const commentOf = (u: string) =>
    commentsByUser.get(u)?.join("  /  ") ?? "";

  // 당첨자 — 본선 먼저, rank 순
  const { data: winners } = await sb
    .from("winners")
    .select("username, is_backup, rank")
    .eq("event_id", event)
    .order("is_backup", { ascending: true })
    .order("rank", { ascending: true })
    .returns<{ username: string; is_backup: boolean; rank: number | null }[]>();

  const header = ["순번", "구분", "아이디", "댓글"];
  let n = 0;
  const body = (winners ?? []).map((w) => {
    n += 1;
    return [n, w.is_backup ? "보결" : "본선", w.username, commentOf(w.username)];
  });

  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  ws["!cols"] = [{ wch: 6 }, { wch: 8 }, { wch: 22 }, { wch: 70 }]; // 컬럼 폭
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "당첨자");
  const buf: ArrayBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });

  const eventTitle = (ev?.title ?? "").replace(/[\\/:*?"<>|]/g, "").trim();
  const fname = eventTitle
    ? `당첨자_${eventTitle}_댓글.xlsx`
    : "당첨자_댓글.xlsx";

  return new Response(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="winners.xlsx"; filename*=UTF-8''${encodeURIComponent(fname)}`,
      "Cache-Control": "no-store",
    },
  });
}
