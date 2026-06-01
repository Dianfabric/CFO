-- ============================================================
-- WAM (Weekly Action Meeting) — AI 자동 생성 컬럼 추가
-- ============================================================
-- weekly_action_meetings 테이블 확장:
--   ai_summary           - Claude 가 생성한 한 줄 요약 (지난 주)
--   ai_analysis          - 잘된/안된/권장 JSONB
--   previous_week_data   - 직원별 지난 주 통계 스냅샷 (JSONB)
--   next_week_plan       - Claude 가 추천한 이번 주 핵심 액션 (JSONB)
--   generated_at         - 자동 생성 시점
--   generated_by         - 'cron' / 'manual' / null
--
-- (cycle_id, week_number) UNIQUE — 한 주 한 번만 자동 생성
-- ============================================================

ALTER TABLE weekly_action_meetings
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_analysis JSONB,
  ADD COLUMN IF NOT EXISTS previous_week_data JSONB,
  ADD COLUMN IF NOT EXISTS next_week_plan JSONB,
  ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS generated_by TEXT;

-- 한 사이클 한 주 한 번만 (자동 재생성 시 upsert)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wam_cycle_week
  ON weekly_action_meetings(cycle_id, week_number)
  WHERE cycle_id IS NOT NULL;

-- anon 허용 RLS (V2.2)
ALTER TABLE weekly_action_meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wam_select" ON weekly_action_meetings;
DROP POLICY IF EXISTS "wam_modify" ON weekly_action_meetings;
CREATE POLICY "wam_all_anon"
ON weekly_action_meetings
FOR ALL
USING (true)
WITH CHECK (true);
