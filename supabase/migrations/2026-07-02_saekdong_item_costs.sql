-- ============================================================
-- 색동 품목 기준단가 — 매입(지출)으로 잡지 않는 제품별 원가
--
-- 용도: 제품별 이익 계산에만 사용. 계기판 매출원가(기간 매입액)에는
-- 반영되지 않음. 실제 매입 기록이 있는 품목은 매입 평균단가가 우선.
-- ============================================================

CREATE TABLE IF NOT EXISTS saekdong_item_costs (
  item_name TEXT PRIMARY KEY,   -- 품목명 (쇼핑몰 상품명과 매칭)
  unit_cost INTEGER NOT NULL,   -- 개당 원가
  memo TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE saekdong_item_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saekdong_item_costs_all_anon" ON saekdong_item_costs;
CREATE POLICY "saekdong_item_costs_all_anon" ON saekdong_item_costs
  FOR ALL USING (true) WITH CHECK (true);
