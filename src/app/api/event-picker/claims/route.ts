import * as XLSX from "xlsx";
import { getSupabaseAdmin } from "@/lib/event-picker/supabase";

// 당첨자 배송정보 → 로젠택배 대량발송 엑셀(.xlsx). 운영자 전용(proxy 보호).
// ?event= ?q= 필터, ?item= 품목명 지정. 양식: 제목있음·단일주소(11열).

export const runtime = "nodejs";

const DEFAULT_MSG = "친절 배송 부탁드립니다";

interface ClaimRow {
  id: number;
  submitted_at: string;
  username: string;
  name: string;
  postal_code: string | null;
  address: string;
  address_detail: string | null;
  phone: string;
  events: { title: string } | null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const event = url.searchParams.get("event") ?? "";
  const q = (url.searchParams.get("q") ?? "").toLowerCase();
  const item = url.searchParams.get("item") ?? ""; // 품목명 (그때그때 입력)
  const ids = (url.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean); // 선택 항목만 (오늘 보낼 사람 등)

  const sb = getSupabaseAdmin();
  let query = sb
    .from("claims")
    .select("*, events(title)")
    .order("submitted_at", { ascending: true });
  if (event) query = query.eq("event_id", event);
  const { data } = await query.returns<ClaimRow[]>();

  let rows = data ?? [];
  if (q) {
    rows = rows.filter((r) =>
      [r.username, r.name, r.phone, r.address, r.events?.title].some((v) =>
        String(v ?? "").toLowerCase().includes(q),
      ),
    );
  }
  if (ids.length) {
    const set = new Set(ids);
    rows = rows.filter((r) => set.has(String(r.id)));
  }

  // 로젠 양식 헤더 (제목있음·단일주소) — B열, J열은 빈칸 유지
  const header = [
    "수하인명",
    "",
    "수하인주소",
    "수하인전화번호",
    "수하인핸드폰번호",
    "택배수량",
    "택배운임",
    "운임구분",
    "품목명",
    "",
    "배송메세지",
  ];
  const body = rows.map((r) => {
    const addr = `${r.address}${r.address_detail ? " " + r.address_detail : ""}`.trim();
    return [
      r.name, // A 수하인명
      "", // B (빈칸)
      addr, // C 수하인주소
      "", // D 수하인전화번호 (미사용 — 빈칸)
      r.phone, // E 수하인핸드폰번호
      1, // F 택배수량 (모두 1)
      "", // G 택배운임 (빈칸)
      "030", // H 운임구분 (고정)
      item, // I 품목명 (export 시 지정)
      "", // J (빈칸)
      DEFAULT_MSG, // K 배송메세지
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  // 핸드폰번호·운임구분 등은 문자열로 들어가 leading zero 보존됨
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "발송");
  const buf: ArrayBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });

  const fname = "로젠_배송정보.xlsx";
  return new Response(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rozen-claims.xlsx"; filename*=UTF-8''${encodeURIComponent(fname)}`,
      "Cache-Control": "no-store",
    },
  });
}
