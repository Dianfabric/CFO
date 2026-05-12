-- ============================================================
-- 서류 보관함 (document_files) — V2.3
-- ============================================================
-- 디안 Google Drive 의 "디안 서류함" 폴더에 업로드된 파일들의 메타데이터.
-- Drive 가 원본을 보관하고, Supabase 가 검색·필터·인덱스를 담당.
--
-- 카테고리 (Korean enum-like text):
--   - contract      계약서
--   - business_reg  사업자등록증
--   - flameproof    방염서류
--   - test_report   시험성적서
--   - certification 인증서
--   - tax_invoice   세금계산서
--   - other         기타
-- ============================================================

-- 카테고리 enum
CREATE TYPE document_file_category AS ENUM (
  'contract',
  'business_reg',
  'flameproof',
  'test_report',
  'certification',
  'tax_invoice',
  'other'
);

-- 메인 테이블
CREATE TABLE document_files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Google Drive
  drive_file_id    TEXT NOT NULL UNIQUE,        -- Drive 파일 ID (검색·미리보기 키)
  drive_folder_id  TEXT,                        -- 부모 폴더 ID (카테고리별 sub-folder)
  drive_view_url   TEXT,                        -- webViewLink (Drive 뷰어)
  drive_download_url TEXT,                      -- webContentLink (직접 다운로드)
  drive_thumbnail_url TEXT,                     -- thumbnailLink (썸네일)

  -- 파일 정보
  filename      TEXT NOT NULL,                  -- 표시용 파일명
  mime_type     TEXT,                           -- application/pdf, image/png, ...
  size_bytes    BIGINT,

  -- 분류
  category      document_file_category NOT NULL DEFAULT 'other',
  tags          TEXT[] DEFAULT ARRAY[]::TEXT[], -- 자유 태그 ([@거래처명, @프로젝트명, ...])

  -- 연결
  client_id     UUID REFERENCES clients(id) ON DELETE SET NULL,  -- 거래처 연결 (옵션)
  notes         TEXT,                           -- 메모

  -- 발급 정보 (옵션 — 계약서/인증서 등)
  issued_date   DATE,                           -- 발급일
  expires_date  DATE,                           -- 만료일 (인증서 등)

  -- 메타
  uploaded_by   UUID,                           -- 업로드한 사용자 (anon 허용)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_document_files_category    ON document_files(category);
CREATE INDEX idx_document_files_client      ON document_files(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX idx_document_files_filename    ON document_files USING gin (to_tsvector('simple', filename));
CREATE INDEX idx_document_files_tags        ON document_files USING gin (tags);
CREATE INDEX idx_document_files_created     ON document_files(created_at DESC);

-- updated_at 자동 갱신 트리거
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

-- RLS (Row Level Security) — 개발 중 모두 허용 (V2.2 로그인 강제 해제 상태)
ALTER TABLE document_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_files_all_anon"
ON document_files FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================================
-- 카테고리 라벨 (Korean) — 클라이언트에서 사용
-- ============================================================
-- contract       → 계약서
-- business_reg   → 사업자등록증
-- flameproof     → 방염서류
-- test_report    → 시험성적서
-- certification  → 인증서
-- tax_invoice    → 세금계산서
-- other          → 기타
-- ============================================================
