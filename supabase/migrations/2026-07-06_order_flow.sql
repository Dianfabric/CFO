-- ============================================================
-- 주문 진행 흐름 (order_flow) — 거래 관리 '주문 진행 상황판'
--
-- 일계표 매출(발주) 거래별 물류 진행 단계 추적.
--   국내(재고):  주문접수 → 창고출고요청 → 한국출고 → 고객입고
--   해외(발주):  주문접수 → 해외발주 → 현지출고 → 한국입고 → 한국출고 → 고객입고
-- stage 는 route 별 단계 배열의 인덱스. history 에 단계 변경 이력 누적.
-- tx_id = v1.0 Prisma transactions.id (레이어 전략 — v1.0 스키마 무변경).
-- ============================================================

CREATE TABLE IF NOT EXISTS order_flow (
  tx_id TEXT PRIMARY KEY,
  route TEXT NOT NULL DEFAULT 'domestic' CHECK (route IN ('domestic', 'overseas')),
  stage INTEGER NOT NULL DEFAULT 0,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  memo TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE order_flow ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_flow_all_anon" ON order_flow;
CREATE POLICY "order_flow_all_anon" ON order_flow
  FOR ALL USING (true) WITH CHECK (true);
