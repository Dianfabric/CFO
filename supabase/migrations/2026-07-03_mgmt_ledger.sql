-- ============================================================
-- 관리회계 원장 — '디안 관리 회계' 엑셀 흡수 (카드/통장/개인사용)
--
-- 분류: 카테고리 × 대분류 × 고정/변동 × 재량/비재량 × 비용성격.
-- 월별(~06) / 주별(07~) 업로드, dedup_key 로 중복 방지 (재업로드 안전).
-- 비용 인텔리전스(재량 절감·구독료 트래커)의 데이터 소스.
-- ============================================================

CREATE TABLE IF NOT EXISTS mgmt_ledger (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('card', 'bank', 'personal')),
  entry_date DATE NOT NULL,
  month_key TEXT NOT NULL,        -- YYYY-MM
  vendor TEXT NOT NULL,           -- 가맹점명 / 거래내용
  amount INTEGER NOT NULL,
  flow TEXT NOT NULL DEFAULT 'out' CHECK (flow IN ('in', 'out')),
  category TEXT,                  -- 소분류 (운임, SW구독(월간), AI구독 ...)
  major TEXT,                     -- 대분류 (차량·운송비, 운영유지비 ...)
  cost_type TEXT,                 -- 고정 | 변동
  discretionary TEXT,             -- 재량 | 비재량
  nature TEXT,                    -- 판관비 | 영업외비용 | 매출원가 등
  card_name TEXT,                 -- 카드명 (카드 소스)
  memo TEXT,
  dedup_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mgmt_ledger_month ON mgmt_ledger (month_key);
CREATE INDEX IF NOT EXISTS idx_mgmt_ledger_cat ON mgmt_ledger (category);

ALTER TABLE mgmt_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mgmt_ledger_all_anon" ON mgmt_ledger;
CREATE POLICY "mgmt_ledger_all_anon" ON mgmt_ledger
  FOR ALL USING (true) WITH CHECK (true);
