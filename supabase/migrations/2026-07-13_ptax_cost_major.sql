-- 매입 계산서 분류를 관리회계 2단 구조(대분류 major → 항목 category)로 확장 (대표 지시 2026-07-13)
-- cost_major   : 관리회계 대분류 (임대료/관리비, 운영유지비, 마케팅·광고 등) — 손익 분해 병합 기준
-- cost_category: 관리회계 항목 (임대료, SW구독료, 광고 등) — 상세 표시용

alter table purchase_tax_invoices add column if not exists cost_major text;
alter table ptax_supplier_rules   add column if not exists cost_major text;

-- 기존 분류 이관: cost_category 에 대분류가 들어있던 행 → cost_major 로 이동
update purchase_tax_invoices
  set cost_major = cost_category, cost_category = null
  where cost_major is null and cost_category in (
    '임대료/관리비','외주용역','운영유지비','차량·운송비','인건비','통신·전기',
    '접대·회의','교통·원재료','교육·복리','마케팅·광고','기타'
  );
update ptax_supplier_rules
  set cost_major = cost_category, cost_category = null
  where cost_major is null and cost_category in (
    '임대료/관리비','외주용역','운영유지비','차량·운송비','인건비','통신·전기',
    '접대·회의','교통·원재료','교육·복리','마케팅·광고','기타'
  );
