-- ============================================================
-- 법인(엔에이아이디) 세금계산서 (naid_invoices)
-- 법인 매출·매입의 정본 (대표 결정 2026-07-10: 이것 이외 매입·매출 없음).
-- 세금계산서 업로드 시 사업자번호 835-81-02363 감지 → 자동으로 여기에 저장.
-- ============================================================
CREATE TABLE IF NOT EXISTS naid_invoices (
  approval_no TEXT PRIMARY KEY,          -- 승인번호 (재업로드 dedup)
  direction TEXT NOT NULL CHECK (direction IN ('sale', 'purchase')),
  issue_date DATE NOT NULL,              -- 작성일자
  month_key TEXT NOT NULL,               -- YYYY-MM
  counterparty TEXT,                     -- 거래 상대 상호
  supply_amount BIGINT NOT NULL DEFAULT 0,
  tax_amount BIGINT NOT NULL DEFAULT 0,
  item TEXT,                             -- 품목명
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_naid_invoices_month ON naid_invoices (month_key, direction);

ALTER TABLE naid_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "naid_invoices_all_anon" ON naid_invoices;
CREATE POLICY "naid_invoices_all_anon" ON naid_invoices
  FOR ALL USING (true) WITH CHECK (true);
