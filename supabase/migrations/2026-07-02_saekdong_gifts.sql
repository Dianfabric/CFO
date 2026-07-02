-- ============================================================
-- 색동 선물(무료 증정) 기록 — 재고 차감용
--
-- 재고 현황: 남은 재고 = 입고(매입 수량) − 판매(온라인+오프라인) − 선물.
-- 판매율 = 판매/입고, 무료선물율 = 선물/입고.
-- ============================================================

CREATE TABLE IF NOT EXISTS saekdong_gifts (
  id BIGSERIAL PRIMARY KEY,
  gift_date DATE NOT NULL,
  item_name TEXT NOT NULL,
  qty NUMERIC NOT NULL DEFAULT 1,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saekdong_gifts_date ON saekdong_gifts (gift_date DESC);

ALTER TABLE saekdong_gifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saekdong_gifts_all_anon" ON saekdong_gifts;
CREATE POLICY "saekdong_gifts_all_anon" ON saekdong_gifts
  FOR ALL USING (true) WITH CHECK (true);
