-- ============================================================
-- 색동 아임웹 API 공유 캐시
--
-- Vercel 서버리스는 요청마다 별도 인스턴스라 메모리 캐시·호출 간격
-- 제어가 공유되지 않음 → 아임웹 5건/초 제한 초과(TOO MANY REQUEST).
-- 해결: 조회 결과를 이 테이블에 캐싱 (TTL) + refreshing_since 락으로
-- 동시 갱신 방지. 갱신 실패 시 이전 성공값 반환(항상 화면 표시).
-- ============================================================

CREATE TABLE IF NOT EXISTS saekdong_api_cache (
  key TEXT PRIMARY KEY,             -- sales / notices / paycheck
  payload JSONB,                    -- 마지막 성공 응답
  fetched_at TIMESTAMPTZ,           -- 마지막 성공 시각
  refreshing_since TIMESTAMPTZ      -- 갱신 중 락 (3분 지나면 죽은 락으로 간주)
);

ALTER TABLE saekdong_api_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saekdong_api_cache_all_anon" ON saekdong_api_cache;
CREATE POLICY "saekdong_api_cache_all_anon" ON saekdong_api_cache
  FOR ALL USING (true) WITH CHECK (true);
