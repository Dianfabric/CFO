-- v1.1 Planning Migration (#1 목표·계획)
-- Apply via Supabase SQL Editor.

-- 1) 장기 비전 (singleton, id=1)
CREATE TABLE IF NOT EXISTS long_term_vision (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  five_year_vision TEXT,
  three_year_vision TEXT,
  three_year_milestones TEXT,
  core_values TEXT,
  non_negotiables TEXT,
  origin_story TEXT,
  bhag TEXT,                  -- Big Hairy Audacious Goal (Collins)
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES profiles(id)
);

INSERT INTO long_term_vision (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 2) cycles 회고 필드 확장 (구조화된 retro)
ALTER TABLE cycles ADD COLUMN IF NOT EXISTS what_worked TEXT;
ALTER TABLE cycles ADD COLUMN IF NOT EXISTS what_didnt TEXT;
ALTER TABLE cycles ADD COLUMN IF NOT EXISTS lessons_learned TEXT;
ALTER TABLE cycles ADD COLUMN IF NOT EXISTS next_cycle_focus TEXT;
ALTER TABLE cycles ADD COLUMN IF NOT EXISTS retro_completed BOOLEAN DEFAULT false;

-- 3) goals 정합성 점검 필드
ALTER TABLE goals ADD COLUMN IF NOT EXISTS aligned_with_vision BOOLEAN;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS importance_score INTEGER CHECK (importance_score BETWEEN 1 AND 5);
ALTER TABLE goals ADD COLUMN IF NOT EXISTS measurability_note TEXT;

-- 4) 주차별 진행 스냅샷 (자동 누적용 — 추후 cron으로 채움)
CREATE TABLE IF NOT EXISTS cycle_weekly_snapshots (
  id SERIAL PRIMARY KEY,
  cycle_id INTEGER NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 12),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- 후행지표 (transactions 집계)
  cumulative_revenue NUMERIC(12,2) DEFAULT 0,
  cumulative_margin NUMERIC(12,2) DEFAULT 0,
  active_clients INTEGER DEFAULT 0,
  new_clients INTEGER DEFAULT 0,
  -- 선행지표 (sales_activities 집계)
  meetings_count INTEGER DEFAULT 0,
  samples_count INTEGER DEFAULT 0,
  contacts_count INTEGER DEFAULT 0,
  proposals_count INTEGER DEFAULT 0,
  -- 목표 달성률
  avg_goal_progress NUMERIC(5,2),
  goals_passed_80 INTEGER DEFAULT 0,
  -- 메타
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cycle_id, week_number)
);

CREATE INDEX IF NOT EXISTS idx_cycle_snapshots_cycle ON cycle_weekly_snapshots(cycle_id, week_number);

-- 5) RLS
ALTER TABLE long_term_vision ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_weekly_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS long_term_vision_select ON long_term_vision;
CREATE POLICY long_term_vision_select ON long_term_vision FOR SELECT USING (
  current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
);

DROP POLICY IF EXISTS long_term_vision_modify ON long_term_vision;
CREATE POLICY long_term_vision_modify ON long_term_vision FOR ALL USING (
  current_user_role() IN ('ceo', 'executive')
);

DROP POLICY IF EXISTS snapshots_all ON cycle_weekly_snapshots;
CREATE POLICY snapshots_all ON cycle_weekly_snapshots FOR ALL USING (
  current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
);
