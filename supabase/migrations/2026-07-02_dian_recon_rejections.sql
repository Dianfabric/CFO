-- ============================================================
-- 대사 센터 — 퍼지 매칭 제안 거절 기억
--
-- 사용자가 '아님' 처리한 (거래 ↔ 계산서/입금) 조합은 다시 제안하지
-- 않는다. id = "kind:leftId:rightId" (예: tax:cku...:ckv...)
-- ============================================================

CREATE TABLE IF NOT EXISTS dian_recon_rejections (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE dian_recon_rejections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dian_recon_rejections_all_anon" ON dian_recon_rejections;
CREATE POLICY "dian_recon_rejections_all_anon" ON dian_recon_rejections
  FOR ALL USING (true) WITH CHECK (true);
