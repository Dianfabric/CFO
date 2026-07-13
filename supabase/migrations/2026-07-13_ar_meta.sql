-- 미수 건 부가정보 (프로젝트명·거래처 담당자·연락처) — 2026-07-13
-- Prisma accountsReceivable(프로덕션 Postgres)에는 DDL 접근이 없어 Supabase 오버레이로 저장.
-- key = AR id (Prisma accountsReceivable.id). 재업로드/대사에 영향받지 않고 수동 입력 보존.
-- (할인은 별도 테이블 없이 ArPayment '[할인]' 항목으로 기록 — 잔액 자동 재계산)

create table if not exists ar_meta (
  ar_id         text primary key,          -- Prisma accountsReceivable.id
  project_name  text,                      -- 프로젝트명 (프로젝트별 담당자 연락용)
  contact_name  text,                      -- 거래처 담당자 이름
  contact_phone text,                      -- 거래처 담당자 연락처
  updated_at    timestamptz default now()
);
