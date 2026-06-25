"use server";

import { getSupabaseAdmin } from "@/lib/event-picker/supabase";
import { normalizeUsername } from "@/lib/event-picker/instagram";

export interface ClaimState {
  ok: boolean;
  error?: string;
  done?: boolean;
}

export async function submitClaim(
  _prev: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const eventId = String(formData.get("eventId") ?? "");
  const rawUsername = String(formData.get("username") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const addressDetail = String(formData.get("addressDetail") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const agreed = formData.get("agreed") === "on";

  const username = normalizeUsername(rawUsername);
  if (!username) return { ok: false, error: "인스타 아이디를 확인해주세요." };
  if (!name || !address || !phone)
    return { ok: false, error: "이름·주소·전화번호는 필수입니다." };
  if (!agreed)
    return { ok: false, error: "개인정보 수집·이용에 동의해야 제출할 수 있습니다." };

  const sb = getSupabaseAdmin();

  // 이벤트 + 당첨자 명단 대조
  const { data: ev } = await sb
    .from("events")
    .select("title")
    .eq("id", eventId)
    .single<{ title: string }>();
  if (!ev) return { ok: false, error: "이벤트를 찾을 수 없습니다." };

  const { data: win } = await sb
    .from("winners")
    .select("username")
    .eq("event_id", eventId)
    .eq("username", username)
    .eq("is_backup", false) // 본선 당첨자만 제출 가능 (보결은 승급 후)
    .maybeSingle();
  if (!win)
    return {
      ok: false,
      error: "당첨자 명단에 없는 아이디입니다. 발표 게시물의 아이디를 확인해주세요.",
    };

  // 저장 (아이디당 1회 — unique 제약)
  const { error } = await sb.from("claims").insert({
    event_id: eventId,
    username,
    name,
    postal_code: null,
    address,
    address_detail: addressDetail || null,
    phone,
    agreed: true,
  });
  if (error) {
    if (error.code === "23505")
      return { ok: false, error: "이미 정보가 제출되었습니다. 감사합니다!" };
    return { ok: false, error: `저장 실패: ${error.message}` };
  }

  return { ok: true, done: true };
}
