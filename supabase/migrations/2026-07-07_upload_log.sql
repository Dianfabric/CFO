-- ============================================================
-- 업로드 기록 (upload_log) — 업로드 당번판의 완료 판정 소스
-- 공문/자료 업로드 섹션에서 파일 처리 성공 시 종류(kind)와 파일명 기록.
-- ============================================================
CREATE TABLE IF NOT EXISTS upload_log (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL,        -- 일계표 | 미수금현황 | 통장 | 세금계산서 | 마감 | 운임관세 | 관리회계 | 간이영수증 | 대출이자 | 기타
  file_name TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_upload_log_kind_at ON upload_log (kind, uploaded_at DESC);

ALTER TABLE upload_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "upload_log_all_anon" ON upload_log;
CREATE POLICY "upload_log_all_anon" ON upload_log
  FOR ALL USING (true) WITH CHECK (true);
