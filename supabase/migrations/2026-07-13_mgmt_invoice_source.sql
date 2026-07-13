-- ============================================================
-- mgmt_ledger source 에 'invoice' 추가 (대표 지시 2026-07-13)
-- 관리회계 파일의 '세금계산서 분류' 시트에서 비용성격='매출원가' 행을 흡수.
--   대상: 가공비(방염·염색·임가공 등) + TMS 단가표에 없는 원단의 원가
--   제외: 세관·매입(해외) 행 — 관세·수입세금 인보이스로 이미 반영 (이중계상 방지)
-- 손익 반영은 2026-07-01 이후 발행분부터 (1~6월 확정 손익 동결).
-- ============================================================
ALTER TABLE mgmt_ledger DROP CONSTRAINT IF EXISTS mgmt_ledger_source_check;
ALTER TABLE mgmt_ledger ADD CONSTRAINT mgmt_ledger_source_check
  CHECK (source IN ('card', 'bank', 'personal', 'summary', 'invoice'));
