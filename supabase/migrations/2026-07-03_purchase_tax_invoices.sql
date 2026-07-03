-- ============================================================
-- 매입 전자세금계산서 목록 (홈택스 매입 목록조회 업로드)
--
-- 일계표 매입 거래와 대사해 '수취 못 한 계산서' 파악 +
-- 분기별 매입세액 집계(부가세 신고 대비).
-- ============================================================

CREATE TABLE IF NOT EXISTS purchase_tax_invoices (
  approval_number TEXT PRIMARY KEY,   -- 승인번호
  issue_date DATE NOT NULL,
  supplier_name_raw TEXT NOT NULL,    -- 공급자 상호 (원문)
  supplier_biz_no TEXT,               -- 공급자 사업자등록번호
  supply_amount INTEGER NOT NULL DEFAULT 0,  -- 공급가액
  tax_amount INTEGER NOT NULL DEFAULT 0,     -- 세액
  total_amount INTEGER NOT NULL DEFAULT 0,   -- 합계
  item_name TEXT,
  matched_tx_id TEXT,                 -- 일계표 매입 거래(Prisma Transaction.id)
  status TEXT NOT NULL DEFAULT 'UNMATCHED', -- MATCHED | UNMATCHED
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchase_tax_invoices_date ON purchase_tax_invoices (issue_date DESC);

ALTER TABLE purchase_tax_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchase_tax_invoices_all_anon" ON purchase_tax_invoices;
CREATE POLICY "purchase_tax_invoices_all_anon" ON purchase_tax_invoices
  FOR ALL USING (true) WITH CHECK (true);
