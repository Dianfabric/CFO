-- 마케팅 채널 성과 스냅샷 (대표 지시 2026-07-28) — 팔로워·구독자 일별 기록 → 추이 도표
create table if not exists mkt_channel_stats (
  id        bigint generated always as identity primary key,
  channel   text not null,        -- saek_insta | dian_insta | saek_yt | dian_yt ...
  stat_date date not null,
  followers integer,              -- 팔로워/구독자
  extra     jsonb,                -- media_count 등 부가 지표
  created_at timestamptz not null default now(),
  unique (channel, stat_date)
);
