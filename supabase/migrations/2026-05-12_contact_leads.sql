-- ============================================================
-- contact_leads (V2.5) - 잠재 거래처 / 문의 컨택 풀
-- ============================================================
-- 모르는 거래처에서 가격·제품 문의가 들어왔을 때
-- 추후 영업·관리 활용을 위해 기록하는 lead 풀.
--
-- 입력 항목:
--   이름, 직책, 전화번호, 이메일, 회사명, 주소,
--   직군 (다중), 관심 제품 (다중), 문의 경로, 메모
--
-- Google Sheets 동기화 옵션 + 정식 거래처(clients) 로 promote 가능.
-- ============================================================

-- 0. 클린업
DROP TABLE IF EXISTS contact_leads CASCADE;
DROP TYPE IF EXISTS lead_status CASCADE;

-- 1. enum
CREATE TYPE lead_status AS ENUM (
  'new',           -- 신규 문의
  'contacted',     -- 후속 연락 완료
  'qualified',     -- 가능성 있는 lead
  'converted',     -- 정식 거래처 전환
  'lost',          -- 무산
  'archived'       -- 아카이브
);

-- 2. table
CREATE TABLE contact_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 기본 인적 정보
  name        TEXT NOT NULL,
  position    TEXT,                -- 직책
  phone       TEXT,
  email       TEXT,
  company_name TEXT,
  address     TEXT,

  -- 분류 (다중 선택)
  occupations       TEXT[] DEFAULT ARRAY[]::TEXT[],  -- 직군 코드 (interior_designer, brand_furniture 등)
  product_interests TEXT[] DEFAULT ARRAY[]::TEXT[],  -- 관심 제품 코드 (sofa, curtain, bed 등)

  -- 문의 정보
  inquiry_source TEXT,             -- 문의 경로 (phone/email/kakao/visit/instagram/recommendation/other)
  inquiry_summary TEXT,             -- 문의 요지 (한 줄 요약)
  notes       TEXT,                 -- 자유 메모

  -- 상태 + lifecycle
  status      lead_status NOT NULL DEFAULT 'new',
  next_action TEXT,                 -- 다음 액션 (예: "다음 주 견적 보내기")
  next_action_date DATE,

  -- 정식 거래처 전환 시
  converted_client_id BIGINT,       -- clients.id (FK 별도)
  converted_at TIMESTAMPTZ,

  -- Google Sheets 동기화
  sheet_synced_at TIMESTAMPTZ,
  sheet_row_index INT,              -- 시트에서의 row 번호 (1-indexed)

  -- meta
  created_by UUID,                  -- 등록자 (profiles/employees 와 추후 연결)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. indexes
CREATE INDEX idx_contact_leads_status    ON contact_leads(status);
CREATE INDEX idx_contact_leads_created   ON contact_leads(created_at DESC);
CREATE INDEX idx_contact_leads_phone     ON contact_leads(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_contact_leads_email     ON contact_leads(email) WHERE email IS NOT NULL;
CREATE INDEX idx_contact_leads_company   ON contact_leads(company_name) WHERE company_name IS NOT NULL;
CREATE INDEX idx_contact_leads_occu      ON contact_leads USING gin (occupations);
CREATE INDEX idx_contact_leads_products  ON contact_leads USING gin (product_interests);
CREATE INDEX idx_contact_leads_next_act  ON contact_leads(next_action_date) WHERE next_action_date IS NOT NULL;

-- 4. updated_at trigger
CREATE OR REPLACE FUNCTION update_contact_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contact_leads_updated_at
BEFORE UPDATE ON contact_leads
FOR EACH ROW
EXECUTE FUNCTION update_contact_leads_updated_at();

-- 5. converted_at 자동 갱신 (status -> converted 시)
CREATE OR REPLACE FUNCTION set_contact_leads_converted_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'converted' AND (OLD.status IS NULL OR OLD.status <> 'converted') THEN
    NEW.converted_at = NOW();
  ELSIF NEW.status <> 'converted' THEN
    NEW.converted_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contact_leads_converted_at
BEFORE UPDATE ON contact_leads
FOR EACH ROW
EXECUTE FUNCTION set_contact_leads_converted_at();

-- 6. FK to clients (있을 때만)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clients'
  ) THEN
    ALTER TABLE contact_leads
    ADD CONSTRAINT contact_leads_client_fkey
    FOREIGN KEY (converted_client_id) REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
END$$;

-- 7. RLS (anon 허용)
ALTER TABLE contact_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_leads_all_anon"
ON contact_leads
FOR ALL
USING (true)
WITH CHECK (true);
