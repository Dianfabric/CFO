-- 매출원가 수기 원가 (TMS 단가표로 안 잡히는 품목) — 2026-07-13
-- 표준 원가(구글시트 2025 TMS H열)로 매칭 안 되는 품목에 수기 원가를 부여.
--   scope='name'  : 품목명 규칙 — 한 번 등록하면 매칭되는 모든 판매에 반복 적용 (방염·배송 등)
--   scope='line'  : 특정 거래 1건에만 적용 — 커튼제작비·이불커버 같은 커스텀 (그때그때)
-- 원가는 KRW 직접 입력(국내 비용이라 환율 미적용).
-- effective_from 기본 2026-07-01 → 1~6월 확정 손익은 영향 없음.

create table if not exists cogs_overrides (
  id             bigint generated always as identity primary key,
  scope          text    not null default 'name',        -- 'name' | 'line'
  product_name   text    not null,                        -- name: 매칭 품목명/키워드 · line: 원본 품목명(참고)
  match_mode     text    not null default 'exact',        -- name scope: 'exact' | 'contains'
  transaction_id text,                                    -- line scope: 대상 거래 id
  cost_mode      text    not null default 'per_unit',     -- 'per_unit'(원가×수량) | 'per_line'(건당 고정 총액)
  unit_cost      numeric not null,                        -- KRW
  effective_from date    not null default '2026-07-01',   -- 이 날짜(판매일)부터 적용
  note           text,
  active         boolean not null default true,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists cogs_overrides_scope_idx on cogs_overrides (scope, active);
create index if not exists cogs_overrides_name_idx  on cogs_overrides (product_name);
create index if not exists cogs_overrides_tx_idx    on cogs_overrides (transaction_id);
