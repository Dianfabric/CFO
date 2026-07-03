-- ============================================================
-- 간이영수증 대장 — 사진 업로드 + 항목·비용성격 분류
--
-- 종합소득세·법인세 신고용 분기별 관리, 엑셀(날짜/상호/적요/금액)
-- 다운로드. 사진 원본은 Storage 'receipts' 버킷(비공개)에 보관.
-- ============================================================

CREATE TABLE IF NOT EXISTS simple_receipts (
  id BIGSERIAL PRIMARY KEY,
  receipt_date DATE NOT NULL,
  vendor TEXT NOT NULL,           -- 상호 (예: ㈜일신항공해운)
  item TEXT NOT NULL,             -- 적요/항목 (예: 운송료)
  amount INTEGER NOT NULL,        -- 공급대가 총액
  cost_type TEXT NOT NULL DEFAULT 'variable'
    CHECK (cost_type IN ('variable', 'fixed')), -- 변동비(기본)/고정비
  memo TEXT,
  image_path TEXT,                -- Storage receipts 버킷 경로
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_simple_receipts_date ON simple_receipts (receipt_date DESC);

ALTER TABLE simple_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "simple_receipts_all_anon" ON simple_receipts;
CREATE POLICY "simple_receipts_all_anon" ON simple_receipts
  FOR ALL USING (true) WITH CHECK (true);
