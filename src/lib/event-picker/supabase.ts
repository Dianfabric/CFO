import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 댓글 이벤트 피커 전용 Supabase (picker 프로젝트 — CFO Supabase와 분리).
// 서버 전용(서비스 롤). env: EVENT_PICKER_SUPABASE_URL / EVENT_PICKER_SUPABASE_SERVICE_KEY
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.EVENT_PICKER_SUPABASE_URL;
  const key = process.env.EVENT_PICKER_SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error(
      "Event Picker Supabase 미설정: EVENT_PICKER_SUPABASE_URL / EVENT_PICKER_SUPABASE_SERVICE_KEY 를 .env.local 에 넣으세요.",
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
