-- ============================================================
-- V2.2 — cycles 테이블도 anon 사용자 수정 허용
-- ============================================================
-- 기존: cycles_modify FOR ALL USING (CEO/임원만)
-- 변경: anon 도 수정 가능 (V2.2 로그인 비활성 상태)
-- ============================================================

DROP POLICY IF EXISTS "cycles_modify" ON cycles;

CREATE POLICY "cycles_all_anon"
ON cycles
FOR ALL
USING (true)
WITH CHECK (true);
