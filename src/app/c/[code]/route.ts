import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/event-picker/supabase";

export const dynamic = "force-dynamic";

/**
 * 짧은 코드 라우트 — DM·링크 공유 시 URL 을 짧게 유지.
 *
 *   /c/75612976  →  /claim/75612976-09c0-480e-80f9-9e8b257fc43c
 *
 * code = 이벤트 UUID 앞 8자(prefix). events 테이블에서 prefix 매칭 후
 * 전체 claim 페이지로 redirect. 클릭 한 번으로 동일하게 작동.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const clean = (code ?? "").trim().toLowerCase();

  // hex prefix 형태만 허용 (SQL/와일드카드 인젝션 차단)
  if (!/^[0-9a-f]{4,36}$/.test(clean)) {
    return NextResponse.redirect(new URL(`/claim/invalid`, req.url));
  }

  let fullId = clean;
  try {
    const sb = getSupabaseAdmin();
    // id 가 UUID 타입이라 ilike(LIKE) 불가 → 전체 id 가져와 JS prefix 매칭.
    // events 는 소량(수십 개)이라 부담 없음.
    const { data } = await sb.from("events").select("id");
    const match = (data ?? []).find((e) =>
      String((e as { id: string }).id).toLowerCase().startsWith(clean),
    );
    if (match) fullId = (match as { id: string }).id;
  } catch {
    // 조회 실패 시에도 입력 코드로 claim 페이지에 위임 (그쪽에서 "유효하지 않은 이벤트" 안내)
  }

  return NextResponse.redirect(new URL(`/claim/${fullId}`, req.url));
}
