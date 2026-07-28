-- 전사 마케팅 콘텐츠 발행 시스템 (대표 지시 2026-07-14)
-- 목적: 들쭉날쭉한 발행 → 주간 계획(슬롯) + 캘린더 + 완료 체크 + 준수율.
-- mkt_posts: 발행 1건 = 1행 (계획 시 생성, 발행 시 done 체크)
create table if not exists mkt_posts (
  id            bigint generated always as identity primary key,
  channel       text not null,   -- dian_blog|dian_insta|dian_yt|saek_blog|saek_insta|saek_yt
  content_type  text not null,   -- info(정보성)|brand(브랜딩)|carousel(캐러셀)|reels(릴스)|video(영상)
  planned_date  date not null,   -- 배포 예정일
  title         text,            -- 주제/제목 (기획 메모)
  status        text not null default 'planned', -- planned|done|skipped
  done_at       timestamptz,
  memo          text,
  created_at    timestamptz not null default now()
);
create index if not exists mkt_posts_date_idx on mkt_posts (planned_date);
create index if not exists mkt_posts_channel_idx on mkt_posts (channel, planned_date);

-- 주간 반복 슬롯 템플릿 (예: 색동 인스타 릴스 = 월·수·금) — '다음 주 생성' 버튼의 원본
create table if not exists mkt_slot_templates (
  id            bigint generated always as identity primary key,
  channel       text not null,
  content_type  text not null,
  weekday       int  not null,   -- 0=월 ... 6=일
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- 마케팅 목표 (쇼핑몰 순이익 등 단일 키-값)
create table if not exists mkt_settings (
  key   text primary key,
  value jsonb not null
);
