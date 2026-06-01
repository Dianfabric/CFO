-- ============================================================
-- document_files (V2.3) - Dian 서류 보관함
-- ============================================================
-- Google Drive에 업로드된 서류의 메타데이터를 Supabase로 인덱싱.
-- Categories:
--   contract       (계약서)
--   business_reg   (사업자등록증)
--   flameproof     (방염서류)
--   test_report    (시험성적서)
--   certification  (인증서)
--   tax_invoice    (세금계산서)
--   other          (기타)
-- ============================================================

-- 0. 클린업 (재실행 안전)
DROP TABLE IF EXISTS document_files CASCADE;
DROP TYPE IF EXISTS document_file_category CASCADE;

-- 1. enum
CREATE TYPE document_file_category AS ENUM (
  'contract',
  'business_reg',
  'flameproof',
  'test_report',
  'certification',
  'tax_invoice',
  'other'
);

-- 2. table
CREATE TABLE document_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Google Drive refs
  drive_file_id       TEXT NOT NULL UNIQUE,
  drive_folder_id     TEXT,
  drive_view_url      TEXT,
  drive_download_url  TEXT,
  drive_thumbnail_url TEXT,

  -- file info
  filename   TEXT NOT NULL,
  mime_type  TEXT,
  size_bytes BIGINT,

  -- classification
  category document_file_category NOT NULL DEFAULT 'other',
  tags     TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- links (clients.id 가 SERIAL/integer 라 BIGINT 로 맞춤. FK는 별도 추가)
  client_id BIGINT,
  notes     TEXT,

  -- dates
  issued_date  DATE,
  expires_date DATE,

  -- meta
  uploaded_by UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. indexes
CREATE INDEX idx_document_files_category ON document_files(category);
CREATE INDEX idx_document_files_client   ON document_files(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX idx_document_files_filename ON document_files USING gin (to_tsvector('simple', filename));
CREATE INDEX idx_document_files_tags     ON document_files USING gin (tags);
CREATE INDEX idx_document_files_created  ON document_files(created_at DESC);

-- 4. updated_at trigger
CREATE OR REPLACE FUNCTION update_document_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_document_files_updated_at
BEFORE UPDATE ON document_files
FOR EACH ROW
EXECUTE FUNCTION update_document_files_updated_at();

-- 5. FK to clients (clients 테이블이 있을 때만)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clients'
  ) THEN
    ALTER TABLE document_files
    ADD CONSTRAINT document_files_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
END$$;

-- 6. RLS (anon 허용 - V2.2 로그인 강제 해제 상태)
ALTER TABLE document_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_files_all_anon"
ON document_files
FOR ALL
USING (true)
WITH CHECK (true);
