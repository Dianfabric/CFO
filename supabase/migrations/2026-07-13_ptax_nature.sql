-- 매입 세금계산서 성격 분류 (대표 지시 2026-07-13)
-- nature: cogs(매출원가) | variable(변동비) | fixed(고정비) | other(기타 — 손익 미반영)
-- cost_category: 변동/고정일 때 관리회계 대분류 (임대료/관리비, 인건비, 마케팅·광고 등)
-- 분류된 금액(공급가)은 발행일 기준으로 본체 손익에 반영, other 는 제외.

alter table purchase_tax_invoices add column if not exists nature text;
alter table purchase_tax_invoices add column if not exists cost_category text;

create index if not exists ptax_nature_idx on purchase_tax_invoices (nature, issue_date);
