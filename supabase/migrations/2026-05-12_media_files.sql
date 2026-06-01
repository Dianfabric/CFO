-- ============================================================
-- media_files (V2.3) - Dian 자료 보관함
-- ============================================================
-- Google Drive 의 "디안 자료함" 폴더에 업로드된
-- 사진/영상/룩북/레퍼런스 등 비주얼 자산의 메타데이터 인덱싱.
-- Categories:
--   photo        (사진)
--   video        (영상)
--   lookbook     (룩북·카탈로그)
--   reference    (레퍼런스)
--   other        (기타)
-- ============================================================

-- 0. 클린업 (재실행 안전)
DROP TABLE IF EXISTS media_files CASCADE;
DROP TYPE IF EXISTS media_file_category CASCADE;

-- 1. enum
CREATE TYPE media_file_category AS ENUM (
  'photo',
  'video',
  'lookbook',
  'reference',
  'other'
);

-- 2. table
CREATE TABLE media_files (
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

  -- media-specific
  width_px  INT,
  height_px INT,
  duration_seconds NUMERIC(10, 2),

  -- classification
  category media_file_category NOT NULL DEFAULT 'other',
  tags     TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- links (clients.id 가 SERIAL/integer 라 BIGINT)
  client_id BIGINT,
  notes     TEXT,

  -- dates
  captured_date DATE,

  -- meta
  uploaded_by UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. indexes
CREATE INDEX idx_media_files_category ON media_files(category);
CREATE INDEX idx_media_files_client   ON media_files(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX idx_media_files_filename ON media_files USING gin (to_tsvector('simple', filename));
CREATE INDEX idx_media_files_tags     ON media_files USING gin (tags);
CREATE INDEX idx_media_files_created  ON media_files(created_at DESC);

-- 4. updated_at trigger
CREATE OR REPLACE FUNCTION update_media_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_media_files_updated_at
BEFORE UPDATE ON media_files
FOR EACH ROW
EXECUTE FUNCTION update_media_files_updated_at();

-- 5. FK to clients (clients 테이블이 있을 때만)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clients'
  ) THEN
    ALTER TABLE media_files
    ADD CONSTRAINT media_files_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
END$$;

-- 6. RLS (anon 허용 - V2.2 로그인 강제 해제 상태)
ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media_files_all_anon"
ON media_files
FOR ALL
USING (true)
WITH CHECK (true);
