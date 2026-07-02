-- ============================================================
-- 색동 신사업 — 매입(원가) + 비용(고정/변동) 관리
--
-- 매입: 색동원단 / 완제품(복주머니·티코스터 등). 간이과세자 매입처는
--       부가세 0 + 세금계산서 없음. 송금·계산서 수취 체크로 누락 방지.
-- 비용: 디안 관리회계 엑셀 분류 체계 준용 —
--       대분류 × 고정/변동 × 재량/비재량 × 비용성격(판관비/영업외).
--       고정비는 매월 반복(is_monthly) 한 번 등록, 일회성은 발생일 기준.
-- ============================================================

-- 매입 (매출원가 구성)
CREATE TABLE IF NOT EXISTS saekdong_purchases (
  id BIGSERIAL PRIMARY KEY,
  purchase_date DATE NOT NULL,
  kind TEXT NOT NULL DEFAULT 'fabric' CHECK (kind IN ('fabric', 'finished')), -- 색동원단 / 완제품
  item_name TEXT NOT NULL,                -- 품목명 (금빛단, 복주머니 ...)
  supplier TEXT,                          -- 매입처
  supplier_tax_type TEXT NOT NULL DEFAULT 'general'
    CHECK (supplier_tax_type IN ('general', 'simplified')), -- 일반 / 간이과세자
  qty NUMERIC NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0,  -- 단가
  amount INTEGER NOT NULL DEFAULT 0,      -- 공급가액 (간이과세자는 지급총액)
  vat INTEGER NOT NULL DEFAULT 0,         -- 부가세 (간이과세자 = 0)
  paid BOOLEAN NOT NULL DEFAULT false,            -- 송금 완료
  invoice_received BOOLEAN NOT NULL DEFAULT false, -- 매입 세금계산서 수취 (간이는 해당없음)
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saekdong_purchases_date ON saekdong_purchases (purchase_date DESC);

-- 비용 (고정비 / 변동비)
CREATE TABLE IF NOT EXISTS saekdong_expenses (
  id BIGSERIAL PRIMARY KEY,
  cost_type TEXT NOT NULL CHECK (cost_type IN ('fixed', 'variable')), -- 고정 / 변동
  category TEXT NOT NULL DEFAULT '기타', -- 대분류 (임대료/관리비, 인건비, 운영유지비 ...)
  item TEXT NOT NULL,                    -- 항목명 (예: 사무실 임대료, 물류 택배비)
  discretionary BOOLEAN NOT NULL DEFAULT true, -- true=재량 / false=비재량
  nature TEXT NOT NULL DEFAULT '판관비'
    CHECK (nature IN ('판관비', '매출원가', '영업외비용')), -- 비용성격
  amount INTEGER NOT NULL DEFAULT 0,
  is_monthly BOOLEAN NOT NULL DEFAULT false, -- true=매월 반복 (고정비 세팅)
  start_month TEXT,                          -- 반복 시작 YYYY-MM
  end_month TEXT,                            -- 반복 종료 YYYY-MM (null=계속)
  expense_date DATE,                         -- 일회성 발생일
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saekdong_expenses_date ON saekdong_expenses (expense_date DESC);

-- RLS — 현재 로그인 비활성(V2.2) 상태라 anon 허용
ALTER TABLE saekdong_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saekdong_purchases_all_anon" ON saekdong_purchases;
CREATE POLICY "saekdong_purchases_all_anon" ON saekdong_purchases
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE saekdong_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saekdong_expenses_all_anon" ON saekdong_expenses;
CREATE POLICY "saekdong_expenses_all_anon" ON saekdong_expenses
  FOR ALL USING (true) WITH CHECK (true);
