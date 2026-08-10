-- 색동 매장 직접 판매 수기 입력 (대표 지시 2026-07-28) — 현금/카드 구분
create table if not exists saekdong_store_sales (
  id         bigint generated always as identity primary key,
  sale_date  date not null,
  method     text not null check (method in ('cash','card')),
  amount     integer not null,
  memo       text,
  created_at timestamptz not null default now()
);
create index if not exists saekdong_store_sales_date_idx on saekdong_store_sales (sale_date);
