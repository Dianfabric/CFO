-- ============================================================
-- 대출 원금·이자 상환 원장 — '대출원금,이자상환내역_YYYY.xlsx' 흡수
--
-- 이자 = 영업외비용 (세전이익 정확도), 종합소득세·법인세 신고 자료.
-- OCR 추정치(판독불가·확인필요)는 needs_review 로 표시해 계속 노출.
-- entity: dian(개인사업자) / naid(법인 — 추후 동일 방식).
-- ============================================================

CREATE TABLE IF NOT EXISTS loan_payments (
  id BIGSERIAL PRIMARY KEY,
  entity TEXT NOT NULL DEFAULT 'dian' CHECK (entity IN ('dian', 'naid')),
  lender TEXT NOT NULL,           -- 기업은행 / OK저축은행 / 농협 ...
  pay_date DATE NOT NULL,         -- 월 단위 자료는 해당 월 1일
  month_key TEXT NOT NULL,        -- YYYY-MM
  principal INTEGER NOT NULL DEFAULT 0,  -- 상환원금
  interest INTEGER NOT NULL DEFAULT 0,   -- 상환이자
  rate TEXT,                      -- 적용이율 (있는 경우)
  memo TEXT,                      -- 비고
  needs_review BOOLEAN NOT NULL DEFAULT false, -- OCR 추정·판독불가 등
  dedup_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loan_payments_month ON loan_payments (month_key);

ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loan_payments_all_anon" ON loan_payments;
CREATE POLICY "loan_payments_all_anon" ON loan_payments
  FOR ALL USING (true) WITH CHECK (true);
