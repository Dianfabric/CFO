-- ============================================================
-- 색동 오프라인 매출 — 입금/발행 수동 완료 처리 (override)
--
-- 자동 대사(통장/세금계산서 업로드 매칭)가 서류를 못 찾은 경우
-- 화면에서 수동으로 완료 처리. v1.0 Transaction 데이터는 건드리지
-- 않는 표시용 레이어 (되돌리기 = 행 삭제 → 자동 판정으로 복귀).
-- ============================================================

CREATE TABLE IF NOT EXISTS saekdong_offline_overrides (
  tx_id TEXT PRIMARY KEY,               -- v1.0 Transaction.id (cuid)
  paid_override BOOLEAN NOT NULL DEFAULT false,    -- 수동 입금 완료
  issued_override BOOLEAN NOT NULL DEFAULT false,  -- 수동 발행 완료
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE saekdong_offline_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saekdong_offline_overrides_all_anon" ON saekdong_offline_overrides;
CREATE POLICY "saekdong_offline_overrides_all_anon" ON saekdong_offline_overrides
  FOR ALL USING (true) WITH CHECK (true);
