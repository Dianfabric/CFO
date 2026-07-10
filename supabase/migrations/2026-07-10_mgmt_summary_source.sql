-- ============================================================
-- mgmt_ledger source 에 'summary' 추가 — '관리회계' 명세 시트(정본) 흡수용
-- (고정비 명세 + 변동비 입력칸 → source='summary' 행으로 저장,
--  nature: 판관비 / 영업외비용(대출이자) / 법인(엔에이아이디 몫) / 원금상환 / 운임)
-- ============================================================
ALTER TABLE mgmt_ledger DROP CONSTRAINT IF EXISTS mgmt_ledger_source_check;
ALTER TABLE mgmt_ledger ADD CONSTRAINT mgmt_ledger_source_check
  CHECK (source IN ('card', 'bank', 'personal', 'summary'));
