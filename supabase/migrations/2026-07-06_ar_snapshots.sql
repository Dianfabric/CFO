-- ============================================================
-- 미수금 현황 스냅샷 (ar_snapshots) — '1월 미수 현황.xlsx' 월 시트 흡수
-- 거래처별 전기이월·당월매출(공급가)·수금(VAT포함)·월말잔액(VAT포함).
-- 용도: ① 이월(기초) 미수 파악 ② 시스템 미수금과 장부 교차 검증.
-- ============================================================
CREATE TABLE IF NOT EXISTS ar_snapshots (
  id BIGSERIAL PRIMARY KEY,
  month_key TEXT NOT NULL,               -- YYYY-MM
  client_name TEXT NOT NULL,
  category TEXT,                          -- 소계 구분 (1.판매처 / 5.대리점 / 8.악질업체 ...)
  opening BIGINT NOT NULL DEFAULT 0,      -- 전기이월
  sales BIGINT NOT NULL DEFAULT 0,        -- 당월 매출(공급가)
  collected BIGINT NOT NULL DEFAULT 0,    -- 당월 수금(VAT 포함)
  balance BIGINT NOT NULL DEFAULT 0,      -- 월말 잔액(VAT 포함)
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (month_key, client_name)
);
CREATE INDEX IF NOT EXISTS idx_ar_snapshots_month ON ar_snapshots (month_key);

ALTER TABLE ar_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ar_snapshots_all_anon" ON ar_snapshots;
CREATE POLICY "ar_snapshots_all_anon" ON ar_snapshots
  FOR ALL USING (true) WITH CHECK (true);
