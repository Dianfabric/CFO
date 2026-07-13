-- 매입 세금계산서 거래처 자동 분류 규칙 (대표 지시 2026-07-13)
-- 한 번 분류하면 같은 거래처(정규화 이름)의 이후 계산서는 자동으로 같은 성격 분류.
--   mode='auto'   : 자동 분류 적용
--   mode='manual' : 혼합 거래처 — 같은 거래처를 이전과 다른 성격으로 분류하는 순간 자동 전환.
--                   이후 매번 물어봄 (규칙 목록에서 다시 auto 로 되돌리기 가능)
-- purchase_tax_invoices.classified_by: 'user'(수동) | 'rule'(규칙 자동) — 내역 화면 배지용

create table if not exists ptax_supplier_rules (
  supplier_key  text primary key,                 -- normBizName(공급자명)
  supplier_name text not null,                    -- 표시용 원본 이름 (최근 분류 기준)
  nature        text not null,                    -- cogs | variable | fixed | other
  cost_category text,                             -- 변동/고정일 때 관리회계 대분류
  mode          text not null default 'auto',     -- auto | manual(혼합)
  hit_count     integer not null default 0,       -- 자동 분류 누적 건수
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table purchase_tax_invoices add column if not exists classified_by text;
