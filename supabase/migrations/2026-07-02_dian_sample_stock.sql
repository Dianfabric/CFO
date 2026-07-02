-- ============================================================
-- 디안 본체 스와치·샘플 재고 (V1 대략)
--
-- 입고(in)/발송(out) 기록 한 테이블 — 남은 재고 = Σ입고 − Σ발송.
-- 품목명은 자유 입력 (예: 스와치북 2026SS, 행거샘플 FROGNAL).
-- 추후 샘플 추적(#2c 반환/분실/전환)과 통합 예정.
-- ============================================================

CREATE TABLE IF NOT EXISTS dian_sample_moves (
  id BIGSERIAL PRIMARY KEY,
  move_date DATE NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')), -- 입고 / 발송
  item_name TEXT NOT NULL,      -- 스와치북·샘플북·행거샘플 등
  qty NUMERIC NOT NULL DEFAULT 1,
  counterparty TEXT,            -- 발송처 (디자이너·업체) / 입고처
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dian_sample_moves_date ON dian_sample_moves (move_date DESC);

ALTER TABLE dian_sample_moves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dian_sample_moves_all_anon" ON dian_sample_moves;
CREATE POLICY "dian_sample_moves_all_anon" ON dian_sample_moves
  FOR ALL USING (true) WITH CHECK (true);
